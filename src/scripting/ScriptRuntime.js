import * as THREE from 'three';
import { Transform } from '../engine/components/Transform.js';
import { ProceduralMesh } from '../modeling/ProceduralMesh.js';
import { RigidBody } from '../engine/components/RigidBody.js';
import { Collider } from '../engine/components/Collider.js';

/**
 * ScriptRuntime — Compiles and executes user scripts in a sandboxed context
 *
 * Phase 15A additions:
 *  - camera API (15A-1)
 *  - scene.instantiate / scene.destroy (15A-2)
 *  - Enhanced _wrapEntity with getComponent + API proxies (15A-3)
 *  - game global store (15B-5 — included early as it's tiny)
 */
export class ScriptRuntime {
  /** @type {import('../engine/Scene.js').Scene} */
  scene;

  /** @type {import('./InputManager.js').InputManager} */
  input;

  /** @type {import('../engine/systems/PhysicsWorld.js').PhysicsWorld|null} */
  physics = null;

  /** @type {import('../engine/systems/AudioSystem.js').AudioSystem|null} */
  audioSystem = null;

  /** @type {import('../engine/systems/UISystem.js').UISystem|null} */
  uiSystem = null;

  /** @type {Function|null} */
  onLog = null;

  /** @type {Function|null} */
  onError = null;

  /** @type {Function|null} Called on runtime errors to trigger auto-stop */
  onCriticalError = null;

  /** @type {number} */
  elapsed = 0;

  /** @type {number} */
  frame = 0;

  /** @type {boolean} */
  isRunning = false;

  /** @type {Map<string, any>} Global game store shared across scripts */
  _gameStore = new Map();

  /** @type {import('../engine/components/Camera.js').Camera|null} */
  _activeCameraComponent = null;

  /** @type {THREE.Camera|null} The resolved three.js camera for Play mode */
  activeCamera = null;

  /** @type {Array<{entity: object, delay: number}>} Pending delayed destroys */
  _pendingDestroys = [];

  /** @type {string|null} Pending scene load request (set by script, processed by Editor) */
  _pendingSceneLoad = null;

  /** @type {Function|null} Called when a scene load is requested */
  onSceneLoad = null;

  /** @type {Map<string, object>} In-memory prefab registry (loaded from project) */
  _prefabRegistry = new Map();

  /** @type {Function|null} Bound handler for unhandled promise rejections */
  _boundUnhandledRejection = null;

  /** @type {Function|null} Bound handler for uncaught global errors */
  _boundGlobalError = null;

  constructor(scene, input, physics = null, audioSystem = null, uiSystem = null, tweenManager = null) {
    this.scene = scene;
    this.input = input;
    this.physics = physics;
    this.audioSystem = audioSystem;
    this.uiSystem = uiSystem;
    this.tweenManager = tweenManager;
  }

  /**
   * Resolve the active Camera component in the scene
   */
  _resolveCamera() {
    this._activeCameraComponent = null;
    this.activeCamera = null;

    this.scene.entityMap.forEach((entity) => {
      if (entity.hasComponent('Camera')) {
        const cam = entity.getComponent('Camera');
        if (cam.primary) {
          this._activeCameraComponent = cam;
        }
      }
    });
  }

  /**
   * Compile all Script components and call start()
   */
  start() {
    this.elapsed = 0;
    this.frame = 0;
    this.isRunning = true;
    this._gameStore.clear();
    this._pendingDestroys = [];

    // Install global error handlers for async user script errors
    this._installGlobalErrorHandlers();

    // Resolve camera
    this._resolveCamera();

    // Compile and start all scripts
    this.scene.entityMap.forEach((entity) => {
      if (!entity.active) return;
      if (entity.hasComponent('Script')) {
        const script = entity.getComponent('Script');
        if (!script.enabled) return;
        this._compileScript(script, entity);
        this._callStart(script);
      }
    });
  }

