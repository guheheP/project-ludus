import * as THREE from 'three';

/**
 * EnvironmentSystem — Manages scene background, fog, and environment lighting
 *
 * Supports:
 * - Solid color background
 * - Gradient sky (top/bottom colors via a shader)
 * - Procedural sky presets
 * - Fog (linear or exponential)
 */
export class EnvironmentSystem {
  /** @type {THREE.Scene} */
  scene;

  /** @type {string} 'solid' | 'gradient' | 'sky' */
  backgroundType = 'solid';

  /** @type {string} Solid background color */
  backgroundColor = '#0f0f23';

  /** @type {string} Gradient top color */
  gradientTop = '#1a1a3e';

  /** @type {string} Gradient bottom color */
  gradientBottom = '#0f0f23';

  /** @type {string} Sky preset: 'day' | 'sunset' | 'night' | 'overcast' */
  skyPreset = 'day';

  /** @type {boolean} */
  fogEnabled = false;

  /** @type {string} 'linear' | 'exponential' */
  fogType = 'linear';

  /** @type {string} */
  fogColor = '#0f0f23';

  /** @type {number} Fog near (linear) */
  fogNear = 10;

  /** @type {number} Fog far (linear) */
  fogFar = 100;

  /** @type {number} Fog density (exponential) */
  fogDensity = 0.02;

  /** @type {THREE.Mesh|null} Sky dome mesh */
  _skyDome = null;

  /** @type {THREE.ShaderMaterial|null} */
  _skyMaterial = null;

  // Sky presets
  static SKY_PRESETS = {
    day: {
      topColor: '#4a90d9',
      bottomColor: '#87ceeb',
      sunColor: '#fffae6',
      sunIntensity: 1.0,
      horizonSharpness: 1.5,
    },
    sunset: {
      topColor: '#1a1a4e',
      bottomColor: '#ff6b35',
      sunColor: '#ff4500',
      sunIntensity: 0.8,
      horizonSharpness: 2.0,
    },
    night: {
      topColor: '#050510',
      bottomColor: '#0a0a1f',
      sunColor: '#aaccff',
      sunIntensity: 0.1,
      horizonSharpness: 1.0,
    },
    overcast: {
      topColor: '#6e7b8b',
      bottomColor: '#8899aa',
      sunColor: '#cccccc',
      sunIntensity: 0.5,
      horizonSharpness: 0.8,
    },
  };

  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Apply the current environment settings to the scene
   */
  apply() {
    this._applyBackground();
    this._applyFog();
  }

  _applyBackground() {
    // Remove existing sky dome
    if (this._skyDome) {
      this.scene.remove(this._skyDome);
      this._skyDome.geometry.dispose();
      this._skyMaterial?.dispose();
      this._skyDome = null;
      this._skyMaterial = null;
    }

    switch (this.backgroundType) {
      case 'solid':
        this.scene.background = new THREE.Color(this.backgroundColor);
        break;

      case 'gradient':
        this._createGradientBackground();
        break;

      case 'sky':
        this._createSkyBackground();
        break;
    }
  }

  _createGradientBackground() {
    // Create a canvas-based gradient texture
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, this.gradientTop);
    gradient.addColorStop(1, this.gradientBottom);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    this.scene.background = texture;
  }

  _createSkyBackground() {
    const preset = EnvironmentSystem.SKY_PRESETS[this.skyPreset] ||
                   EnvironmentSystem.SKY_PRESETS.day;

    // Create procedural sky using a large sphere with custom shader
    const skyGeo = new THREE.SphereGeometry(500, 32, 32);
    this._skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(preset.topColor) },
        bottomColor: { value: new THREE.Color(preset.bottomColor) },
        sunColor: { value: new THREE.Color(preset.sunColor) },
        sunIntensity: { value: preset.sunIntensity },
        horizonSharpness: { value: preset.horizonSharpness },
        offset: { value: 20 },
        exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 sunColor;
        uniform float sunIntensity;
        uniform float horizonSharpness;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          float t = max(pow(max(h, 0.0), exponent), 0.0);

          // Base gradient
          vec3 color = mix(bottomColor, topColor, t);

          // Horizon glow
          float horizonFactor = 1.0 - abs(h);
          horizonFactor = pow(horizonFactor, horizonSharpness * 3.0);
          color = mix(color, sunColor, horizonFactor * sunIntensity * 0.3);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });

    this._skyDome = new THREE.Mesh(skyGeo, this._skyMaterial);
    this._skyDome.renderOrder = -1000;
    this._skyDome.name = '__sky_dome__';
    this.scene.add(this._skyDome);
    this.scene.background = null; // Let sky dome render as background
  }

  _applyFog() {
    if (!this.fogEnabled) {
      this.scene.fog = null;
      return;
    }

    const fogColor = new THREE.Color(this.fogColor);

    if (this.fogType === 'linear') {
      this.scene.fog = new THREE.Fog(fogColor, this.fogNear, this.fogFar);
    } else {
      this.scene.fog = new THREE.FogExp2(fogColor, this.fogDensity);
    }
  }

  /**
   * Update sky dome position to follow camera
   * @param {THREE.Camera} camera
   */
  update(camera) {
    if (this._skyDome && camera) {
      this._skyDome.position.copy(camera.position);
    }
  }

  /**
   * Serialize environment settings
   * @returns {object}
   */
  serialize() {
    return {
      backgroundType: this.backgroundType,
      backgroundColor: this.backgroundColor,
      gradientTop: this.gradientTop,
      gradientBottom: this.gradientBottom,
      skyPreset: this.skyPreset,
      fogEnabled: this.fogEnabled,
      fogType: this.fogType,
      fogColor: this.fogColor,
      fogNear: this.fogNear,
      fogFar: this.fogFar,
      fogDensity: this.fogDensity,
    };
  }

  /**
   * Deserialize environment settings
   * @param {object} data
   */
  deserialize(data) {
    if (!data) return;
    if (data.backgroundType) this.backgroundType = data.backgroundType;
    if (data.backgroundColor) this.backgroundColor = data.backgroundColor;
    if (data.gradientTop) this.gradientTop = data.gradientTop;
    if (data.gradientBottom) this.gradientBottom = data.gradientBottom;
    if (data.skyPreset) this.skyPreset = data.skyPreset;
    if (data.fogEnabled !== undefined) this.fogEnabled = data.fogEnabled;
    if (data.fogType) this.fogType = data.fogType;
    if (data.fogColor) this.fogColor = data.fogColor;
    if (data.fogNear !== undefined) this.fogNear = data.fogNear;
    if (data.fogFar !== undefined) this.fogFar = data.fogFar;
    if (data.fogDensity !== undefined) this.fogDensity = data.fogDensity;
    this.apply();
  }

  dispose() {
    if (this._skyDome) {
      this.scene.remove(this._skyDome);
      this._skyDome.geometry.dispose();
      this._skyMaterial?.dispose();
      this._skyDome = null;
      this._skyMaterial = null;
    }
    this.scene.fog = null;
  }
}
