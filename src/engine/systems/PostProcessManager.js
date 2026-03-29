import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

/**
 * Vignette Shader
 */
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.0 },
    darkness: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
      float vignette = clamp(1.0 - dot(uv, uv), 0.0, 1.0);
      texel.rgb *= mix(1.0, vignette, darkness);
      gl_FragColor = texel;
    }
  `,
};

/**
 * Color Grading Shader (Brightness / Contrast / Saturation)
 */
const ColorGradingShader = {
  uniforms: {
    tDiffuse: { value: null },
    brightness: { value: 0.0 },
    contrast: { value: 0.0 },
    saturation: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float brightness;
    uniform float contrast;
    uniform float saturation;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      // Brightness
      texel.rgb += brightness;
      // Contrast
      texel.rgb = (texel.rgb - 0.5) * (1.0 + contrast) + 0.5;
      // Saturation
      float grey = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
      texel.rgb = mix(vec3(grey), texel.rgb, 1.0 + saturation);
      gl_FragColor = texel;
    }
  `,
};

/**
 * PostProcessManager — Manages all post-processing effects
 */
export class PostProcessManager {
  /** @type {EffectComposer|null} */
  composer = null;

  /** @type {THREE.WebGLRenderer} */
  renderer;

  /** @type {boolean} */
  enabled = true;

  // --- Effect settings ---
  /** @type {boolean} */
  bloomEnabled = true;
  /** @type {number} Bloom intensity (0-3) */
  bloomStrength = 0.4;
  /** @type {number} Bloom radius (0-1) */
  bloomRadius = 0.4;
  /** @type {number} Bloom threshold (0-1) */
  bloomThreshold = 0.85;

  /** @type {boolean} */
  ssaoEnabled = false;
  /** @type {number} SSAO kernel radius */
  ssaoRadius = 8;
  /** @type {number} SSAO min distance */
  ssaoMinDistance = 0.005;
  /** @type {number} SSAO max distance */
  ssaoMaxDistance = 0.1;

  /** @type {boolean} */
  vignetteEnabled = true;
  /** @type {number} Vignette offset (0.5 - 2) */
  vignetteOffset = 1.0;
  /** @type {number} Vignette darkness (0 - 2) */
  vignetteDarkness = 0.6;

  /** @type {boolean} */
  colorGradingEnabled = false;
  /** @type {number} Brightness (-1 to 1) */
  brightness = 0.0;
  /** @type {number} Contrast (-1 to 1) */
  contrast = 0.0;
  /** @type {number} Saturation (-1 to 1) */
  saturation = 0.0;

  // Internal passes
  _renderPass = null;
  _bloomPass = null;
  _ssaoPass = null;
  _vignettePass = null;
  _colorGradingPass = null;
  _outputPass = null;

  /**
   * Initialize the post-processing pipeline
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   */
  init(renderer, scene, camera) {
    this.renderer = renderer;

    this.composer = new EffectComposer(renderer);

    // 1. Render pass (base scene)
    this._renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this._renderPass);

    // 2. SSAO
    const size = renderer.getSize(new THREE.Vector2());
    this._ssaoPass = new SSAOPass(scene, camera, size.x, size.y);
    this._ssaoPass.kernelRadius = this.ssaoRadius;
    this._ssaoPass.minDistance = this.ssaoMinDistance;
    this._ssaoPass.maxDistance = this.ssaoMaxDistance;
    this._ssaoPass.enabled = this.ssaoEnabled;
    this.composer.addPass(this._ssaoPass);

