import * as THREE from 'three';
import { Component } from '../engine/Component.js';
import { TwistModifier } from './modifiers/Twist.js';
import { BendModifier } from './modifiers/Bend.js';
import { TaperModifier } from './modifiers/Taper.js';
import { NoiseModifier } from './modifiers/Noise.js';
import { SubdivideModifier } from './modifiers/Subdivide.js';

/**
 * Registry of available modifier types
 */
export const MODIFIER_TYPES = {
  Twist: TwistModifier,
  Bend: BendModifier,
  Taper: TaperModifier,
  Noise: NoiseModifier,
  Subdivide: SubdivideModifier,
};

/**
 * Geometry factory with configurable segments
 */
const createGeometry = (type, params, segmentMultiplier = 1) => {
  const m = segmentMultiplier;
  switch (type) {
    case 'box':
      return new THREE.BoxGeometry(
        params.width || 1, params.height || 1, params.depth || 1,
        Math.max(1, (params.widthSegments || 4) * m),
        Math.max(1, (params.heightSegments || 4) * m),
        Math.max(1, (params.depthSegments || 4) * m)
      );
    case 'sphere':
      return new THREE.SphereGeometry(
        params.radius || 0.5,
        Math.max(8, (params.widthSegments || 32) * m),
        Math.max(4, (params.heightSegments || 16) * m)
      );
    case 'cylinder':
      return new THREE.CylinderGeometry(
        params.radiusTop || 0.5, params.radiusBottom || 0.5,
        params.height || 1,
        Math.max(8, (params.radialSegments || 32) * m),
        Math.max(1, (params.heightSegments || 8) * m)
      );
    case 'cone':
      return new THREE.ConeGeometry(
        params.radius || 0.5, params.height || 1,
        Math.max(8, (params.radialSegments || 32) * m),
        Math.max(1, (params.heightSegments || 8) * m)
      );
    case 'torus':
      return new THREE.TorusGeometry(
        params.radius || 0.4, params.tube || 0.15,
        Math.max(8, (params.radialSegments || 16) * m),
        Math.max(16, (params.tubularSegments || 48) * m)
      );
    case 'plane':
      return new THREE.PlaneGeometry(
        params.width || 1, params.height || 1,
        Math.max(1, (params.widthSegments || 8) * m),
        Math.max(1, (params.heightSegments || 8) * m)
      );
    case 'capsule':
      return new THREE.CapsuleGeometry(
        params.radius || 0.3, params.length || 0.6,
        Math.max(4, (params.capSegments || 8) * m),
        Math.max(8, (params.radialSegments || 16) * m)
      );
    default:
      return new THREE.BoxGeometry(1, 1, 1, 4 * m, 4 * m, 4 * m);
  }
};

/**
 * Shape parameter definitions for the inspector UI
 */
export const SHAPE_PARAMS = {
  box: [
    { name: 'Width', key: 'width', type: 'number', default: 1, min: 0.01, max: 50, step: 0.1 },
    { name: 'Height', key: 'height', type: 'number', default: 1, min: 0.01, max: 50, step: 0.1 },
    { name: 'Depth', key: 'depth', type: 'number', default: 1, min: 0.01, max: 50, step: 0.1 },
  ],
  sphere: [
    { name: 'Radius', key: 'radius', type: 'number', default: 0.5, min: 0.01, max: 25, step: 0.05 },
  ],
  cylinder: [
    { name: 'Radius Top', key: 'radiusTop', type: 'number', default: 0.5, min: 0, max: 25, step: 0.05 },
    { name: 'Radius Bottom', key: 'radiusBottom', type: 'number', default: 0.5, min: 0, max: 25, step: 0.05 },
    { name: 'Height', key: 'height', type: 'number', default: 1, min: 0.01, max: 50, step: 0.1 },
  ],
  cone: [
    { name: 'Radius', key: 'radius', type: 'number', default: 0.5, min: 0.01, max: 25, step: 0.05 },
    { name: 'Height', key: 'height', type: 'number', default: 1, min: 0.01, max: 50, step: 0.1 },
  ],
  torus: [
    { name: 'Radius', key: 'radius', type: 'number', default: 0.4, min: 0.01, max: 25, step: 0.05 },
    { name: 'Tube', key: 'tube', type: 'number', default: 0.15, min: 0.01, max: 10, step: 0.01 },
  ],
  plane: [
    { name: 'Width', key: 'width', type: 'number', default: 1, min: 0.01, max: 100, step: 0.1 },
    { name: 'Height', key: 'height', type: 'number', default: 1, min: 0.01, max: 100, step: 0.1 },
  ],
  capsule: [
    { name: 'Radius', key: 'radius', type: 'number', default: 0.3, min: 0.01, max: 25, step: 0.05 },
    { name: 'Length', key: 'length', type: 'number', default: 0.6, min: 0, max: 50, step: 0.1 },
  ],
};

