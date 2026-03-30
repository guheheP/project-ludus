import * as THREE from 'three';
import { Component } from '../Component.js';

/**
 * MeshRenderer Component — Renders a mesh with a material
 * Phase 12B: Added texture map support (diffuse, normal, roughness, metalness, emissive)
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

  // =============================================
  // Phase 12B: Texture Map IDs (asset IDs)
  // =============================================

  /** @type {string|null} Diffuse/albedo texture asset ID */
  diffuseMapId = null;

  /** @type {string|null} Normal map asset ID */
  normalMapId = null;

  /** @type {string|null} Roughness map asset ID */
  roughnessMapId = null;

  /** @type {string|null} Metalness map asset ID */
  metalnessMapId = null;

  /** @type {string|null} Emissive map asset ID */
  emissiveMapId = null;

  /** @type {number} Emissive intensity */
  emissiveIntensity = 0;

  /** @type {string} Emissive color */
  emissiveColor = '#000000';

  /** @type {number} Normal map intensity (0-2) */
  normalScale = 1.0;

  /** @type {{x: number, y: number}} UV repeat */
  uvRepeat = { x: 1, y: 1 };

  // Cached textures (not serialized)
  /** @type {Map<string, THREE.Texture>} */
  _textureCache = new Map();

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
    // Dispose cached textures
    for (const [, tex] of this._textureCache) {
      tex.dispose();
    }
    this._textureCache.clear();
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
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.color),
      wireframe: this.wireframe,
      metalness: this.metalness,
      roughness: this.roughness,
      emissive: new THREE.Color(this.emissiveColor),
      emissiveIntensity: this.emissiveIntensity,
    });

    // Apply normal scale
    if (this.normalScale !== 1.0) {
      mat.normalScale = new THREE.Vector2(this.normalScale, this.normalScale);
    }

    return mat;
  }

  // =============================================
  // Phase 12B: Texture Loading
  // =============================================

  /**
   * Load and apply a texture from an asset URL
   * @param {'diffuse'|'normal'|'roughness'|'metalness'|'emissive'} slot
   * @param {string} url - Object URL or data URL
   * @param {string} assetId - Asset ID for caching
   */
  applyTexture(slot, url, assetId) {
    if (!this.mesh || !this.mesh.material) return;

    // Check cache
    if (this._textureCache.has(assetId)) {
      this._setMaterialTexture(slot, this._textureCache.get(assetId));
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.load(url, (texture) => {
      // Configure texture
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(this.uvRepeat.x, this.uvRepeat.y);
      texture.colorSpace = (slot === 'diffuse' || slot === 'emissive')
        ? THREE.SRGBColorSpace
        : THREE.LinearSRGBColorSpace;
      texture.needsUpdate = true;

      this._textureCache.set(assetId, texture);
      this._setMaterialTexture(slot, texture);
    });
  }

  /**
   * Set a texture on the material
   * @param {string} slot
   * @param {THREE.Texture} texture
   */
  _setMaterialTexture(slot, texture) {
    if (!this.mesh?.material) return;
    const mat = this.mesh.material;

    switch (slot) {
      case 'diffuse':
        mat.map = texture;
        break;
      case 'normal':
        mat.normalMap = texture;
        mat.normalScale = new THREE.Vector2(this.normalScale, this.normalScale);
        break;
      case 'roughness':
        mat.roughnessMap = texture;
        break;
      case 'metalness':
        mat.metalnessMap = texture;
        break;
      case 'emissive':
        mat.emissiveMap = texture;
        mat.emissive = new THREE.Color(this.emissiveColor || '#ffffff');
        mat.emissiveIntensity = this.emissiveIntensity || 1;
        break;
    }
    mat.needsUpdate = true;
  }

  /**
   * Remove a texture from a slot
   * @param {'diffuse'|'normal'|'roughness'|'metalness'|'emissive'} slot
   */
  removeTexture(slot) {
    if (!this.mesh?.material) return;
    const mat = this.mesh.material;

    switch (slot) {
      case 'diffuse':
        this.diffuseMapId = null;
        if (mat.map) { mat.map.dispose(); mat.map = null; }
        break;
      case 'normal':
        this.normalMapId = null;
        if (mat.normalMap) { mat.normalMap.dispose(); mat.normalMap = null; }
        break;
      case 'roughness':
        this.roughnessMapId = null;
        if (mat.roughnessMap) { mat.roughnessMap.dispose(); mat.roughnessMap = null; }
        break;
      case 'metalness':
        this.metalnessMapId = null;
        if (mat.metalnessMap) { mat.metalnessMap.dispose(); mat.metalnessMap = null; }
        break;
      case 'emissive':
        this.emissiveMapId = null;
        if (mat.emissiveMap) { mat.emissiveMap.dispose(); mat.emissiveMap = null; }
        break;
    }
    mat.needsUpdate = true;
  }

  /**
   * Update UV repeat on all loaded textures
   */
  updateUVRepeat() {
    for (const [, tex] of this._textureCache) {
      tex.repeat.set(this.uvRepeat.x, this.uvRepeat.y);
      tex.needsUpdate = true;
    }
  }

  /**
   * Reload all textures from asset manager
   * @param {import('../AssetManager.js').AssetManager} assetManager
   */
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
        if (url) {
          this.applyTexture(slot, url, id);
        }
      }
    }
  }

  // =============================================
  // Setters
  // =============================================

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

  // =============================================
  // Serialization
  // =============================================

  serialize() {
    return {
      ...super.serialize(),
      geometryType: this.geometryType,
      geometryParams: { ...this.geometryParams },
      color: this.color,
      wireframe: this.wireframe,
      metalness: this.metalness,
      roughness: this.roughness,
      // Phase 12B: Texture map IDs
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

    // Phase 12B: Texture properties
    if (data.diffuseMapId) this.diffuseMapId = data.diffuseMapId;
    if (data.normalMapId) this.normalMapId = data.normalMapId;
    if (data.roughnessMapId) this.roughnessMapId = data.roughnessMapId;
    if (data.metalnessMapId) this.metalnessMapId = data.metalnessMapId;
    if (data.emissiveMapId) this.emissiveMapId = data.emissiveMapId;
    if (data.emissiveIntensity !== undefined) this.emissiveIntensity = data.emissiveIntensity;
    if (data.emissiveColor) this.emissiveColor = data.emissiveColor;
    if (data.normalScale !== undefined) this.normalScale = data.normalScale;
    if (data.uvRepeat) this.uvRepeat = { ...data.uvRepeat };

    this.configure(data.geometryType, data.geometryParams, {
      color: data.color,
      wireframe: data.wireframe,
      metalness: data.metalness,
      roughness: data.roughness,
    });
  }
}

export { GEOMETRY_TYPES };
