import * as THREE from 'three';
import { Component } from '../Component.js';

/**
 * ParticleEmitter Component — GPU-based particle system using THREE.Points
 * 
 * Particles are stored in a fixed-size BufferGeometry.
 * Each particle has: position, velocity, color, size, life, maxLife.
 */

// Default presets
const PRESETS = {
  fire: {
    maxParticles: 200,
    emissionRate: 60,
    lifetime: { min: 0.5, max: 1.5 },
    speed: { min: 1.0, max: 2.5 },
    direction: { x: 0, y: 1, z: 0 },
    spread: 0.3,
    gravity: -0.5,
    startSize: 0.3,
    endSize: 0.05,
    startColor: '#ff6600',
    endColor: '#ff0000',
    startOpacity: 1.0,
    endOpacity: 0.0,
    blending: 'additive',
  },
  smoke: {
    maxParticles: 150,
    emissionRate: 30,
    lifetime: { min: 2.0, max: 4.0 },
    speed: { min: 0.3, max: 0.8 },
    direction: { x: 0, y: 1, z: 0 },
    spread: 0.4,
    gravity: 0.2,
    startSize: 0.2,
    endSize: 0.8,
    startColor: '#888888',
    endColor: '#444444',
    startOpacity: 0.6,
    endOpacity: 0.0,
    blending: 'normal',
  },
  sparkle: {
    maxParticles: 300,
    emissionRate: 80,
    lifetime: { min: 0.3, max: 1.0 },
    speed: { min: 2.0, max: 5.0 },
    direction: { x: 0, y: 1, z: 0 },
    spread: 1.0,
    gravity: -3.0,
    startSize: 0.15,
    endSize: 0.02,
    startColor: '#ffee88',
    endColor: '#ffffff',
    startOpacity: 1.0,
    endOpacity: 0.0,
    blending: 'additive',
  },
  explosion: {
    maxParticles: 500,
    emissionRate: 0, // burst only
    lifetime: { min: 0.5, max: 2.0 },
    speed: { min: 3.0, max: 8.0 },
    direction: { x: 0, y: 0, z: 0 },
    spread: 1.0,
    gravity: -5.0,
    startSize: 0.3,
    endSize: 0.05,
    startColor: '#ffaa00',
    endColor: '#ff2200',
    startOpacity: 1.0,
    endOpacity: 0.0,
    blending: 'additive',
  },
  snow: {
    maxParticles: 400,
    emissionRate: 40,
    lifetime: { min: 3.0, max: 6.0 },
    speed: { min: 0.2, max: 0.5 },
    direction: { x: 0, y: -1, z: 0 },
    spread: 0.8,
    gravity: 0.0,
    startSize: 0.08,
    endSize: 0.08,
    startColor: '#ffffff',
    endColor: '#ccddff',
    startOpacity: 0.9,
    endOpacity: 0.0,
    blending: 'normal',
  },
};

export { PRESETS as PARTICLE_PRESETS };

export class ParticleEmitter extends Component {
  static typeName = 'ParticleEmitter';

  // --- Configurable parameters ---
  maxParticles = 200;
  emissionRate = 60;  // particles per second (0 = manual burst only)
  lifetime = { min: 0.5, max: 1.5 };
  speed = { min: 1.0, max: 2.5 };
  direction = { x: 0, y: 1, z: 0 };
  spread = 0.3;       // 0 = focused, 1 = omnidirectional
  gravity = -2.0;
  startSize = 0.3;
  endSize = 0.05;
  startColor = '#ff6600';
  endColor = '#ff0000';
  startOpacity = 1.0;
  endOpacity = 0.0;
  blending = 'additive';  // 'additive' | 'normal'
  loop = true;
  playing = true;
  preset = 'custom';

  // --- Internal state (not serialized) ---
  /** @type {THREE.Points|null} */
  _points = null;
  /** @type {Float32Array} */
  _positions = null;
  _velocities = null;
  _colors = null;
  _sizes = null;
  _lives = null;
  _maxLives = null;
  _emitAccum = 0;
  _initialized = false;
  _worldPos = new THREE.Vector3();

  // Temp vectors
  _tmpDir = new THREE.Vector3();
  _startCol = new THREE.Color();
  _endCol = new THREE.Color();

