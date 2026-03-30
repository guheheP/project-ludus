import * as THREE from 'three';
import { Component } from '../Component.js';

/**
 * Light Component — Different light types with configurable shadows
 */
export class Light extends Component {
  static typeName = 'Light';

  /** @type {string} */
  lightType = 'directional';

  /** @type {string} */
  color = '#ffffff';

  /** @type {number} */
  intensity = 1.0;

  /** @type {THREE.Light|null} */
  light = null;

  // Shadow settings
  /** @type {boolean} */
  castShadow = true;

  /** @type {number} Shadow map resolution (512, 1024, 2048, 4096) */
  shadowMapSize = 2048;

  /** @type {number} Shadow bias to reduce shadow acne */
  shadowBias = -0.0001;

  /** @type {number} Normal bias for curved surfaces */
  shadowNormalBias = 0.02;

  /** @type {number} Shadow blur radius (PCFSoft only) */
  shadowRadius = 1;

  /** @type {number} Shadow camera near plane */
  shadowNear = 0.5;

  /** @type {number} Shadow camera far plane */
  shadowFar = 50;

  /** @type {number} Shadow camera frustum size (directional light) */
  shadowSize = 15;

  /**
   * @param {string} type - 'directional', 'point', 'spot', 'ambient'
   * @param {object} options
   */
  configure(type = 'directional', options = {}) {
    this.lightType = type;
    if (options.color) this.color = options.color;
    if (options.intensity !== undefined) this.intensity = options.intensity;
    if (options.castShadow !== undefined) this.castShadow = options.castShadow;
    this._buildLight();
  }

  onAttach() {
    if (!this.light) {
      this._buildLight();
    }
  }

  onDetach() {
    if (this.light && this.entity) {
      this.entity.object3D.remove(this.light);
      this.light.dispose();
      this.light = null;
    }
  }

  _buildLight() {
    if (this.light && this.entity) {
      this.entity.object3D.remove(this.light);
      this.light.dispose();
    }

    const color = new THREE.Color(this.color);

    switch (this.lightType) {
      case 'directional':
        this.light = new THREE.DirectionalLight(color, this.intensity);
        this.light.castShadow = this.castShadow;
        this._applyShadowSettings();
        break;
      case 'point':
        this.light = new THREE.PointLight(color, this.intensity, 20);
        this.light.castShadow = this.castShadow;
        this._applyShadowSettings();
        break;
      case 'spot':
        this.light = new THREE.SpotLight(color, this.intensity);
        this.light.castShadow = this.castShadow;
        this._applyShadowSettings();
        break;
      case 'ambient':
        this.light = new THREE.AmbientLight(color, this.intensity);
        break;
    }

    if (this.light && this.entity) {
      this.entity.object3D.add(this.light);
    }
  }

  /**
   * Apply shadow settings to the current light
   */
  _applyShadowSettings() {
    if (!this.light || !this.light.shadow) return;

    const shadow = this.light.shadow;
    shadow.mapSize.width = this.shadowMapSize;
    shadow.mapSize.height = this.shadowMapSize;
    shadow.bias = this.shadowBias;
    shadow.normalBias = this.shadowNormalBias;
    shadow.radius = this.shadowRadius;

    if (this.lightType === 'directional') {
      shadow.camera.near = this.shadowNear;
      shadow.camera.far = this.shadowFar;
      shadow.camera.left = -this.shadowSize;
      shadow.camera.right = this.shadowSize;
      shadow.camera.top = this.shadowSize;
      shadow.camera.bottom = -this.shadowSize;
    } else {
      shadow.camera.near = this.shadowNear;
      shadow.camera.far = this.shadowFar;
    }

    // Force shadow map regeneration if it exists
    if (shadow.map) {
      shadow.map.dispose();
      shadow.map = null;
    }
  }

  /**
   * Update shadow settings without rebuilding the entire light
   */
  updateShadow() {
    if (!this.light) return;
    this.light.castShadow = this.castShadow;
    this._applyShadowSettings();
  }

  serialize() {
    return {
      ...super.serialize(),
      lightType: this.lightType,
      color: this.color,
      intensity: this.intensity,
      castShadow: this.castShadow,
      shadowMapSize: this.shadowMapSize,
      shadowBias: this.shadowBias,
      shadowNormalBias: this.shadowNormalBias,
      shadowRadius: this.shadowRadius,
      shadowNear: this.shadowNear,
      shadowFar: this.shadowFar,
      shadowSize: this.shadowSize,
    };
  }

  deserialize(data) {
    super.deserialize(data);
    if (data.shadowMapSize !== undefined) this.shadowMapSize = data.shadowMapSize;
    if (data.shadowBias !== undefined) this.shadowBias = data.shadowBias;
    if (data.shadowNormalBias !== undefined) this.shadowNormalBias = data.shadowNormalBias;
    if (data.shadowRadius !== undefined) this.shadowRadius = data.shadowRadius;
    if (data.shadowNear !== undefined) this.shadowNear = data.shadowNear;
    if (data.shadowFar !== undefined) this.shadowFar = data.shadowFar;
    if (data.shadowSize !== undefined) this.shadowSize = data.shadowSize;
    this.configure(data.lightType || 'directional', {
      color: data.color,
      intensity: data.intensity,
      castShadow: data.castShadow,
    });
  }
}

