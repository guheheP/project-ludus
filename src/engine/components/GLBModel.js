import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Component } from '../Component.js';

/**
 * GLBModel Component — Loads and displays a GLTF/GLB 3D model
 */

// Shared loader instances
let _gltfLoader = null;

function getGLTFLoader() {
  if (!_gltfLoader) {
    _gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    _gltfLoader.setDRACOLoader(dracoLoader);
  }
  return _gltfLoader;
}

export class GLBModel extends Component {
  static typeName = 'GLBModel';

  /** @type {string} AssetManager asset ID */
  assetId = '';

  /** @type {string} Display filename */
  fileName = '';

  /** @type {boolean} */
  castShadow = true;

  /** @type {boolean} */
  receiveShadow = true;

  /** @type {boolean} Auto-scale to fit within maxSize units */
  autoScale = true;

  /** @type {number} Max bounding box size when autoScale is true */
  maxSize = 2;

  /** @type {THREE.Group|null} The loaded model root (not serialized) */
  modelRoot = null;

  /** @type {boolean} Whether the model is loaded */
  loaded = false;

  /** @type {object} Model stats */
  stats = { vertices: 0, triangles: 0, materials: 0, meshes: 0 };

  // ---- Animation ----
  /** @type {THREE.AnimationMixer|null} */
  _mixer = null;

  /** @type {THREE.AnimationClip[]} */
  _clips = [];

  /** @type {THREE.AnimationAction|null} */
  _currentAction = null;

  /** @type {string} Name of currently playing clip */
  currentAnimation = '';

  /** @type {boolean} Whether animation is playing */
  animPlaying = false;

  /** @type {boolean} Loop animation */
  animLoop = true;

  /**
   * Load the model from AssetManager
   * @param {import('../AssetManager.js').AssetManager} assetManager
   * @returns {Promise<void>}
   */
  async loadFromAssetManager(assetManager) {
    if (!this.assetId) return;

    const url = await assetManager.getAssetUrl(this.assetId);
    if (!url) {
      console.warn(`GLBModel: Asset ${this.assetId} not found`);
      return;
    }

    return this._loadFromUrl(url);
  }

  /**
   * Load the model from a URL
   * @param {string} url 
   * @returns {Promise<void>}
   */
  async _loadFromUrl(url) {
    return new Promise((resolve, reject) => {
      const loader = getGLTFLoader();

      loader.load(
        url,
        (gltf) => {
          this._onModelLoaded(gltf);
          resolve();
        },
        undefined,
        (error) => {
          console.error('GLBModel: Failed to load', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Process the loaded GLTF data
   * @param {import('three/addons/loaders/GLTFLoader.js').GLTF} gltf 
   */
  _onModelLoaded(gltf) {
    // Clean up previous model
    this._cleanup();

    this.modelRoot = gltf.scene;

    // Calculate stats
    this._calculateStats();

    // Apply shadow settings
    this._applyShadowSettings();

    // Auto-scale
    if (this.autoScale) {
      this._autoFitScale();
    }

    // Add to entity's object3D
    if (this.entity) {
      this.entity.object3D.add(this.modelRoot);
    }

    // Setup animation mixer
    if (gltf.animations && gltf.animations.length > 0) {
      this._clips = gltf.animations;
      this._mixer = new THREE.AnimationMixer(this.modelRoot);
    }

    this.loaded = true;
  }

  /**
   * Auto-scale the model to fit within maxSize
   */
  _autoFitScale() {
    if (!this.modelRoot) return;

    const box = new THREE.Box3().setFromObject(this.modelRoot);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0 && maxDim !== this.maxSize) {
      const scale = this.maxSize / maxDim;
      this.modelRoot.scale.multiplyScalar(scale);
    }

    // Center the model
    const center = new THREE.Vector3();
    box.getCenter(center);
    this.modelRoot.position.sub(center.multiplyScalar(this.modelRoot.scale.x));
  }

  /**
   * Apply shadow settings to all meshes
   */
  _applyShadowSettings() {
    if (!this.modelRoot) return;

    this.modelRoot.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = this.castShadow;
        child.receiveShadow = this.receiveShadow;
      }
    });
  }

  /**
   * Calculate model statistics
   */
  _calculateStats() {
    if (!this.modelRoot) return;

    let vertices = 0, triangles = 0, meshes = 0;
    const materials = new Set();

    this.modelRoot.traverse((child) => {
      if (child.isMesh) {
        meshes++;
        const geo = child.geometry;
        if (geo) {
          vertices += geo.attributes.position ? geo.attributes.position.count : 0;
          triangles += geo.index ? geo.index.count / 3 : vertices / 3;
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => materials.add(m));
          } else {
            materials.add(child.material);
          }
        }
      }
    });

    this.stats = { vertices, triangles: Math.floor(triangles), materials: materials.size, meshes };
  }