/**
 * ProceduralMesh Component — Manages a geometry with a non-destructive modifier stack
 *
 * Flow: Base Shape → [Subdivide] → [Modifier 1] → [Modifier 2] → ... → Final Mesh
 */
export class ProceduralMesh extends Component {
  static typeName = 'ProceduralMesh';

  /** @type {string} */
  shapeType = 'box';

  /** @type {object} */
  shapeParams = {};

  /** @type {import('./Modifier.js').Modifier[]} */
  modifiers = [];

  /** @type {THREE.Mesh|null} */
  mesh = null;

  /** @type {string} */
  color = '#5a7dd4';

  /** @type {number} */
  metalness = 0.1;

  /** @type {number} */
  roughness = 0.6;

  /** @type {boolean} */
  wireframe = false;

  // Phase 12B: Texture Maps
  /** @type {string|null} */ diffuseMapId = null;
  /** @type {string|null} */ normalMapId = null;
  /** @type {string|null} */ roughnessMapId = null;
  /** @type {string|null} */ metalnessMapId = null;
  /** @type {string|null} */ emissiveMapId = null;
  /** @type {number} */ emissiveIntensity = 0;
  /** @type {string} */ emissiveColor = '#000000';
  /** @type {number} */ normalScale = 1.0;
  /** @type {{x: number, y: number}} */ uvRepeat = { x: 1, y: 1 };
  /** @type {Map<string, THREE.Texture>} */ _textureCache = new Map();

  /**
   * Configure shape and rebuild
   * @param {string} shapeType
   * @param {object} shapeParams
   * @param {object} materialOptions
   */
  configure(shapeType, shapeParams = {}, materialOptions = {}) {
    this.shapeType = shapeType;
    // Fill in defaults
    const defaults = SHAPE_PARAMS[shapeType] || [];
    this.shapeParams = {};
    for (const p of defaults) {
      this.shapeParams[p.key] = shapeParams[p.key] !== undefined ? shapeParams[p.key] : p.default;
    }
    if (materialOptions.color) this.color = materialOptions.color;
    if (materialOptions.metalness !== undefined) this.metalness = materialOptions.metalness;
    if (materialOptions.roughness !== undefined) this.roughness = materialOptions.roughness;
    if (materialOptions.wireframe !== undefined) this.wireframe = materialOptions.wireframe;
    this.rebuild();
  }

  onAttach() {
    if (!this.mesh) {
      this.rebuild();
    }
  }

  onDetach() {
    this._disposeMesh();
  }

  /**
   * Add a modifier to the stack
   * @param {import('./Modifier.js').Modifier} modifier
   * @returns {import('./Modifier.js').Modifier}
   */
  addModifier(modifier) {
    this.modifiers.push(modifier);
    this.rebuild();
    return modifier;
  }

  /**
   * Remove a modifier by index
   * @param {number} index
   */
  removeModifier(index) {
    if (index >= 0 && index < this.modifiers.length) {
      this.modifiers.splice(index, 1);
      this.rebuild();
    }
  }