    // 3. Bloom
    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      this.bloomStrength,
      this.bloomRadius,
      this.bloomThreshold
    );
    this._bloomPass.enabled = this.bloomEnabled;
    this.composer.addPass(this._bloomPass);

    // 4. Vignette
    this._vignettePass = new ShaderPass(VignetteShader);
    this._vignettePass.uniforms.offset.value = this.vignetteOffset;
    this._vignettePass.uniforms.darkness.value = this.vignetteDarkness;
    this._vignettePass.enabled = this.vignetteEnabled;
    this.composer.addPass(this._vignettePass);

    // 5. Color Grading
    this._colorGradingPass = new ShaderPass(ColorGradingShader);
    this._colorGradingPass.uniforms.brightness.value = this.brightness;
    this._colorGradingPass.uniforms.contrast.value = this.contrast;
    this._colorGradingPass.uniforms.saturation.value = this.saturation;
    this._colorGradingPass.enabled = this.colorGradingEnabled;
    this.composer.addPass(this._colorGradingPass);

    // 6. Output pass (tone mapping / color space)
    this._outputPass = new OutputPass();
    this.composer.addPass(this._outputPass);
  }

  /**
   * Update scene/camera references (e.g., after scene reload)
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   */
  updateSceneCamera(scene, camera) {
    if (this._renderPass) {
      this._renderPass.scene = scene;
      this._renderPass.camera = camera;
    }
    if (this._ssaoPass) {
      this._ssaoPass.scene = scene;
      this._ssaoPass.camera = camera;
    }
  }

  /**
   * Render using the post-processing pipeline
   */
  render() {
    if (this.enabled && this.composer) {
      this.composer.render();
    } else if (this.renderer && this._renderPass) {
      // Fallback: render without post-processing
      this.renderer.render(
        this._renderPass.scene,
        this._renderPass.camera
      );
    }
  }

  /**
   * Resize the composer to match viewport
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }

  // =============================================
  // Parameter update methods
  // =============================================

  updateBloom() {
    if (this._bloomPass) {
      this._bloomPass.enabled = this.bloomEnabled;
      this._bloomPass.strength = this.bloomStrength;
      this._bloomPass.radius = this.bloomRadius;
      this._bloomPass.threshold = this.bloomThreshold;
    }
  }

  updateSSAO() {
    if (this._ssaoPass) {
      this._ssaoPass.enabled = this.ssaoEnabled;
      this._ssaoPass.kernelRadius = this.ssaoRadius;
      this._ssaoPass.minDistance = this.ssaoMinDistance;
      this._ssaoPass.maxDistance = this.ssaoMaxDistance;
    }
  }

  updateVignette() {
    if (this._vignettePass) {
      this._vignettePass.enabled = this.vignetteEnabled;
      this._vignettePass.uniforms.offset.value = this.vignetteOffset;
      this._vignettePass.uniforms.darkness.value = this.vignetteDarkness;
    }
  }

  updateColorGrading() {
    if (this._colorGradingPass) {
      this._colorGradingPass.enabled = this.colorGradingEnabled;
      this._colorGradingPass.uniforms.brightness.value = this.brightness;
      this._colorGradingPass.uniforms.contrast.value = this.contrast;
      this._colorGradingPass.uniforms.saturation.value = this.saturation;
    }
  }

  // =============================================
  // Serialization
  // =============================================

  serialize() {
    return {
      enabled: this.enabled,
      bloom: {
        enabled: this.bloomEnabled,
        strength: this.bloomStrength,
        radius: this.bloomRadius,
        threshold: this.bloomThreshold,
      },
      ssao: {
        enabled: this.ssaoEnabled,
        radius: this.ssaoRadius,
        minDistance: this.ssaoMinDistance,
        maxDistance: this.ssaoMaxDistance,
      },
      vignette: {
        enabled: this.vignetteEnabled,
        offset: this.vignetteOffset,
        darkness: this.vignetteDarkness,
      },
      colorGrading: {
        enabled: this.colorGradingEnabled,
        brightness: this.brightness,
        contrast: this.contrast,
        saturation: this.saturation,
      },
    };
  }

  deserialize(data) {
    if (!data) return;
    this.enabled = data.enabled !== undefined ? data.enabled : true;

    if (data.bloom) {
      this.bloomEnabled = data.bloom.enabled ?? true;
      this.bloomStrength = data.bloom.strength ?? 0.4;
      this.bloomRadius = data.bloom.radius ?? 0.4;
      this.bloomThreshold = data.bloom.threshold ?? 0.85;
    }
    if (data.ssao) {
      this.ssaoEnabled = data.ssao.enabled ?? false;
      this.ssaoRadius = data.ssao.radius ?? 8;
      this.ssaoMinDistance = data.ssao.minDistance ?? 0.005;
      this.ssaoMaxDistance = data.ssao.maxDistance ?? 0.1;
    }
    if (data.vignette) {
      this.vignetteEnabled = data.vignette.enabled ?? true;
      this.vignetteOffset = data.vignette.offset ?? 1.0;
      this.vignetteDarkness = data.vignette.darkness ?? 0.6;
    }
    if (data.colorGrading) {
      this.colorGradingEnabled = data.colorGrading.enabled ?? false;
      this.brightness = data.colorGrading.brightness ?? 0.0;
      this.contrast = data.colorGrading.contrast ?? 0.0;
      this.saturation = data.colorGrading.saturation ?? 0.0;
    }

    // Apply all settings
    this.updateBloom();
    this.updateSSAO();
    this.updateVignette();
    this.updateColorGrading();
  }

  dispose() {
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
  }
}