  /**
   * Update all scripts
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (!this.isRunning) return;

    this.elapsed += dt;
    this.frame++;

    // Update active camera transform
    if (this._activeCameraComponent) {
      this.activeCamera = this._activeCameraComponent.getCamera();
    }

    this.scene.entityMap.forEach((entity) => {
      if (!entity.active) return;
      if (entity.hasComponent('Script')) {
        const script = entity.getComponent('Script');
        if (!script.enabled || script._hasError) return;

        // Update time context
        if (script._runtimeContext) {
          script._runtimeContext.time.dt = dt;
          script._runtimeContext.time.elapsed = this.elapsed;
          script._runtimeContext.time.frame = this.frame;
        }

        this._callUpdate(script, dt);
      }
    });

    // Process collision callbacks
    if (this.physics) {
      this.scene.entityMap.forEach((entity) => {
        if (!entity.hasComponent('Script')) return;
        const script = entity.getComponent('Script');
        if (!script.enabled || script._hasError || !script._onCollisionFn) return;

        const others = this.physics.getCollisionsFor(entity);
        for (const other of others) {
          try {
            script._onCollisionFn.call(script._runtimeContext, {
              entity: this._wrapEntity(other),
            });
          } catch (err) {
            script._hasError = true;
            script._errorMessage = err.message;
            if (this.onError) {
              this.onError(`[${entity.name}] Collision callback error: ${err.message}`);
            }
          }
        }
      });
    }

    // Process delayed destroys
    for (let i = this._pendingDestroys.length - 1; i >= 0; i--) {
      this._pendingDestroys[i].delay -= dt;
      if (this._pendingDestroys[i].delay <= 0) {
        const raw = this._pendingDestroys[i].entity;
        const realEntity = this.scene.getEntityById(raw.id || raw);
        if (realEntity) {
          this._destroyEntity(realEntity);
        }
        this._pendingDestroys.splice(i, 1);
      }
    }
    // Process pending scene load (deferred to end of frame)
    if (this._pendingSceneLoad) {
      const sceneName = this._pendingSceneLoad;
      this._pendingSceneLoad = null;
      if (this.onSceneLoad) {
        this.onSceneLoad(sceneName);
      }
    }

    // Clear per-frame input
    this.input.endFrame();
  }

  /**
   * Stop all scripts
   */
  stop() {
    this.isRunning = false;
    this._gameStore.clear();
    this._pendingDestroys = [];
    this._activeCameraComponent = null;
    this.activeCamera = null;

    // Remove global error handlers
    this._removeGlobalErrorHandlers();

    this.scene.entityMap.forEach((entity) => {
      if (entity.hasComponent('Script')) {
        const script = entity.getComponent('Script');
        script._startFn = null;
        script._updateFn = null;
        script._onCollisionFn = null;
        script._runtimeContext = null;
        script._started = false;
        script._hasError = false;
        script._errorMessage = '';
      }
    });
  }