  /**
   * Move a modifier in the stack
   * @param {number} fromIndex
   * @param {number} toIndex
   */
  moveModifier(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.modifiers.length) return;
    if (toIndex < 0 || toIndex >= this.modifiers.length) return;
    const [mod] = this.modifiers.splice(fromIndex, 1);
    this.modifiers.splice(toIndex, 0, mod);
    this.rebuild();
  }

  /**
   * Rebuild the mesh with the current modifier stack
   */
  rebuild() {
    this._disposeMesh();

    // Calculate segment multiplier from Subdivide modifiers
    let segMult = 1;
    for (const mod of this.modifiers) {
      if (mod.enabled && mod instanceof SubdivideModifier) {
        segMult *= mod.getSegmentMultiplier();
      }
    }

    // Create base geometry with increased segments
    const geometry = createGeometry(this.shapeType, this.shapeParams, segMult);

    // Calculate bounds
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    const bounds = {
      min: { x: bb.min.x, y: bb.min.y, z: bb.min.z },
      max: { x: bb.max.x, y: bb.max.y, z: bb.max.z },
      center: {
        x: (bb.min.x + bb.max.x) / 2,
        y: (bb.min.y + bb.max.y) / 2,
        z: (bb.min.z + bb.max.z) / 2,
      },
      size: {
        x: bb.max.x - bb.min.x,
        y: bb.max.y - bb.min.y,
        z: bb.max.z - bb.min.z,
      },
    };

    // Apply modifier stack
    let positions = geometry.attributes.position.array;

    for (const mod of this.modifiers) {
      if (mod.enabled && !(mod instanceof SubdivideModifier)) {
        positions = mod.apply(positions, bounds);
      }
    }

    // Update geometry
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    // Create material
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.color),
      metalness: this.metalness,
      roughness: this.roughness,
      wireframe: this.wireframe,
      flatShading: false,
      emissive: new THREE.Color(this.emissiveColor),
      emissiveIntensity: this.emissiveIntensity,
    });

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    if (this.entity) {
      this.mesh.userData.entityId = this.entity.id;
      this.entity.object3D.add(this.mesh);
    }
  }

  _disposeMesh() {
    if (this.mesh) {
      if (this.entity) {
        this.entity.object3D.remove(this.mesh);
      }
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
    for (const [, tex] of this._textureCache) tex.dispose();
    this._textureCache.clear();
  }

  // Phase 12B: Texture methods (shared pattern with MeshRenderer)
  applyTexture(slot, url, assetId) {
    if (!this.mesh || !this.mesh.material) return;
    if (this._textureCache.has(assetId)) {
      this._setMaterialTexture(slot, this._textureCache.get(assetId));
      return;
    }
    const loader = new THREE.TextureLoader();
    loader.load(url, (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(this.uvRepeat.x, this.uvRepeat.y);
      texture.colorSpace = (slot === 'diffuse' || slot === 'emissive')
        ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
      texture.needsUpdate = true;
      this._textureCache.set(assetId, texture);
      this._setMaterialTexture(slot, texture);
    });
  }

  _setMaterialTexture(slot, texture) {
    if (!this.mesh?.material) return;
    const mat = this.mesh.material;
    switch (slot) {
      case 'diffuse': mat.map = texture; break;
      case 'normal': mat.normalMap = texture; mat.normalScale = new THREE.Vector2(this.normalScale, this.normalScale); break;
      case 'roughness': mat.roughnessMap = texture; break;
      case 'metalness': mat.metalnessMap = texture; break;
      case 'emissive': mat.emissiveMap = texture; mat.emissive = new THREE.Color(this.emissiveColor || '#ffffff'); mat.emissiveIntensity = this.emissiveIntensity || 1; break;
    }
    mat.needsUpdate = true;
  }

  removeTexture(slot) {
    if (!this.mesh?.material) return;
    const mat = this.mesh.material;
    switch (slot) {
      case 'diffuse': this.diffuseMapId = null; if (mat.map) { mat.map.dispose(); mat.map = null; } break;
      case 'normal': this.normalMapId = null; if (mat.normalMap) { mat.normalMap.dispose(); mat.normalMap = null; } break;
      case 'roughness': this.roughnessMapId = null; if (mat.roughnessMap) { mat.roughnessMap.dispose(); mat.roughnessMap = null; } break;
      case 'metalness': this.metalnessMapId = null; if (mat.metalnessMap) { mat.metalnessMap.dispose(); mat.metalnessMap = null; } break;
      case 'emissive': this.emissiveMapId = null; if (mat.emissiveMap) { mat.emissiveMap.dispose(); mat.emissiveMap = null; } break;
    }
    mat.needsUpdate = true;
  }

  updateUVRepeat() {
    for (const [, tex] of this._textureCache) {
      tex.repeat.set(this.uvRepeat.x, this.uvRepeat.y);
      tex.needsUpdate = true;
    }
  }

  async loadAllTextures(assetManager) {
    const slots = [
      { id: this.diffuseMapId, slot: 'diffuse' },
      { id: this.normalMapId, slot: 'normal' },
      { id: this.roughnessMapId, slot: 'roughness' },
      { id: this.metalnessMapId, slot: 'metalness' },
      { id: this.emissiveMapId, slot: 'emissive' },
    ];
    for (const { id, slot } of slots) {
      if (id) {
        const url = await assetManager.getAssetUrl(id);
        if (url) this.applyTexture(slot, url, id);
      }
    }
  }

  /**
   * Update material property
   */
  setColor(hex) {
    this.color = hex;
    if (this.mesh) this.mesh.material.color.set(hex);
  }

  setMetalness(val) {
    this.metalness = val;
    if (this.mesh) this.mesh.material.metalness = val;
  }

  setRoughness(val) {
    this.roughness = val;
    if (this.mesh) this.mesh.material.roughness = val;
  }

  setWireframe(val) {
    this.wireframe = val;
    if (this.mesh) this.mesh.material.wireframe = val;
  }

  /**
   * Schedule a rebuild on the next animation frame.
   * Batches multiple parameter changes within one frame into a single rebuild.
   */
  scheduleRebuild() {
    if (this._rebuildScheduled) return;
    this._rebuildScheduled = true;
    requestAnimationFrame(() => {
      this._rebuildScheduled = false;
      this.rebuild();
    });
  }

  /** @type {boolean} */
  _rebuildScheduled = false;

  /**
   * Update a shape parameter and schedule a debounced rebuild
   */
  setShapeParam(key, value) {
    this.shapeParams[key] = value;
    this.scheduleRebuild();
  }

  serialize() {
    return {
      ...super.serialize(),
      shapeType: this.shapeType,
      shapeParams: { ...this.shapeParams },
      modifiers: this.modifiers.map(m => m.serialize()),
      color: this.color,
      metalness: this.metalness,
      roughness: this.roughness,
      wireframe: this.wireframe,
      // Phase 12B
      diffuseMapId: this.diffuseMapId,
      normalMapId: this.normalMapId,
      roughnessMapId: this.roughnessMapId,
      metalnessMapId: this.metalnessMapId,
      emissiveMapId: this.emissiveMapId,
      emissiveIntensity: this.emissiveIntensity,
      emissiveColor: this.emissiveColor,
      normalScale: this.normalScale,
      uvRepeat: { ...this.uvRepeat },
    };
  }

  deserialize(data) {
    super.deserialize(data);
    // Restore modifiers
    this.modifiers = [];
    if (data.modifiers) {
      for (const modData of data.modifiers) {
        const ModClass = MODIFIER_TYPES[modData.type];
        if (ModClass) {
          const mod = new ModClass();
          mod.enabled = modData.enabled !== false;
          for (const param of mod.getParams()) {
            if (modData[param.key] !== undefined) {
              mod[param.key] = modData[param.key];
            }
          }
          this.modifiers.push(mod);
        }
      }
    }
    this.configure(data.shapeType, data.shapeParams, {
      color: data.color,
      metalness: data.metalness,
      roughness: data.roughness,
      wireframe: data.wireframe,
    });
    // Phase 12B: Restore texture IDs
    if (data.diffuseMapId) this.diffuseMapId = data.diffuseMapId;
    if (data.normalMapId) this.normalMapId = data.normalMapId;
    if (data.roughnessMapId) this.roughnessMapId = data.roughnessMapId;
    if (data.metalnessMapId) this.metalnessMapId = data.metalnessMapId;
    if (data.emissiveMapId) this.emissiveMapId = data.emissiveMapId;
    if (data.emissiveIntensity !== undefined) this.emissiveIntensity = data.emissiveIntensity;
    if (data.emissiveColor) this.emissiveColor = data.emissiveColor;
    if (data.normalScale !== undefined) this.normalScale = data.normalScale;
    if (data.uvRepeat) this.uvRepeat = { ...data.uvRepeat };
  }
}