  /**
   * Set shadow properties and update meshes
   * @param {boolean} cast
   * @param {boolean} receive
   */
  setShadow(cast, receive) {
    this.castShadow = cast;
    this.receiveShadow = receive;
    this._applyShadowSettings();
  }

  /**
   * Clean up loaded model resources
   */
  _cleanup() {
    if (this.modelRoot) {
      // Remove from parent
      if (this.modelRoot.parent) {
        this.modelRoot.parent.remove(this.modelRoot);
      }

      // Dispose all geometries, materials, textures
      this.modelRoot.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            for (const mat of materials) {
              // Dispose textures
              for (const key of Object.keys(mat)) {
                const value = mat[key];
                if (value && value.isTexture) {
                  value.dispose();
                }
              }
              mat.dispose();
            }
          }
        }
      });

      this.modelRoot = null;
      this.loaded = false;
      this.stats = { vertices: 0, triangles: 0, materials: 0, meshes: 0 };
    }
  }

  onDetach() {
    this._stopCurrentAnimation();
    this._cleanup();
  }

  // =============================================
  // Animation API
  // =============================================

  /**
   * List available animation clip names
   * @returns {string[]}
   */
  listAnimations() {
    return this._clips.map(c => c.name || `Clip ${this._clips.indexOf(c)}`);
  }

  /**
   * Play an animation clip by name or index
   * @param {string|number} nameOrIndex
   */
  playAnimation(nameOrIndex) {
    if (!this._mixer || this._clips.length === 0) return;

    let clip;
    if (typeof nameOrIndex === 'number') {
      clip = this._clips[nameOrIndex];
    } else {
      clip = this._clips.find(c => c.name === nameOrIndex);
    }
    if (!clip) clip = this._clips[0];

    this._stopCurrentAnimation();

    this._currentAction = this._mixer.clipAction(clip);
    this._currentAction.setLoop(
      this.animLoop ? THREE.LoopRepeat : THREE.LoopOnce
    );
    if (!this.animLoop) {
      this._currentAction.clampWhenFinished = true;
    }
    this._currentAction.play();
    this.currentAnimation = clip.name || `Clip ${this._clips.indexOf(clip)}`;
    this.animPlaying = true;
  }

  /**
   * Stop the current animation
   */
  stopAnimation() {
    this._stopCurrentAnimation();
    this.animPlaying = false;
    this.currentAnimation = '';
  }

  _stopCurrentAnimation() {
    if (this._currentAction) {
      this._currentAction.stop();
      this._currentAction = null;
    }
  }

  /**
   * Update animation mixer (call each frame)
   * @param {number} dt
   */
  updateAnimation(dt) {
    if (this._mixer && this.animPlaying) {
      this._mixer.update(dt);
    }
  }

  serialize() {
    return {
      assetId: this.assetId,
      fileName: this.fileName,
      castShadow: this.castShadow,
      receiveShadow: this.receiveShadow,
      autoScale: this.autoScale,
      maxSize: this.maxSize,
      currentAnimation: this.currentAnimation,
      animPlaying: this.animPlaying,
      animLoop: this.animLoop,
    };
  }

  deserialize(data) {
    if (!data) return;
    this.assetId = data.assetId || '';
    this.fileName = data.fileName || '';
    this.castShadow = data.castShadow !== undefined ? data.castShadow : true;
    this.receiveShadow = data.receiveShadow !== undefined ? data.receiveShadow : true;
    this.autoScale = data.autoScale !== undefined ? data.autoScale : true;
    this.maxSize = data.maxSize || 2;
    this.currentAnimation = data.currentAnimation || '';
    this.animPlaying = data.animPlaying || false;
    this.animLoop = data.animLoop !== undefined ? data.animLoop : true;
  }
}
