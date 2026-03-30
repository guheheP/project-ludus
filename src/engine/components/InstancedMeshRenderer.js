import * as THREE from 'three';
import { Component } from '../Component.js';

/**
 * Distribution patterns for instanced meshes
 */
export const DISTRIBUTION_PATTERNS = {
  grid: 'Grid',
  randomBox: 'Random Box',
  randomSphere: 'Random Sphere',
  circle: 'Circle',
};

/**
 * InstancedMeshRenderer — GPU instanced rendering of many identical shapes
 * Renders thousands of copies of the same mesh efficiently using THREE.InstancedMesh
 */
export class InstancedMeshRenderer extends Component {
  static typeName = 'InstancedMeshRenderer';

  /** @type {string} Base geometry shape */
  geometryType = 'box';

  /** @type {number} Number of instances */
  count = 100;

  /** @type {string} Distribution pattern */
  pattern = 'randomBox';

  /** @type {number} Spread area size */
  spread = 10;

  /** @type {number} Base scale for instances */
  baseScale = 1;

  /** @type {number} Random scale variation (0-1) */
  scaleVariation = 0.5;

  /** @type {string} Base color */
  color = '#4488ff';

  /** @type {number} Color hue variation (0-1) */
  colorVariation = 0.3;

  /** @type {number} Metalness */
  metalness = 0.1;

  /** @type {number} Roughness */
  roughness = 0.7;

  /** @type {boolean} Enable random rotation */
  randomRotation = true;

  /** @type {boolean} Cast shadow */
  castShadow = true;

  /** @type {boolean} Receive shadow */
  receiveShadow = true;

  /** @type {number} Random seed for reproducibility */
  seed = 42;

  /** @type {THREE.InstancedMesh|null} */
  _instancedMesh = null;

  /** @type {THREE.BufferGeometry|null} */
  _geometry = null;

  /** @type {THREE.Material|null} */
  _material = null;

  onAttach() {
    this._rebuild();
  }

  onDetach() {
    this._dispose();
  }

  /**
   * Build geometry and instanced mesh from configuration
   */
  _rebuild() {
    this._dispose();

    // Create geometry
    this._geometry = this._createGeometry();

    // Create material
    const baseColor = new THREE.Color(this.color);
    this._material = new THREE.MeshStandardMaterial({
      metalness: this.metalness,
      roughness: this.roughness,
    });

    // Create instanced mesh
    this._instancedMesh = new THREE.InstancedMesh(
      this._geometry,
      this._material,
      this.count
    );
    this._instancedMesh.castShadow = this.castShadow;
    this._instancedMesh.receiveShadow = this.receiveShadow;

    // Generate instance transforms and colors
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();

    // Seeded random for reproducibility
    let rng = this._seedRandom(this.seed);

    for (let i = 0; i < this.count; i++) {
      // Position
      const pos = this._getPosition(i, rng);
      position.set(pos.x, pos.y, pos.z);

      // Rotation
      if (this.randomRotation) {
        rotation.set(
          rng() * Math.PI * 2,
          rng() * Math.PI * 2,
          rng() * Math.PI * 2
        );
      } else {
        rotation.set(0, 0, 0);
      }
      quaternion.setFromEuler(rotation);

      // Scale
      const sv = this.scaleVariation;
      const s = this.baseScale * (1 - sv + rng() * sv * 2);
      scale.set(s, s, s);

      // Build matrix
      matrix.compose(position, quaternion, scale);
      this._instancedMesh.setMatrixAt(i, matrix);

      // Color
      color.set(this.color);
      if (this.colorVariation > 0) {
        const hsl = {};
        color.getHSL(hsl);
        hsl.h += (rng() - 0.5) * this.colorVariation;
        hsl.s = Math.max(0, Math.min(1, hsl.s + (rng() - 0.5) * this.colorVariation * 0.5));
        hsl.l = Math.max(0.05, Math.min(0.95, hsl.l + (rng() - 0.5) * this.colorVariation * 0.3));
        color.setHSL(hsl.h, hsl.s, hsl.l);
      }
      this._instancedMesh.setColorAt(i, color);
    }

    this._instancedMesh.instanceMatrix.needsUpdate = true;
    if (this._instancedMesh.instanceColor) {
      this._instancedMesh.instanceColor.needsUpdate = true;
    }

    // Add to entity
    if (this.entity) {
      this.entity.object3D.add(this._instancedMesh);
    }
  }

