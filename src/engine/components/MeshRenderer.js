import * as THREE from 'three';
import { Component } from '../Component.js';

/**
 * MeshRenderer Component — Renders a mesh with a material
 */

// Geometry factory
const GEOMETRY_TYPES = {
  box: (params = {}) => new THREE.BoxGeometry(
    params.width || 1, params.height || 1, params.depth || 1,
    params.widthSegments || 1, params.heightSegments || 1, params.depthSegments || 1
  ),
  sphere: (params = {}) => new THREE.SphereGeometry(
    params.radius || 0.5, params.widthSegments || 32, params.heightSegments || 16
  ),
  cylinder: (params = {}) => new THREE.CylinderGeometry(
    params.radiusTop || 0.5, params.radiusBottom || 0.5, params.height || 1,
    params.radialSegments || 32
  ),
  cone: (params = {}) => new THREE.ConeGeometry(
    params.radius || 0.5, params.height || 1, params.radialSegments || 32
  ),
  torus: (params = {}) => new THREE.TorusGeometry(
    params.radius || 0.4, params.tube || 0.15,
    params.radialSegments || 16, params.tubularSegments || 48
  ),
  plane: (params = {}) => new THREE.PlaneGeometry(
    params.width || 1, params.height || 1,
    params.widthSegments || 1, params.heightSegments || 1
  ),
  capsule: (params = {}) => new THREE.CapsuleGeometry(
    params.radius || 0.3, params.length || 0.6,
    params.capSegments || 8, params.radialSegments || 16
  ),
};

export class MeshRenderer extends Component {
  static typeName = 'MeshRenderer';

  /** @type {string} */
  geometryType = 'box';

  /** @type {object} */
  geometryParams = {};

  /** @type {THREE.Mesh|null} */
  mesh = null;

  /** @type {string} */
  materialType = 'standard';

  /** @type {string} */
  color = '#5a7dd4';

  /** @type {boolean} */
  wireframe = false;

  /** @type {number} */
  metalness = 0.1;

  /** @type {number} */
  roughness = 0.6;

  /**
   * @param {string} geometryType
   * @param {object} geometryParams
   * @param {object} materialOptions
   */
  configure(geometryType = 'box', geometryParams = {}, materialOptions = {}) {
    this.geometryType = geometryType;
    this.geometryParams = { ...geometryParams };
    if (materialOptions.color) this.color = materialOptions.color;
    if (materialOptions.wireframe !== undefined) this.wireframe = materialOptions.wireframe;
    if (materialOptions.metalness !== undefined) this.metalness = materialOptions.metalness;
    if (materialOptions.roughness !== undefined) this.roughness = materialOptions.roughness;
    if (materialOptions.materialType) this.materialType = materialOptions.materialType;
    this._buildMesh();
  }

  onAttach() {
    if (!this.mesh) {
      this._buildMesh();
    }
  }

  onDetach() {
    if (this.mesh) {
      this.entity.object3D.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
  }

  _buildMesh() {
    // Remove old mesh
    if (this.mesh && this.entity) {
      this.entity.object3D.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }

    const geometryFactory = GEOMETRY_TYPES[this.geometryType];
    if (!geometryFactory) {
      console.warn(`Unknown geometry type: ${this.geometryType}`);
      return;
    }

    const geometry = geometryFactory(this.geometryParams);
    const material = this._createMaterial();
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.entityId = this.entity?.id;

    if (this.entity) {
      this.entity.object3D.add(this.mesh);
    }
  }

  _createMaterial() {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.color),
      wireframe: this.wireframe,
      metalness: this.metalness,
      roughness: this.roughness,
    });
  }

  /**
   * Update material color
   * @param {string} hexColor
   */
  setColor(hexColor) {
    this.color = hexColor;
    if (this.mesh) {
      this.mesh.material.color.set(hexColor);
    }
  }

  /**
   * Rebuild geometry with new type/params
   * @param {string} type
   * @param {object} params
   */
  setGeometry(type, params = {}) {
    this.geometryType = type;
    this.geometryParams = { ...params };
    this._buildMesh();
  }

  serialize() {
    return {
      ...super.serialize(),
      geometryType: this.geometryType,
      geometryParams: { ...this.geometryParams },
      color: this.color,
      wireframe: this.wireframe,
      metalness: this.metalness,
      roughness: this.roughness,
    };
  }

  deserialize(data) {
    super.deserialize(data);
    this.configure(data.geometryType, data.geometryParams, {
      color: data.color,
      wireframe: data.wireframe,
      metalness: data.metalness,
      roughness: data.roughness,
    });
  }
}

export { GEOMETRY_TYPES };