  /**
   * Compile a script component
   */
  _compileScript(script, entity) {
    script._hasError = false;
    script._errorMessage = '';
    script._startFn = null;
    script._updateFn = null;
    script._onCollisionFn = null;
    script._started = false;

    // Create the runtime context (the 'this' for the script)
    const self = this;
    const transform = entity.getComponent('Transform');

    const context = {
      entity: {
        name: entity.name,
        id: entity.id,
        object3D: entity.object3D,
        get tag() { return entity.tag; },
        set tag(v) { entity.tag = v; },
        setActive(active) {
          entity.setActive(active);
        },
        get isActive() { return entity.active; },
      },
      transform: transform ? this._createTransformProxy(transform) : null,
      scene: {
        name: this.scene.name,
        find: (name) => {
          let found = null;
          this.scene.entityMap.forEach((e) => {
            if (e.name === name) found = e;
          });
          if (!found) return null;
          return this._wrapEntity(found);
        },
        findAll: (name) => {
          const results = [];
          this.scene.entityMap.forEach((e) => {
            if (e.name === name) results.push(this._wrapEntity(e));
          });
          return results;
        },
        findByTag: (tag) => {
          for (const [, e] of this.scene.entityMap) {
            if (e.tag === tag) return this._wrapEntity(e);
          }
          return null;
        },
        findAllByTag: (tag) => {
          const results = [];
          this.scene.entityMap.forEach((e) => {
            if (e.tag === tag) results.push(this._wrapEntity(e));
          });
          return results;
        },
        // 15A-2: Instantiate
        instantiate: (name, options = {}) => this._instantiateEntity(name, options),
        // 15A-2: Destroy
        destroy: (entityRef) => {
          const realEntity = this.scene.getEntityById(entityRef.id || entityRef);
          if (realEntity) this._destroyEntity(realEntity);
        },
        destroyDelayed: (entityRef, delay) => {
          this._pendingDestroys.push({ entity: entityRef, delay });
        },
        // Phase 11: Scene switching
        loadScene: (sceneName) => {
          this._pendingSceneLoad = sceneName;
        },
        // Phase 11: Prefab instantiation
        instantiatePrefab: (prefabName, options = {}) => {
          return this._instantiatePrefab(prefabName, options);
        },
      },
      input: {
        isKeyDown: (key) => this.input.isKeyDown(key),
        isKeyPressed: (key) => this.input.isKeyPressed(key),
        isKeyReleased: (key) => this.input.isKeyReleased(key),
        get mouse() { return self.input.mouse; },
        get mouseLeft() { return self.input.mouseLeft; },
        get mouseRight() { return self.input.mouseRight; },
        get mouseDelta() { return self.input.mouseDelta || { dx: 0, dy: 0 }; },
        lockCursor: () => { self.input.lockCursor?.(); },
        unlockCursor: () => { self.input.unlockCursor?.(); },
        get isCursorLocked() { return self.input.isCursorLocked || false; },
      },
      time: {
        dt: 0,
        elapsed: 0,
        frame: 0,
      },
      // Math utilities
      Math: Math,
      THREE: THREE,
      // Camera API (15A-1)
      camera: this._createCameraAPI(),
      // RigidBody API (if entity has RigidBody component)
      rigidbody: this._createRigidbodyAPI(entity),
      // Audio API (if entity has AudioSource component)
      audio: this._createAudioAPI(entity),
      // Particles API (if entity has ParticleEmitter component)
      particles: this._createParticlesAPI(entity),
      // Tween API
      tween: this._createTweenAPI(),
      // UI API (if UISystem is available)
      ui: this._createUIAPI(),
      // Renderer/Material API (15B-3)
      renderer: this._createRendererAPI(entity),
      // Game global store (15B-5)
      game: this._createGameAPI(),
      // Physics raycasting API (15C-1)
      physics: this._createPhysicsAPI(),
      // Console redirect
      console: {
        log: (...args) => {
          const msg = args.map(a =>
            typeof a === 'object' ? JSON.stringify(a) : String(a)
          ).join(' ');
          if (self.onLog) self.onLog('info', `[${entity.name}] ${msg}`);
        },
        warn: (...args) => {
          const msg = args.map(a => String(a)).join(' ');
          if (self.onLog) self.onLog('warn', `[${entity.name}] ${msg}`);
        },
        error: (...args) => {
          const msg = args.map(a => String(a)).join(' ');
          if (self.onLog) self.onLog('error', `[${entity.name}] ${msg}`);
        },
      },
    };

    script._runtimeContext = context;

    try {
      // Wrap user code to extract start/update functions
      // NOTE: Do NOT use let/const to pre-declare start/update,
      // as the user's function declarations would conflict in strict mode.
      const wrappedCode = `
        ${script.code}
        return {
          start: typeof start === 'function' ? start : null,
          update: typeof update === 'function' ? update : null,
          onCollision: typeof onCollision === 'function' ? onCollision : null,
        };
      `;

      const factory = new Function(
        'entity', 'transform', 'scene', 'input', 'time', 'console', 'Math', 'THREE',
        'rigidbody', 'audio', 'particles', 'tween', 'ui',
        'camera', 'renderer', 'game', 'physics',
        wrappedCode
      );

      const result = factory.call(
        context,
        context.entity,
        context.transform,
        context.scene,
        context.input,
        context.time,
        context.console,
        Math,
        THREE,
        context.rigidbody,
        context.audio,
        context.particles,
        context.tween,
        context.ui,
        context.camera,
        context.renderer,
        context.game,
        context.physics,
      );

      script._startFn = result.start;
      script._updateFn = result.update;
      script._onCollisionFn = result.onCollision || null;

    } catch (err) {
      script._hasError = true;
      script._errorMessage = err.message;
      if (this.onError) {
        this.onError(`[${entity.name}] Compile error: ${err.message}`);
      }
    }
  }

