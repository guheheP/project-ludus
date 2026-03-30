import * as THREE from 'three';
import { Component } from '../engine/Component.js';

/**
 * EditableMesh Component — A mesh baked from ProceduralMesh, allowing vertex manipulation
 */
export class EditableMesh extends Component {
  static typeName = 'EditableMesh';

  /** @type {number[]} Flat array of vertex positions */
  positions = [];
  /** @type {number[]} Flat array of UVs */
  uvs = [];
  /** @type {number[]} Flat array of normals */
  normals = [];
  /** @type {number[]} Flat array of indices (if indexed) */
  indices = [];

  /** @type {number[]} Unique aggregated positions for simplified editing */
  uniquePositions = [];
  /** @type {number[][]} Mapping from unique vertex index to real vertex indices */
  uniqueMappings = [];

  /** @type {THREE.Mesh|null} */
  mesh = null;

  /** @type {string} */
  color = '#ffffff';

  /** @type {number} */
  metalness = 0.1;

  /** @type {number} */
  roughness = 0.6;

  /** @type {boolean} */
  wireframe = false;

  // Texture Maps
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

  onAttach() {
    if (this.positions.length > 0 && !this.mesh) {
      this.rebuild();
    }
  }

  onDetach() {
    this._disposeMesh();
  }

  /**
   * Convert from a THREE.BufferGeometry (like one from ProceduralMesh)
   * @param {THREE.BufferGeometry} geometry 
   * @param {object} materialOptions 
   */
  fromBufferGeometry(geometry, materialOptions = {}) {
    const pos = geometry.attributes.position;
    if (pos) this.positions = Array.from(pos.array);

    const uv = geometry.attributes.uv;
    if (uv) this.uvs = Array.from(uv.array);

    const norm = geometry.attributes.normal;
    if (norm) this.normals = Array.from(norm.array);

    const index = geometry.index;
    if (index) this.indices = Array.from(index.array);

    if (materialOptions.color) this.color = materialOptions.color;
    if (materialOptions.metalness !== undefined) this.metalness = materialOptions.metalness;
    if (materialOptions.roughness !== undefined) this.roughness = materialOptions.roughness;
    if (materialOptions.wireframe !== undefined) this.wireframe = materialOptions.wireframe;
    
    // Copy texture slots
    this.diffuseMapId = materialOptions.diffuseMapId || null;
    this.normalMapId = materialOptions.normalMapId || null;
    this.roughnessMapId = materialOptions.roughnessMapId || null;
    this.metalnessMapId = materialOptions.metalnessMapId || null;
    this.emissiveMapId = materialOptions.emissiveMapId || null;
    this.emissiveIntensity = materialOptions.emissiveIntensity || 0;
    this.emissiveColor = materialOptions.emissiveColor || '#000000';
    this.normalScale = materialOptions.normalScale !== undefined ? materialOptions.normalScale : 1.0;
    if (materialOptions.uvRepeat) this.uvRepeat = { ...materialOptions.uvRepeat };

    this._computeUniqueVertices();
    this.rebuild();
  }

  _computeUniqueVertices() {
    this.uniquePositions = [];
    this.uniqueMappings = [];

    const vertexMap = new Map();

    for (let i = 0; i < this.positions.length; i += 3) {
      const x = this.positions[i];
      const y = this.positions[i + 1];
      const z = this.positions[i + 2];
      
      const key = `${x.toFixed(4)}_${y.toFixed(4)}_${z.toFixed(4)}`;
      
      if (!vertexMap.has(key)) {
        const uniqueIndex = this.uniqueMappings.length;
        this.uniqueMappings.push([i / 3]);
        this.uniquePositions.push(x, y, z);
        vertexMap.set(key, uniqueIndex);
      } else {
        const uniqueIndex = vertexMap.get(key);
        this.uniqueMappings[uniqueIndex].push(i / 3);
      }
    }
  }

