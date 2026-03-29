import { Component } from '../Component.js';

/**
 * Transform Component — Position, rotation, and scale
 * This component syncs with the entity's Three.js Object3D.
 */
export class Transform extends Component {
  static typeName = 'Transform';

  get position() {
    return this.entity.object3D.position;
  }

  get rotation() {
    return this.entity.object3D.rotation;
  }

  get scale() {
    return this.entity.object3D.scale;
  }

  get quaternion() {
    return this.entity.object3D.quaternion;
  }

  /**
   * Set position
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setPosition(x, y, z) {
    this.entity.object3D.position.set(x, y, z);
  }

  /**
   * Set rotation in degrees
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setRotationDeg(x, y, z) {
    const deg2rad = Math.PI / 180;
    this.entity.object3D.rotation.set(x * deg2rad, y * deg2rad, z * deg2rad);
  }

  /**
   * Set scale
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setScale(x, y, z) {
    this.entity.object3D.scale.set(x, y, z);
  }

  serialize() {
    return {
      ...super.serialize(),
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      rotation: { x: this.rotation.x, y: this.rotation.y, z: this.rotation.z },
      scale: { x: this.scale.x, y: this.scale.y, z: this.scale.z }
    };
  }

  deserialize(data) {
    super.deserialize(data);
    if (data.position) this.setPosition(data.position.x, data.position.y, data.position.z);
    if (data.rotation) this.entity.object3D.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
    if (data.scale) this.setScale(data.scale.x, data.scale.y, data.scale.z);
  }
}