  _callStart(script) {
    if (!script._startFn || script._started || script._hasError) return;
    script._started = true;

    try {
      script._startFn.call(script._runtimeContext);
    } catch (err) {
      script._hasError = true;
      script._errorMessage = err.message;
      if (this.onError) {
        this.onError(`[${script.entity?.name}] Start error: ${err.message}`);
      }
      if (this.onCriticalError) {
        this.onCriticalError(`[${script.entity?.name}] Start error: ${err.message}`);
      }
    }
  }

  _callUpdate(script, dt) {
    if (!script._updateFn || script._hasError) return;

    try {
      script._updateFn.call(script._runtimeContext, dt);
    } catch (err) {
      script._hasError = true;
      script._errorMessage = err.message;
      if (this.onError) {
        this.onError(`[${script.entity?.name}] Runtime error: ${err.message}`);
      }
      if (this.onCriticalError) {
        this.onCriticalError(`[${script.entity?.name}] Runtime error: ${err.message}`);
      }
    }
  }

  // =============================================
  // Global Error Handlers for Async Script Errors
  // =============================================

  /**
   * Install window-level error handlers to catch unhandled promise rejections
   * and uncaught errors from user scripts (setTimeout, async/await, etc.)
   */
  _installGlobalErrorHandlers() {
    this._removeGlobalErrorHandlers(); // Safety: remove any prior handlers

    this._boundUnhandledRejection = (event) => {
      if (!this.isRunning) return;
      event.preventDefault(); // Prevent default browser logging
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      if (this.onError) {
        this.onError(`[Script] Unhandled async error: ${message}`);
      }
      if (this.onLog) {
        this.onLog('error', `Unhandled promise rejection in user script: ${message}`);
      }
    };

    this._boundGlobalError = (event) => {
      if (!this.isRunning) return;
      // Only intercept errors likely from user scripts (eval'd code)
      const message = event.message || 'Unknown error';
      if (this.onError) {
        this.onError(`[Script] Uncaught error: ${message}`);
      }
      if (this.onLog) {
        this.onLog('error', `Uncaught error in user script: ${message}`);
      }
    };

    window.addEventListener('unhandledrejection', this._boundUnhandledRejection);
    window.addEventListener('error', this._boundGlobalError);
  }

  /**
   * Remove the global error handlers installed during start()
   */
  _removeGlobalErrorHandlers() {
    if (this._boundUnhandledRejection) {
      window.removeEventListener('unhandledrejection', this._boundUnhandledRejection);
      this._boundUnhandledRejection = null;
    }
    if (this._boundGlobalError) {
      window.removeEventListener('error', this._boundGlobalError);
      this._boundGlobalError = null;
    }
  }

  // =============================================
  // 15A-1: Camera API
  // =============================================

