import { Component } from '../Component.js';

/**
 * Collider Component — Defines collision shape
 */
export class Collider extends Component {
  static typeName = 'Collider';

  /** @type {'box'|'sphere'|'capsule'|'cylinder'|'mesh'|'convex'} */
  shape = 'box';

  /** @type {{x: number, y: number, z: number}} Half-extents for box collider */
  size = { x: 0.5, y: 0.5, z: 0.5 };

  /** @type {number} Radius for sphere/capsule/cylinder */
  radius = 0.5;

  /** @type {number} Height for capsule/cylinder */
  height = 1.0;

  /** @type {number} Bounciness (0 = no bounce, 1 = perfect bounce) */
  restitution = 0.3;

  /** @type {number} Friction coefficient */
  friction = 0.5;

  /** @type {boolean} If true, acts as trigger (no physical response) */
  isTrigger = false;

  /** @type {any} Rapier collider reference (internal) */
  _rapierCollider = null;

  /**
   * Auto-fit collider to the entity's ProceduralMesh or MeshRenderer
   * Call this to match the collider shape to the visible geometry
   */
  autoFit() {
    if (!this.entity) return;

    const pm = this.entity.getComponent('ProceduralMesh');
    if (pm) {
      // Map shape type
      const shapeMap = {
        'box': 'box', 'sphere': 'sphere', 'cylinder': 'cylinder',
        'cone': 'cylinder', 'torus': 'mesh', 'plane': 'box', 'capsule': 'capsule',
      };
      this.shape = shapeMap[pm.shapeType] || 'box';

      // Estimate size from shape params
      switch (pm.shapeType) {
        case 'box': {
          const w = (pm.shapeParams.width || 1) * 0.5;
          const h = (pm.shapeParams.height || 1) * 0.5;
          const d = (pm.shapeParams.depth || 1) * 0.5;
          this.size = { x: w, y: h, z: d };
          break;
        }
        case 'sphere': {
          this.radius = pm.shapeParams.radius || 0.5;
          break;
        }
        case 'cylinder':
        case 'cone': {
          this.radius = pm.shapeParams.radiusTop || pm.shapeParams.radius || 0.5;
          this.height = pm.shapeParams.height || 1.0;
          break;
        }
        case 'capsule': {
          this.radius = pm.shapeParams.radius || 0.25;
          this.height = pm.shapeParams.length || 1.0;
          break;
        }
        case 'torus': {
          const tubeR = pm.shapeParams.tube || 0.2;
          const mainR = pm.shapeParams.radius || 0.5;
          this.radius = mainR + tubeR;
          break;
        }
        case 'plane': {
          const pw = (pm.shapeParams.width || 1) * 0.5;
          const ph = (pm.shapeParams.height || 1) * 0.5;
          this.shape = 'box';
          this.size = { x: pw, y: 0.05, z: ph }; // Prevent physics falling through 0-thickness
          break;
        }
      }
    } else if (this.entity.hasComponent('EditableMesh')) {
      this.shape = 'convex'; // Default to convex for edited meshes as it supports dynamics
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      shape: this.shape,
      size: { ...this.size },
      radius: this.radius,
      height: this.height,
      restitution: this.restitution,
      friction: this.friction,
      isTrigger: this.isTrigger,
    };
  }

  deserialize(data) {
    super.deserialize(data);
    this.shape = data.shape || 'box';
    if (data.size) this.size = { ...data.size };
    this.radius = data.radius ?? 0.5;
    this.height = data.height ?? 1.0;
    this.restitution = data.restitution ?? 0.3;
    this.friction = data.friction ?? 0.5;
    this.isTrigger = data.isTrigger || false;
  }
}
