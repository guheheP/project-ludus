/**
 * ScriptRuntime — Compiles and executes user scripts in a sandboxed context
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

  /** @type {number} */
  elapsed = 0;

  /** @type {number} */
  frame = 0;

  /** @type {boolean} */
  isRunning = false;

  constructor(scene, input, physics = null, audioSystem = null, uiSystem = null) {
    this.scene = scene;
    this.input = input;
    this.physics = physics;
    this.audioSystem = audioSystem;
    this.uiSystem = uiSystem;
  }

  /**
   * Compile all Script components and call start()
   */
  start() {
    this.elapsed = 0;
    this.frame = 0;
    this.isRunning = true;

    // Compile and start all scripts
    this.scene.entityMap.forEach((entity) => {
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

    this.scene.entityMap.forEach((entity) => {
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
              entity: { name: other.name, id: other.id, object3D: other.object3D },
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

    // Clear per-frame input
    this.input.endFrame();
  }

  /**
   * Stop all scripts
   */
  stop() {
    this.isRunning = false;

    this.scene.entityMap.forEach((entity) => {
      if (entity.hasComponent('Script')) {
        const script = entity.getComponent('Script');
        script._startFn = null;
        script._updateFn = null;
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
      },
      transform: transform ? {
        get position() { return transform.position; },
        get rotation() { return transform.rotation; },
        get scale() { return transform.scale; },
        setPosition(x, y, z) { transform.setPosition(x, y, z); },
        setScale(x, y, z) { transform.setScale(x, y, z); },
      } : null,
      scene: {
        name: this.scene.name,
        find: (name) => {
          let found = null;
          this.scene.entityMap.forEach((e) => {
            if (e.name === name) found = e;
          });
          return found;
        },
      },
      input: {
        isKeyDown: (key) => this.input.isKeyDown(key),
        isKeyPressed: (key) => this.input.isKeyPressed(key),
        isKeyReleased: (key) => this.input.isKeyReleased(key),
        get mouse() { return self.input.mouse; },
        get mouseLeft() { return self.input.mouseLeft; },
        get mouseRight() { return self.input.mouseRight; },
      },
      time: {
        dt: 0,
        elapsed: 0,
        frame: 0,
      },
      // Math utilities
      Math: Math,
      THREE: null, // Will be set after import
      // RigidBody API (if entity has RigidBody component)
      rigidbody: this._createRigidbodyAPI(entity),
      // Audio API (if entity has AudioSource component)
      audio: this._createAudioAPI(entity),
      // UI API (if UISystem is available)
      ui: this._createUIAPI(),
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
        'entity', 'transform', 'scene', 'input', 'time', 'console', 'Math',
        'rigidbody', 'audio', 'ui',
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
        context.rigidbody,
        context.audio,
        context.ui,
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
    }
  }

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
      get velocity() {
        return rb.getVelocity();
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
}