  rebuild() {
    this._disposeMesh();

    const geometry = new THREE.BufferGeometry();
    
    if (this.positions.length > 0) {
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.positions), 3));
    }
    if (this.uvs.length > 0) {
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uvs), 2));
    }
    if (this.normals.length > 0) {
      geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.normals), 3));
    } else {
      geometry.computeVertexNormals();
    }
    if (this.indices.length > 0) {
      geometry.setIndex(this.indices);
    }
    
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.color),
      metalness: this.metalness,
      roughness: this.roughness,
      wireframe: this.wireframe,
      flatShading: false,
      emissive: new THREE.Color(this.emissiveColor),
      emissiveIntensity: this.emissiveIntensity,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    if (this.entity) {
      this.mesh.userData.entityId = this.entity.id;
      this.entity.object3D.add(this.mesh);
    }
  }

  /**
   * Set vertex position at a specific unique index
   */
  setUniqueVertexPosition(uniqueIndex, x, y, z) {
    if (!this.mesh) return;

    // Update unique array
    this.uniquePositions[uniqueIndex * 3] = x;
    this.uniquePositions[uniqueIndex * 3 + 1] = y;
    this.uniquePositions[uniqueIndex * 3 + 2] = z;

    // Get real indices and update GPU buffer + positions array
    const realIndices = this.uniqueMappings[uniqueIndex];
    if (!realIndices) return;

    const positionAttribute = this.mesh.geometry.attributes.position;
    for (const realIndex of realIndices) {
      this.positions[realIndex * 3] = x;
      this.positions[realIndex * 3 + 1] = y;
      this.positions[realIndex * 3 + 2] = z;
      positionAttribute.setXYZ(realIndex, x, y, z);
    }
    
    positionAttribute.needsUpdate = true;

    // We defer normal/bounding updates if multiple vertices are dragged, 
    // but the editor TransformControls fires per frame, so we update here for visual feedback.
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingSphere();
    this.mesh.geometry.computeBoundingBox();

    // Sync normals back to our array
    const norm = this.mesh.geometry.attributes.normal;
    if (norm) {
      this.normals = Array.from(norm.array);
    }
  }

  /**
   * Find unique vertex indices that are symmetrical across given axes
   * @param {number} uIdx 
   * @param {{x:boolean, y:boolean, z:boolean}} symmetryMask 
   * @returns {Array<{index: number, scaleX: number, scaleY: number, scaleZ: number}>}
   */
  getSymmetricalUniqueIndices(uIdx, symmetryMask) {
    const results = [];
    if (!this.uniquePositions || this.uniquePositions.length === 0) return results;

    const bx = this.uniquePositions[uIdx * 3];
    const by = this.uniquePositions[uIdx * 3 + 1];
    const bz = this.uniquePositions[uIdx * 3 + 2];

    const flipX = symmetryMask.x ? [1, -1] : [1];
    const flipY = symmetryMask.y ? [1, -1] : [1];
    const flipZ = symmetryMask.z ? [1, -1] : [1];

    for (const fx of flipX) {
      for (const fy of flipY) {
        for (const fz of flipZ) {
          if (fx === 1 && fy === 1 && fz === 1) continue; // Original point
          
          const tx = bx * fx;
          const ty = by * fy;
          const tz = bz * fz;

          // Find the matching vertex index
          let bestIdx = -1;
          let minDistSq = Infinity;
          
          for (let i = 0; i < this.uniquePositions.length / 3; i++) {
              const x = this.uniquePositions[i * 3];
              const y = this.uniquePositions[i * 3 + 1];
              const z = this.uniquePositions[i * 3 + 2];
              const dSq = (x-tx)**2 + (y-ty)**2 + (z-tz)**2;
              if (dSq < minDistSq) {
                  minDistSq = dSq;
                  bestIdx = i;
              }
          }
          
          if (minDistSq < 0.0001) {
              results.push({
                index: bestIdx,
                scaleX: fx,
                scaleY: fy,
                scaleZ: fz
              });
          }
        }
      }
    }
    return results;
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
    for (const [, tex] of this._textureCache) {
      if (tex) tex.dispose();
    }
    this._textureCache.clear();
  }

  // Material property setters
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

  // Texture Methods (matching ProceduralMesh)
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

  serialize() {
    return {
      ...super.serialize(),
      positions: this.positions,
      uvs: this.uvs,
      normals: this.normals,
      indices: this.indices,
      uniquePositions: this.uniquePositions,
      uniqueMappings: this.uniqueMappings,
      color: this.color,
      metalness: this.metalness,
      roughness: this.roughness,
      wireframe: this.wireframe,
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
    if (data.positions) this.positions = data.positions;
    if (data.uvs) this.uvs = data.uvs;
    if (data.normals) this.normals = data.normals;
    if (data.indices) this.indices = data.indices;
    
    if (data.uniquePositions && data.uniqueMappings) {
      this.uniquePositions = data.uniquePositions;
      this.uniqueMappings = data.uniqueMappings;
    } else {
      this._computeUniqueVertices();
    }

    if (data.color) this.color = data.color;
    if (data.metalness !== undefined) this.metalness = data.metalness;
    if (data.roughness !== undefined) this.roughness = data.roughness;
    if (data.wireframe !== undefined) this.wireframe = data.wireframe;
    
    if (data.diffuseMapId) this.diffuseMapId = data.diffuseMapId;
    if (data.normalMapId) this.normalMapId = data.normalMapId;
    if (data.roughnessMapId) this.roughnessMapId = data.roughnessMapId;
    if (data.metalnessMapId) this.metalnessMapId = data.metalnessMapId;
    if (data.emissiveMapId) this.emissiveMapId = data.emissiveMapId;
    if (data.emissiveIntensity !== undefined) this.emissiveIntensity = data.emissiveIntensity;
    if (data.emissiveColor) this.emissiveColor = data.emissiveColor;
    if (data.normalScale !== undefined) this.normalScale = data.normalScale;
    if (data.uvRepeat) this.uvRepeat = { ...data.uvRepeat };

    // Rebuild mesh if already attached to an entity
    // (onAttach already ran but skipped rebuild because positions were empty at that time)
    if (this.entity && this.positions.length > 0) {
      this.rebuild();
    }
  }
}