  _createCameraAPI() {
    const self = this;
    return {
      setPosition(x, y, z) {
        if (self._activeCameraComponent?.entity) {
          const t = self._activeCameraComponent.entity.getComponent('Transform');
          if (t) t.setPosition(x, y, z);
        }
      },
      lookAt(x, y, z) {
        if (self._activeCameraComponent?.entity) {
          self._activeCameraComponent.entity.object3D.lookAt(x, y, z);
        }
      },
      follow(targetRef, offset = { x: 0, y: 5, z: -10 }) {
        if (!self._activeCameraComponent?.entity) return;
        // Resolve target entity
        let targetObj3D = null;
        if (targetRef && targetRef.object3D) {
          targetObj3D = targetRef.object3D;
        } else if (typeof targetRef === 'number') {
          const e = self.scene.getEntityById(targetRef);
          if (e) targetObj3D = e.object3D;
        }
        if (!targetObj3D) return;

        const pos = new THREE.Vector3();
        targetObj3D.getWorldPosition(pos);
        const camT = self._activeCameraComponent.entity.getComponent('Transform');
        if (camT) {
          camT.setPosition(pos.x + offset.x, pos.y + offset.y, pos.z + offset.z);
        }
        self._activeCameraComponent.entity.object3D.lookAt(pos);
      },
      setFOV(deg) {
        if (self._activeCameraComponent) {
          self._activeCameraComponent.fov = deg;
        }
      },
      get position() {
        if (self._activeCameraComponent?.entity) {
          const t = self._activeCameraComponent.entity.getComponent('Transform');
          return t ? t.position : null;
        }
        return null;
      },
      get fov() {
        return self._activeCameraComponent?.fov || 60;
      },
    };
  }

  // =============================================
  // 15A-2: Instantiate / Destroy
  // =============================================

  /**
   * Create a new entity at runtime
   * @param {string} name
   * @param {object} options - { position, rotation, scale, shape, color, physics }
   * @returns {object} wrapped entity reference
   */
  _instantiateEntity(name, options = {}) {
    const entity = this.scene.createEntity(name || 'Entity');
    const transform = new Transform();
    entity.addComponent(transform);

    if (options.position) {
      transform.setPosition(options.position.x || 0, options.position.y || 0, options.position.z || 0);
    }
    if (options.rotation) {
      transform.setRotationDeg(options.rotation.x || 0, options.rotation.y || 0, options.rotation.z || 0);
    }
    if (options.scale) {
      transform.setScale(options.scale.x || 1, options.scale.y || 1, options.scale.z || 1);
    }

    // Optionally add mesh
    if (options.shape) {
      try {
        const pm = new ProceduralMesh();
        entity.addComponent(pm);
        pm.configure(options.shape, options.shapeParams || {}, {
          color: options.color || '#ffffff',
          metalness: options.metalness || 0.3,
          roughness: options.roughness || 0.5,
        });
      } catch (_) {
        // ProceduralMesh not available — skip
      }
    }

    // Optionally add physics
    if (options.physics) {
      try {
        const rb = new RigidBody();
        rb.bodyType = options.physics.type || 'dynamic';
        rb.mass = options.physics.mass || 1;
        entity.addComponent(rb);

        const col = new Collider();
        col.shape = options.physics.collider || options.shape || 'box';
        if (options.physics.size) col.size = options.physics.size;
        if (options.physics.radius) col.radius = options.physics.radius;
        entity.addComponent(col);

        // Register with physics world
        if (this.physics && this.physics.initialized) {
          this.physics.addBody(entity);
        }
      } catch (_) {
        // Physics not available — skip
      }
    }

    return this._wrapEntity(entity);
  }

  /**
   * Destroy an entity at runtime
   * @param {import('../engine/Entity.js').Entity} entity
   */
  _destroyEntity(entity) {
    if (!entity || entity === this.scene.root) return;

    // Remove from physics
    if (this.physics && this.physics.initialized) {
      this.physics.removeBody?.(entity);
    }

    // Remove from scene
    this.scene.removeEntity(entity);
  }

