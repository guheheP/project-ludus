import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

/**
 * PhysicsWorld — Manages Rapier physics world and synchronization with Three.js
 * Uses a fixed timestep accumulator pattern for consistent simulation
 * regardless of display refresh rate (60fps, 120fps, 240fps, etc.)
 */
export class PhysicsWorld {
  /** @type {RAPIER.World|null} */
  world = null;

  /** @type {boolean} */
  initialized = false;

  /** @type {Map<number, { rigidBody: RAPIER.RigidBody, entity: any, collider: RAPIER.Collider }>} */
  bodyMap = new Map();

  /** @type {number} Fixed physics timestep (1/60s) */
  fixedDt = 1 / 60;

  /** @type {number} Accumulated time for fixed step */
  accumulator = 0;

  /** @type {number} Maximum accumulated time to prevent spiral of death */
  maxAccumulator = 0.1;

  /** @type {RAPIER.EventQueue|null} */
  eventQueue = null;

  /** @type {Array<{entity1: any, entity2: any}>} */
  collisionEvents = [];

  /** @type {THREE.Group|null} Debug wireframe group */
  debugGroup = null;

  /** @type {boolean} */
  debugVisible = false;

  /** @type {THREE.LineBasicMaterial} */
  _debugMaterial = null;

  /** @type {THREE.LineBasicMaterial} */
  _debugTriggerMaterial = null;

  /**
   * Initialize Rapier WASM module
   */
  async init() {
    await RAPIER.init();
    this.initialized = true;
    this._createWorld();
    this._debugMaterial = new THREE.LineBasicMaterial({ color: 0x00ff88, depthTest: true, transparent: true, opacity: 0.6 });
    this._debugTriggerMaterial = new THREE.LineBasicMaterial({ color: 0xff8800, depthTest: true, transparent: true, opacity: 0.6 });
    return this;
  }

  _createWorld() {
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.world = new RAPIER.World(gravity);
    this.eventQueue = new RAPIER.EventQueue(true);
    this.bodyMap.clear();
    this.collisionEvents = [];
    this.accumulator = 0;
  }