  _createGeometry() {
    switch (this.geometryType) {
      case 'box':
        return new THREE.BoxGeometry(1, 1, 1);
      case 'sphere':
        return new THREE.SphereGeometry(0.5, 12, 8);
      case 'cylinder':
        return new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
      case 'cone':
        return new THREE.ConeGeometry(0.5, 1, 12);
      case 'torus':
        return new THREE.TorusGeometry(0.4, 0.15, 8, 24);
      case 'plane':
        return new THREE.PlaneGeometry(1, 1);
      default:
        return new THREE.BoxGeometry(1, 1, 1);
    }
  }

  /**
   * Get position for instance based on pattern
   * @param {number} index
   * @param {function} rng - random number generator
   * @returns {{x: number, y: number, z: number}}
   */
  _getPosition(index, rng) {
    const s = this.spread;

    switch (this.pattern) {
      case 'grid': {
        const side = Math.ceil(Math.cbrt(this.count));
        const ix = index % side;
        const iy = Math.floor(index / side) % side;
        const iz = Math.floor(index / (side * side));
        const spacing = s / side;
        return {
          x: (ix - side / 2 + 0.5) * spacing,
          y: (iy - side / 2 + 0.5) * spacing,
          z: (iz - side / 2 + 0.5) * spacing,
        };
      }
      case 'randomBox':
        return {
          x: (rng() - 0.5) * s,
          y: (rng() - 0.5) * s,
          z: (rng() - 0.5) * s,
        };
      case 'randomSphere': {
        // Uniform sphere distribution
        const u = rng();
        const v = rng();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = Math.cbrt(rng()) * s * 0.5;
        return {
          x: r * Math.sin(phi) * Math.cos(theta),
          y: r * Math.sin(phi) * Math.sin(theta),
          z: r * Math.cos(phi),
        };
      }
      case 'circle': {
        const angle = (index / this.count) * Math.PI * 2;
        const radius = s * 0.5;
        return {
          x: Math.cos(angle) * radius,
          y: 0,
          z: Math.sin(angle) * radius,
        };
      }
      default:
        return { x: 0, y: 0, z: 0 };
    }
  }

  /**
   * Simple seeded PRNG (mulberry32)
   * @param {number} seed
   * @returns {function} - returns 0-1
   */
  _seedRandom(seed) {
    let s = seed | 0;
    return function() {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  _dispose() {
    if (this._instancedMesh) {
      if (this.entity) {
        this.entity.object3D.remove(this._instancedMesh);
      }
      this._instancedMesh.dispose();
      this._instancedMesh = null;
    }
    if (this._geometry) {
      this._geometry.dispose();
      this._geometry = null;
    }
    if (this._material) {
      this._material.dispose();
      this._material = null;
    }
  }

  /**
   * Rebuild after parameter change
   */
  rebuild() {
    if (this.entity) {
      this._rebuild();
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      geometryType: this.geometryType,
      count: this.count,
      pattern: this.pattern,
      spread: this.spread,
      baseScale: this.baseScale,
      scaleVariation: this.scaleVariation,
      color: this.color,
      colorVariation: this.colorVariation,
      metalness: this.metalness,
      roughness: this.roughness,
      randomRotation: this.randomRotation,
      castShadow: this.castShadow,
      receiveShadow: this.receiveShadow,
      seed: this.seed,
    };
  }

  deserialize(data) {
    super.deserialize(data);
    if (data.geometryType !== undefined) this.geometryType = data.geometryType;
    if (data.count !== undefined) this.count = data.count;
    if (data.pattern !== undefined) this.pattern = data.pattern;
    if (data.spread !== undefined) this.spread = data.spread;
    if (data.baseScale !== undefined) this.baseScale = data.baseScale;
    if (data.scaleVariation !== undefined) this.scaleVariation = data.scaleVariation;
    if (data.color !== undefined) this.color = data.color;
    if (data.colorVariation !== undefined) this.colorVariation = data.colorVariation;
    if (data.metalness !== undefined) this.metalness = data.metalness;
    if (data.roughness !== undefined) this.roughness = data.roughness;
    if (data.randomRotation !== undefined) this.randomRotation = data.randomRotation;
    if (data.castShadow !== undefined) this.castShadow = data.castShadow;
    if (data.receiveShadow !== undefined) this.receiveShadow = data.receiveShadow;
    if (data.seed !== undefined) this.seed = data.seed;
  }
}
