import * as THREE from 'three';
import { Component } from '../Component.js';

/**
 * Light Component — Different light types
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

  /** @type {boolean} */
  castShadow = true;

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
        if (this.castShadow) {
          this.light.shadow.mapSize.width = 2048;
          this.light.shadow.mapSize.height = 2048;
          this.light.shadow.camera.near = 0.5;
          this.light.shadow.camera.far = 50;
          this.light.shadow.camera.left = -10;
          this.light.shadow.camera.right = 10;
          this.light.shadow.camera.top = 10;
          this.light.shadow.camera.bottom = -10;
        }
        break;
      case 'point':
        this.light = new THREE.PointLight(color, this.intensity, 20);
        this.light.castShadow = this.castShadow;
        break;
      case 'spot':
        this.light = new THREE.SpotLight(color, this.intensity);
        this.light.castShadow = this.castShadow;
        break;
      case 'ambient':
        this.light = new THREE.AmbientLight(color, this.intensity);
        break;
    }

    if (this.light && this.entity) {
      this.entity.object3D.add(this.light);
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      lightType: this.lightType,
      color: this.color,
      intensity: this.intensity,
      castShadow: this.castShadow,
    };
  }

  deserialize(data) {
    super.deserialize(data);
    this.configure(data.lightType || 'directional', {
      color: data.color,
      intensity: data.intensity,
      castShadow: data.castShadow,
    });
  }
}