  /**
   * Apply a preset
   * @param {string} presetName
   */
  applyPreset(presetName) {
    const p = PRESETS[presetName];
    if (!p) return;
    this.preset = presetName;
    Object.assign(this, {
      maxParticles: p.maxParticles,
      emissionRate: p.emissionRate,
      lifetime: { ...p.lifetime },
      speed: { ...p.speed },
      direction: { ...p.direction },
      spread: p.spread,
      gravity: p.gravity,
      startSize: p.startSize,
      endSize: p.endSize,
      startColor: p.startColor,
      endColor: p.endColor,
      startOpacity: p.startOpacity,
      endOpacity: p.endOpacity,
      blending: p.blending,
    });
    this._rebuild();
  }

  /**
   * Initialize the particle system buffers and Three.js objects
   */
  init() {
    if (this._initialized) this._cleanup();

    const n = this.maxParticles;
    this._positions = new Float32Array(n * 3);
    this._velocities = new Float32Array(n * 3);
    this._colors = new Float32Array(n * 4); // RGBA
    this._sizes = new Float32Array(n);
    this._lives = new Float32Array(n);     // current life
    this._maxLives = new Float32Array(n);  // max life

    // Initialize all particles as dead
    this._lives.fill(-1);

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));
    geometry.setAttribute('customColor', new THREE.BufferAttribute(this._colors, 4));
    geometry.setAttribute('size', new THREE.BufferAttribute(this._sizes, 1));

    // Create material
    const material = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
      blending: this.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    this._points = new THREE.Points(geometry, material);
    this._points.frustumCulled = false;

    // Add to scene (not to entity.object3D — particles are in world space)
    if (this.entity) {
      const threeScene = this._getThreeScene();
      if (threeScene) {
        threeScene.add(this._points);
      }
    }

    this._initialized = true;
  }

  /**
   * Update particles (called every frame)
   * @param {number} dt - delta time in seconds
   */
  update(dt) {
    if (!this._initialized || !this._points) return;

    // Update world position from entity
    if (this.entity) {
      this.entity.object3D.getWorldPosition(this._worldPos);
    }

    // Emit new particles
    if (this.playing && this.emissionRate > 0) {
      this._emitAccum += this.emissionRate * dt;
      while (this._emitAccum >= 1) {
        this._emitParticle();
        this._emitAccum -= 1;
      }
    }

    // Update existing particles
    this._startCol.set(this.startColor);
    this._endCol.set(this.endColor);

    for (let i = 0; i < this.maxParticles; i++) {
      if (this._lives[i] < 0) continue;

      this._lives[i] += dt;
      const t = this._lives[i] / this._maxLives[i]; // 0..1

      if (t >= 1) {
        // Kill particle
        this._lives[i] = -1;
        this._sizes[i] = 0;
        continue;
      }

      // Gravity
      this._velocities[i * 3 + 1] += this.gravity * dt;

      // Move
      this._positions[i * 3]     += this._velocities[i * 3]     * dt;
      this._positions[i * 3 + 1] += this._velocities[i * 3 + 1] * dt;
      this._positions[i * 3 + 2] += this._velocities[i * 3 + 2] * dt;

      // Interpolate size
      this._sizes[i] = THREE.MathUtils.lerp(this.startSize, this.endSize, t);

      // Interpolate color
      const r = THREE.MathUtils.lerp(this._startCol.r, this._endCol.r, t);
      const g = THREE.MathUtils.lerp(this._startCol.g, this._endCol.g, t);
      const b = THREE.MathUtils.lerp(this._startCol.b, this._endCol.b, t);
      const a = THREE.MathUtils.lerp(this.startOpacity, this.endOpacity, t);
      this._colors[i * 4]     = r;
      this._colors[i * 4 + 1] = g;
      this._colors[i * 4 + 2] = b;
      this._colors[i * 4 + 3] = a;
    }

    // Update GPU buffers
    const geo = this._points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.customColor.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;

    // Update material blending
    this._points.material.blending = this.blending === 'additive' 
      ? THREE.AdditiveBlending : THREE.NormalBlending;
  }

  /**
   * Emit a single particle
   */
  _emitParticle() {
    // Find a dead particle slot
    for (let i = 0; i < this.maxParticles; i++) {
      if (this._lives[i] >= 0) continue;

      // Life
      this._lives[i] = 0;
      this._maxLives[i] = this._rand(this.lifetime.min, this.lifetime.max);

      // Position (at emitter)
      this._positions[i * 3]     = this._worldPos.x;
      this._positions[i * 3 + 1] = this._worldPos.y;
      this._positions[i * 3 + 2] = this._worldPos.z;

      // Direction with spread
      this._tmpDir.set(this.direction.x, this.direction.y, this.direction.z);
      if (this._tmpDir.lengthSq() < 0.001) this._tmpDir.set(0, 1, 0);
      this._tmpDir.normalize();

      // Apply spread (random cone)
      if (this.spread > 0) {
        const angle = this.spread * Math.PI;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * angle;
        const sinPhi = Math.sin(phi);
        const offset = new THREE.Vector3(
          sinPhi * Math.cos(theta),
          Math.cos(phi),
          sinPhi * Math.sin(theta)
        );

        // Rotate offset to align with direction
        const up = new THREE.Vector3(0, 1, 0);
        if (Math.abs(this._tmpDir.dot(up)) > 0.99) {
          up.set(1, 0, 0);
        }
        const quat = new THREE.Quaternion().setFromUnitVectors(up, this._tmpDir);
        offset.applyQuaternion(quat);

        this._tmpDir.copy(offset).normalize();
      }

      const spd = this._rand(this.speed.min, this.speed.max);
      this._velocities[i * 3]     = this._tmpDir.x * spd;
      this._velocities[i * 3 + 1] = this._tmpDir.y * spd;
      this._velocities[i * 3 + 2] = this._tmpDir.z * spd;

      // Initial color & size
      this._startCol.set(this.startColor);
      this._colors[i * 4]     = this._startCol.r;
      this._colors[i * 4 + 1] = this._startCol.g;
      this._colors[i * 4 + 2] = this._startCol.b;
      this._colors[i * 4 + 3] = this.startOpacity;
      this._sizes[i] = this.startSize;

      return;
    }
  }

  /**
   * Emit a burst of particles
   * @param {number} count
   */
  burst(count = 50) {
    for (let i = 0; i < count; i++) {
      this._emitParticle();
    }
  }

  /**
   * Stop emitting
   */
  stop() {
    this.playing = false;
  }

  /**
   * Start emitting
   */
  play() {
    this.playing = true;
  }

  /**
   * Reset all particles
   */
  reset() {
    if (this._lives) this._lives.fill(-1);
    if (this._sizes) this._sizes.fill(0);
    this._emitAccum = 0;
  }

  /**
   * Get the Three.js scene
   */
  _getThreeScene() {
    if (!this.entity) return null;
    let obj = this.entity.object3D;
    while (obj.parent) obj = obj.parent;
    return obj;
  }

  /**
   * Rebuild the particle system (e.g., after maxParticles change)
   */
  _rebuild() {
    const wasPlaying = this.playing;
    this._cleanup();
    this.init();
    this.playing = wasPlaying;
  }

  /**
   * Clean up Three.js objects
   */
  _cleanup() {
    if (this._points) {
      if (this._points.parent) {
        this._points.parent.remove(this._points);
      }
      this._points.geometry.dispose();
      this._points.material.dispose();
      this._points = null;
    }
    this._initialized = false;
  }

  _rand(min, max) {
    return min + Math.random() * (max - min);
  }

  onDetach() {
    this._cleanup();
  }

  serialize() {
    return {
      maxParticles: this.maxParticles,
      emissionRate: this.emissionRate,
      lifetime: { ...this.lifetime },
      speed: { ...this.speed },
      direction: { ...this.direction },
      spread: this.spread,
      gravity: this.gravity,
      startSize: this.startSize,
      endSize: this.endSize,
      startColor: this.startColor,
      endColor: this.endColor,
      startOpacity: this.startOpacity,
      endOpacity: this.endOpacity,
      blending: this.blending,
      loop: this.loop,
      playing: this.playing,
      preset: this.preset,
    };
  }

  deserialize(data) {
    if (!data) return;
    this.maxParticles = data.maxParticles ?? 200;
    this.emissionRate = data.emissionRate ?? 60;
    this.lifetime = data.lifetime ? { ...data.lifetime } : { min: 0.5, max: 1.5 };
    this.speed = data.speed ? { ...data.speed } : { min: 1.0, max: 2.5 };
    this.direction = data.direction ? { ...data.direction } : { x: 0, y: 1, z: 0 };
    this.spread = data.spread ?? 0.3;
    this.gravity = data.gravity ?? -2.0;
    this.startSize = data.startSize ?? 0.3;
    this.endSize = data.endSize ?? 0.05;
    this.startColor = data.startColor ?? '#ff6600';
    this.endColor = data.endColor ?? '#ff0000';
    this.startOpacity = data.startOpacity ?? 1.0;
    this.endOpacity = data.endOpacity ?? 0.0;
    this.blending = data.blending ?? 'additive';
    this.loop = data.loop ?? true;
    this.playing = data.playing ?? true;
    this.preset = data.preset ?? 'custom';
  }
}