  /**
   * Set gravity
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setGravity(x, y, z) {
    if (this.world) {
      this.world.gravity = { x, y, z };
    }
  }

  /**
   * Add a physics body for an entity
   * @param {import('../Entity.js').Entity} entity
   */
  addBody(entity) {
    if (!this.world) return;

    const rb = entity.getComponent('RigidBody');
    const col = entity.getComponent('Collider');
    const transform = entity.getComponent('Transform');

    if (!rb || !col || !transform) return;

    // Create rigid body
    let bodyDesc;
    switch (rb.bodyType) {
      case 'static':
        bodyDesc = RAPIER.RigidBodyDesc.fixed();
        break;
      case 'kinematic':
        bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
        break;
      default: // 'dynamic'
        bodyDesc = RAPIER.RigidBodyDesc.dynamic();
        break;
    }

    const pos = transform.position;
    const rot = entity.object3D.quaternion;
    bodyDesc.setTranslation(pos.x, pos.y, pos.z);
    bodyDesc.setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });
    bodyDesc.setLinearDamping(rb.linearDamping);
    bodyDesc.setAngularDamping(rb.angularDamping);
    bodyDesc.setGravityScale(rb.gravityScale);

    const rigidBody = this.world.createRigidBody(bodyDesc);

    // Lock rotation axes
    if (rb.lockRotation.x || rb.lockRotation.y || rb.lockRotation.z) {
      rigidBody.setEnabledRotations(!rb.lockRotation.x, !rb.lockRotation.y, !rb.lockRotation.z, true);
    }

    // Set mass properties for dynamic bodies
    if (rb.bodyType === 'dynamic') {
      rigidBody.setAdditionalMass(Math.max(0, rb.mass - 1.0), true);
      // Enable CCD (Continuous Collision Detection) to prevent tunneling
      rigidBody.enableCcd(true);
    }

    // Create collider
    let colliderDesc;
    const scale = transform.scale;
    switch (col.shape) {
      case 'sphere':
        colliderDesc = RAPIER.ColliderDesc.ball(col.radius * Math.max(scale.x, scale.y, scale.z));
        break;
      case 'capsule':
        colliderDesc = RAPIER.ColliderDesc.capsule(col.height * 0.5 * scale.y, col.radius * Math.max(scale.x, scale.z));
        break;
      case 'cylinder':
        colliderDesc = RAPIER.ColliderDesc.cylinder(col.height * 0.5 * scale.y, col.radius * Math.max(scale.x, scale.z));
        break;
      default: // 'box'
        colliderDesc = RAPIER.ColliderDesc.cuboid(
          col.size.x * scale.x,
          col.size.y * scale.y,
          col.size.z * scale.z
        );
        break;
    }

    colliderDesc.setRestitution(col.restitution);
    colliderDesc.setFriction(col.friction);

    if (col.isTrigger) {
      colliderDesc.setSensor(true);
    }

    // Enable collision events
    colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    const collider = this.world.createCollider(colliderDesc, rigidBody);

    // Store mapping
    this.bodyMap.set(entity.id, { rigidBody, entity, collider });

    // Store handle on components for API access
    rb._rapierBody = rigidBody;
    col._rapierCollider = collider;
  }

  /**
   * Remove a physics body for an entity
   * @param {import('../Entity.js').Entity} entity
   */
  removeBody(entity) {
    if (!this.world) return;
    const data = this.bodyMap.get(entity.id);
    if (data) {
      this.world.removeRigidBody(data.rigidBody);
      this.bodyMap.delete(entity.id);
    }
  }

  /**
   * Step physics with fixed timestep accumulator
   * This ensures physics behaves identically at 60fps, 120fps, 240fps, etc.
   * @param {number} dt - Actual frame delta time
   */
  step(dt) {
    if (!this.world || !this.initialized) return;

    this.accumulator += Math.min(dt, this.maxAccumulator);

    while (this.accumulator >= this.fixedDt) {
      this.world.step(this.eventQueue);
      this.accumulator -= this.fixedDt;
    }

    // Sync Three.js objects from Rapier
    this._syncBodies();

    // Collect collision events
    this._collectCollisions();

    // Update debug visualization
    if (this.debugVisible) {
      this._updateDebugDraw();
    }
  }

  /**
   * Synchronize Rapier body positions/rotations → Three.js Object3D
   */
  _syncBodies() {
    for (const [, data] of this.bodyMap) {
      const { rigidBody, entity } = data;
      const rb = entity.getComponent('RigidBody');
      if (!rb || rb.bodyType === 'static') continue;

      const pos = rigidBody.translation();
      const rot = rigidBody.rotation();

      // Update Three.js object directly
      // (Transform.position/rotation are getters to object3D, so this also syncs the component)
      entity.object3D.position.set(pos.x, pos.y, pos.z);
      entity.object3D.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    }
  }

  /**
   * Collect collision events from Rapier event queue
   */
  _collectCollisions() {
    this.collisionEvents = [];
    if (!this.eventQueue) return;

    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (!started) return; // Only collect collision start events for now

      // Find entities by collider handle
      let entity1 = null, entity2 = null;
      for (const [, data] of this.bodyMap) {
        if (data.collider.handle === handle1) entity1 = data.entity;
        if (data.collider.handle === handle2) entity2 = data.entity;
      }

      if (entity1 && entity2) {
        this.collisionEvents.push({ entity1, entity2 });
      }
    });
  }

  /**
   * Get collision events for a specific entity (called by ScriptRuntime)
   * @param {import('../Entity.js').Entity} entity
   * @returns {Array<import('../Entity.js').Entity>}
   */
  getCollisionsFor(entity) {
    const others = [];
    for (const event of this.collisionEvents) {
      if (event.entity1 === entity) others.push(event.entity2);
      else if (event.entity2 === entity) others.push(event.entity1);
    }
    return others;
  }

  /**
   * Create debug visualization group
   * @param {THREE.Scene} threeScene
   */
  initDebug(threeScene) {
    if (this.debugGroup) {
      threeScene.remove(this.debugGroup);
    }
    this.debugGroup = new THREE.Group();
    this.debugGroup.name = '__PhysicsDebug__';
    threeScene.add(this.debugGroup);
  }

  /**
   * Toggle debug visualization
   * @param {THREE.Scene} threeScene
   */
  toggleDebug(threeScene) {
    this.debugVisible = !this.debugVisible;
    if (this.debugVisible && !this.debugGroup) {
      this.initDebug(threeScene);
    }
    if (this.debugGroup) {
      this.debugGroup.visible = this.debugVisible;
    }
  }

  /**
   * Update debug wireframes for all colliders
   */
  _updateDebugDraw() {
    if (!this.debugGroup) return;

    // Clear old (dispose both the WireframeGeometry and any base geometry)
    while (this.debugGroup.children.length) {
      const child = this.debugGroup.children[0];
      this.debugGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    for (const [, data] of this.bodyMap) {
      const { rigidBody, entity, collider } = data;
      const col = entity.getComponent('Collider');
      if (!col) continue;

      const pos = rigidBody.translation();
      const rot = rigidBody.rotation();

      let geom;
      switch (col.shape) {
        case 'sphere':
          geom = new THREE.SphereGeometry(col.radius * Math.max(
            entity.getComponent('Transform')?.scale.x || 1,
            entity.getComponent('Transform')?.scale.y || 1,
            entity.getComponent('Transform')?.scale.z || 1
          ), 12, 8);
          break;
        case 'capsule': {
          const r = col.radius;
          const h = col.height * 0.5;
          geom = new THREE.CapsuleGeometry(r, h * 2, 4, 8);
          break;
        }
        case 'cylinder': {
          geom = new THREE.CylinderGeometry(col.radius, col.radius, col.height, 12);
          break;
        }
        default: { // box
          const s = entity.getComponent('Transform')?.scale || { x: 1, y: 1, z: 1 };
          geom = new THREE.BoxGeometry(
            col.size.x * s.x * 2,
            col.size.y * s.y * 2,
            col.size.z * s.z * 2
          );
          break;
        }
      }

      const material = col.isTrigger ? this._debugTriggerMaterial : this._debugMaterial;
      const wireGeom = new THREE.WireframeGeometry(geom);
      geom.dispose(); // dispose base geometry immediately after creating wireframe

      const wireframe = new THREE.LineSegments(wireGeom, material);
      wireframe.position.set(pos.x, pos.y, pos.z);
      wireframe.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      this.debugGroup.add(wireframe);
    }
  }

  /**
   * Reset & destroy the physics world
   */
  reset() {
    if (this.debugGroup) {
      while (this.debugGroup.children.length) {
        const child = this.debugGroup.children[0];
        this.debugGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
      }
      this.debugGroup.parent?.remove(this.debugGroup);
      this.debugGroup = null;
    }
    this.debugVisible = false;

    if (this.world) {
      this.world.free();
      this.world = null;
    }
    this.bodyMap.clear();
    this.collisionEvents = [];
    this.accumulator = 0;

    // Recreate world for next play
    this._createWorld();
  }

  /**
   * Expose RAPIER for external use
   */
  static get RAPIER() {
    return RAPIER;
  }
}