  /**
   * Instantiate a prefab by name from the registry
   * @param {string} prefabName
   * @param {object} options - { position, rotation, scale }
   * @returns {object|null} wrapped entity or null if prefab not found
   */
  _instantiatePrefab(prefabName, options = {}) {
    const prefabData = this._prefabRegistry.get(prefabName);
    if (!prefabData) {
      if (this.onLog) this.onLog('warn', `Prefab not found: "${prefabName}"`);
      return null;
    }

    // Use SceneSerializer.deserializeEntity to construct the entity
    // We need to import it dynamically to avoid circular deps
    try {
      // Deep clone to avoid mutating the template
      const data = JSON.parse(JSON.stringify(prefabData));

      // Override position/rotation/scale if provided
      if (options.position && data.components?.Transform) {
        data.components.Transform.position = {
          x: options.position.x ?? 0,
          y: options.position.y ?? 0,
          z: options.position.z ?? 0,
        };
      }
      if (options.rotation && data.components?.Transform) {
        data.components.Transform.rotation = {
          x: options.rotation.x ?? 0,
          y: options.rotation.y ?? 0,
          z: options.rotation.z ?? 0,
        };
      }
      if (options.scale && data.components?.Transform) {
        data.components.Transform.scale = {
          x: options.scale.x ?? 1,
          y: options.scale.y ?? 1,
          z: options.scale.z ?? 1,
        };
      }

      // Give it a new name if desired
      data.name = options.name || data.name || prefabName;

      // Use the dynamic import approach to get SceneSerializer
      import('../editor/SceneSerializer.js').then(({ SceneSerializer }) => {
        const entity = SceneSerializer.deserializeEntity(data, this.scene, null);

        // Register physics if applicable
        if (entity.hasComponent('RigidBody') && entity.hasComponent('Collider')) {
          if (this.physics && this.physics.initialized) {
            this.physics.addBody(entity);
          }
        }
      });

      // Return a simple wrapper (entity will be available next frame)
      return { name: data.name, prefab: prefabName };
    } catch (err) {
      if (this.onError) this.onError(`Failed to instantiate prefab "${prefabName}": ${err.message}`);
      return null;
    }
  }

  // =============================================
  // 15A-3: Enhanced _wrapEntity
  // =============================================

  /**
   * Create a sandboxed wrapper for an entity — used by scene.find() / scene.findAll()
   * @param {import('../engine/Entity.js').Entity} entity
   * @returns {object}
   */
  _wrapEntity(entity) {
    const self = this;
    const t = entity.getComponent('Transform');
    return {
      name: entity.name,
      id: entity.id,
      get tag() { return entity.tag; },
      set tag(v) { entity.tag = v; },
      object3D: entity.object3D,
      get isActive() { return entity.active; },
      setActive(active) {
        entity.setActive(active);
      },
      transform: t ? self._createTransformProxy(t) : null,
      /** 15A-3: Access any component by name */
      getComponent(typeName) {
        const comp = entity.getComponent(typeName);
        if (!comp) return null;
        // Provide API proxies for known component types
        switch (typeName) {
          case 'RigidBody': return self._createRigidbodyAPI(entity);
          case 'ParticleEmitter': return self._createParticlesAPI(entity);
          case 'Animator': return self._createAnimatorAPI(entity);
          case 'AudioSource': return self._createAudioAPI(entity);
          case 'Transform': return self._createTransformProxy(comp);
          default: return comp;
        }
      },
      get rigidbody() { return self._createRigidbodyAPI(entity); },
      get particles() { return self._createParticlesAPI(entity); },
      get animator() { return self._createAnimatorAPI(entity); },
      get audio() { return self._createAudioAPI(entity); },
      get renderer() { return self._createRendererAPI(entity); },
    };
  }

  // =============================================
  // Transform Proxy with helpers (15B-4)
  // =============================================

  _createTransformProxy(transform) {
    const obj3D = transform.entity?.object3D;
    return {
      get position() { return transform.position; },
      get rotation() { return transform.rotation; },
      get scale() { return transform.scale; },
      setPosition(x, y, z) { transform.setPosition(x, y, z); },
      setScale(x, y, z) { transform.setScale(x, y, z); },
      setRotation(x, y, z) {
        const d = Math.PI / 180;
        if (obj3D) obj3D.rotation.set(x * d, y * d, z * d);
      },
      setRotationDeg(x, y, z) {
        const d = Math.PI / 180;
        if (obj3D) obj3D.rotation.set(x * d, y * d, z * d);
      },
      lookAt(x, y, z) {
        if (obj3D) obj3D.lookAt(x, y, z);
      },
      translate(x, y, z) {
        if (obj3D) obj3D.translateX(x), obj3D.translateY(y), obj3D.translateZ(z);
      },
      get forward() {
        if (!obj3D) return new THREE.Vector3(0, 0, -1);
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyQuaternion(obj3D.quaternion);
        return dir;
      },
      get right() {
        if (!obj3D) return new THREE.Vector3(1, 0, 0);
        const dir = new THREE.Vector3(1, 0, 0);
        dir.applyQuaternion(obj3D.quaternion);
        return dir;
      },
      get up() {
        if (!obj3D) return new THREE.Vector3(0, 1, 0);
        const dir = new THREE.Vector3(0, 1, 0);
        dir.applyQuaternion(obj3D.quaternion);
        return dir;
      },
    };
  }

