import { Component } from '../Component.js';

/**
 * RigidBody Component — Defines physics body behavior
 */
export class RigidBody extends Component {
  static typeName = 'RigidBody';

  /** @type {'dynamic'|'static'|'kinematic'} */
  bodyType = 'dynamic';

  /** @type {number} Mass in kg */
  mass = 1.0;

  /** @type {number} Gravity multiplier (0 = no gravity) */
  gravityScale = 1.0;

  /** @type {number} Linear velocity damping */
  linearDamping = 0.0;

  /** @type {number} Angular velocity damping */
  angularDamping = 0.05;

  /** @type {{x: boolean, y: boolean, z: boolean}} Lock rotation axes */
  lockRotation = { x: false, y: false, z: false };

  /** @type {any} Rapier rigid body reference (internal) */
  _rapierBody = null;

  // ----- API methods (available during play mode) -----

  /**
   * Apply a force at center of mass
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  addForce(x, y, z) {
    if (this._rapierBody) {
      this._rapierBody.addForce({ x, y, z }, true);
    }
  }

  /**
   * Apply an impulse at center of mass
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  addImpulse(x, y, z) {
    if (this._rapierBody) {
      this._rapierBody.applyImpulse({ x, y, z }, true);
    }
  }

  /**
   * Set linear velocity
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setVelocity(x, y, z) {
    if (this._rapierBody) {
      this._rapierBody.setLinvel({ x, y, z }, true);
    }
  }

  /**
   * Get linear velocity
   * @returns {{x: number, y: number, z: number}}
   */
  getVelocity() {
    if (this._rapierBody) {
      const v = this._rapierBody.linvel();
      return { x: v.x, y: v.y, z: v.z };
    }
    return { x: 0, y: 0, z: 0 };
  }

  /**
   * Set angular velocity
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setAngularVelocity(x, y, z) {
    if (this._rapierBody) {
      this._rapierBody.setAngvel({ x, y, z }, true);
    }
  }

  /**
   * Get angular velocity
   * @returns {{x: number, y: number, z: number}}
   */
  getAngularVelocity() {
    if (this._rapierBody) {
      const v = this._rapierBody.angvel();
      return { x: v.x, y: v.y, z: v.z };
    }
    return { x: 0, y: 0, z: 0 };
  }

  /**
   * Set the translation (position) of the rigid body.
   * For kinematic bodies uses setNextKinematicTranslation;
   * for dynamic bodies uses setTranslation directly.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setTranslation(x, y, z) {
    if (!this._rapierBody) return;
    if (this.bodyType === 'kinematic') {
      this._rapierBody.setNextKinematicTranslation({ x, y, z });
    } else {
      this._rapierBody.setTranslation({ x, y, z }, true);
    }
  }

  /**
   * Set the rotation of the rigid body as a quaternion.
   * For kinematic bodies uses setNextKinematicRotation.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} w
   */
  setRotation(x, y, z, w) {
    if (!this._rapierBody) return;
    if (this.bodyType === 'kinematic') {
      this._rapierBody.setNextKinematicRotation({ x, y, z, w });
    } else {
      this._rapierBody.setRotation({ x, y, z, w }, true);
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      bodyType: this.bodyType,
      mass: this.mass,
      gravityScale: this.gravityScale,
      linearDamping: this.linearDamping,
      angularDamping: this.angularDamping,
      lockRotation: { ...this.lockRotation },
    };
  }

  deserialize(data) {
    super.deserialize(data);
    this.bodyType = data.bodyType || 'dynamic';
    this.mass = data.mass ?? 1.0;
    this.gravityScale = data.gravityScale ?? 1.0;
    this.linearDamping = data.linearDamping ?? 0.0;
    this.angularDamping = data.angularDamping ?? 0.05;
    if (data.lockRotation) {
      this.lockRotation = { ...data.lockRotation };
    }
  }
}