  // =============================================
  // Component API Proxies
  // =============================================

  /**
   * Create a rigidbody API proxy for scripts
   * @param {import('../engine/Entity.js').Entity} entity
   * @returns {object|null}
   */
  _createRigidbodyAPI(entity) {
    const rb = entity.getComponent('RigidBody');
    if (!rb) return null;

    return {
      addForce: (x, y, z) => rb.addForce(x, y, z),
      addImpulse: (x, y, z) => rb.addImpulse(x, y, z),
      setVelocity: (x, y, z) => rb.setVelocity(x, y, z),
      setAngularVelocity: (x, y, z) => rb.setAngularVelocity(x, y, z),
      setTranslation: (x, y, z) => rb.setTranslation(x, y, z),
      setRotation: (x, y, z, w) => rb.setRotation(x, y, z, w),
      get velocity() {
        return rb.getVelocity();
      },
      get angularVelocity() {
        return rb.getAngularVelocity();
      },
    };
  }

  /**
   * Create an audio API proxy for scripts
   * @param {import('../engine/Entity.js').Entity} entity
   * @returns {object|null}
   */
  _createAudioAPI(entity) {
    const src = entity.getComponent('AudioSource');
    if (!src) return null;

    return {
      play: () => {
        if (src.threeAudio && !src.threeAudio.isPlaying) {
          src.threeAudio.play();
        }
      },
      stop: () => {
        if (src.threeAudio && src.threeAudio.isPlaying) {
          src.threeAudio.stop();
        }
      },
      setVolume: (v) => {
        src.volume = v;
        if (src.threeAudio) src.threeAudio.setVolume(v);
      }
    };
  }

  /**
   * Create a particles API proxy for scripts
   * @param {import('../engine/Entity.js').Entity} entity
   * @returns {object|null}
   */
  _createParticlesAPI(entity) {
    const pe = entity.getComponent('ParticleEmitter');
    if (!pe) return null;

    return {
      emit: () => pe.play(),
      stop: () => pe.stop(),
      play: () => pe.play(),
      burst: (count = 50) => pe.burst(count),
      reset: () => pe.reset(),
      set: (params) => {
        if (params.rate !== undefined) pe.emissionRate = params.rate;
        if (params.gravity !== undefined) pe.gravity = params.gravity;
        if (params.spread !== undefined) pe.spread = params.spread;
        if (params.startColor !== undefined) pe.startColor = params.startColor;
        if (params.endColor !== undefined) pe.endColor = params.endColor;
        if (params.startSize !== undefined) pe.startSize = params.startSize;
        if (params.endSize !== undefined) pe.endSize = params.endSize;
        if (params.startOpacity !== undefined) pe.startOpacity = params.startOpacity;
        if (params.endOpacity !== undefined) pe.endOpacity = params.endOpacity;
      },
      get playing() { return pe.playing; },
    };
  }

  /**
   * Create an animator API proxy for scripts
   * @param {import('../engine/Entity.js').Entity} entity
   * @returns {object|null}
   */
  _createAnimatorAPI(entity) {
    const anim = entity.getComponent('Animator');
    if (!anim) return null;

    return {
      get playing() { return anim.playing; },
      get type() { return anim.animationType; },
      play: () => { anim.playing = true; },
      stop: () => { anim.playing = false; },
      setType: (type) => { anim.animationType = type; },
      setSpeed: (speed) => { anim.speed = speed; },
      reset: () => { anim.reset(); },
    };
  }

  /**
   * Create a tween API proxy for scripts
   * @returns {object|null}
   */
  _createTweenAPI() {
    const tm = this.tweenManager;
    if (!tm) return null;

    return {
      to: (target, props, duration, easing = 'linear') => tm.to(target, props, duration, easing),
      killAll: () => tm.killAll(),
      killTweensOf: (target) => tm.killTweensOf(target),
      get count() { return tm.count; },
    };
  }

  /**
   * Create a UI API proxy for scripts
   * @returns {object|null}
   */
  _createUIAPI() {
    const sys = this.uiSystem;
    if (!sys) return null;

    return {
      createText: (text, options) => sys.createText(text, options),
      createButton: (label, onClick, options) => sys.createButton(label, onClick, options),
      createProgressBar: (value, options) => sys.createProgressBar(value, options),
      createImage: (src, options) => sys.createImage(src, options),
      updateText: (id, newText) => sys.updateText(id, newText),
      updateProgressBar: (id, value) => sys.updateProgressBar(id, value),
      setPosition: (id, x, y) => sys.setPosition(id, x, y),
      setVisible: (id, visible) => sys.setVisible(id, visible),
      removeElement: (id) => sys.removeElement(id),
      clearAll: () => sys.clearAll(),
    };
  }

  // =============================================
  // 15B-3: Renderer / Material API
  // =============================================

  _createRendererAPI(entity) {
    return {
      setColor(hex) {
        const mesh = _findMesh(entity);
        if (mesh?.material) mesh.material.color.set(hex);
      },
      setOpacity(value) {
        const mesh = _findMesh(entity);
        if (mesh?.material) {
          mesh.material.transparent = value < 1;
          mesh.material.opacity = value;
        }
      },
      setVisible(visible) {
        entity.object3D.visible = visible;
      },
      setEmissive(hex, intensity = 1) {
        const mesh = _findMesh(entity);
        if (mesh?.material?.emissive) {
          mesh.material.emissive.set(hex);
          mesh.material.emissiveIntensity = intensity;
        }
      },
    };
  }

  // =============================================
  // 15B-5: Game Global Store
  // =============================================

  _createGameAPI() {
    const store = this._gameStore;
    return {
      set(key, value) { store.set(key, value); },
      get(key, defaultValue) { return store.has(key) ? store.get(key) : defaultValue; },
      has(key) { return store.has(key); },
      delete(key) { return store.delete(key); },
      clear() { store.clear(); },
    };
  }

  // =============================================
  // 15C-1: Physics Raycast API
  // =============================================

  _createPhysicsAPI() {
    const pw = this.physics;
    if (!pw) return null;

    const self = this;
    return {
      /**
       * Cast a ray and return the first hit
       * @param {{x,y,z}} origin
       * @param {{x,y,z}} direction (normalized)
       * @param {number} maxDistance
       */
      raycast(origin, direction, maxDistance = 100) {
        const result = pw.raycast(origin, direction, maxDistance);
        if (result && result.hit && result.entity) {
          result.entity = self._wrapEntity(result.entity);
        }
        return result;
      },
      /**
       * Cast a ray and return all hits
       */
      raycastAll(origin, direction, maxDistance = 100) {
        const results = pw.raycastAll(origin, direction, maxDistance);
        return results.map(r => {
          if (r.entity) r.entity = self._wrapEntity(r.entity);
          return r;
        });
      },
      /**
       * Set world gravity
       */
      setGravity(x, y, z) {
        pw.setGravity(x, y, z);
      },
      /**
       * Get current gravity
       */
      get gravity() {
        return pw.world ? pw.world.gravity : { x: 0, y: -9.81, z: 0 };
      },
    };
  }
}

// =============================================
// Helper: Find the first mesh in an entity
// =============================================
function _findMesh(entity) {
  let mesh = null;
  entity.object3D.traverse((child) => {
    if (!mesh && child.isMesh) mesh = child;
  });
  return mesh;
}
