import { Component } from '../Component.js';

/**
 * Animator Component — Simple preset-based animations
 * 
 * Provides code-free animation for common patterns:
 * rotate, float, pulse, orbit
 */

const ANIMATION_TYPES = ['rotate', 'float', 'pulse', 'orbit'];

export { ANIMATION_TYPES };

export class Animator extends Component {
  static typeName = 'Animator';

  /** @type {'rotate'|'float'|'pulse'|'orbit'} */
  animationType = 'rotate';

  /** @type {number} Speed multiplier */
  speed = 1.0;

  /** @type {number} Amplitude for float/pulse */
  amplitude = 0.5;

  /** @type {'x'|'y'|'z'} Axis of animation */
  axis = 'y';

  /** @type {boolean} Auto-play on start */
  autoPlay = true;

  /** @type {boolean} Currently playing */
  playing = true;

  // Internal state
  _elapsed = 0;
  _initialPosition = null;
  _initialScale = null;

  onAttach() {
    this._captureInitialState();
  }

  /**
   * Capture the initial state for relative animations
   */
  _captureInitialState() {
    if (!this.entity) return;
    const transform = this.entity.getComponent('Transform');
    if (transform) {
      this._initialPosition = {
        x: transform.position.x,
        y: transform.position.y,
        z: transform.position.z,
      };
      this._initialScale = {
        x: transform.scale.x,
        y: transform.scale.y,
        z: transform.scale.z,
      };
    }
  }

  /**
   * Update animation each frame
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (!this.playing || !this.entity) return;

    const transform = this.entity.getComponent('Transform');
    if (!transform) return;

    // Ensure initial state is captured
    if (!this._initialPosition) {
      this._captureInitialState();
    }

    this._elapsed += dt * this.speed;

    switch (this.animationType) {
      case 'rotate':
        this._updateRotate(transform, dt);
        break;
      case 'float':
        this._updateFloat(transform);
        break;
      case 'pulse':
        this._updatePulse(transform);
        break;
      case 'orbit':
        this._updateOrbit(transform);
        break;
    }
  }

  _updateRotate(transform, dt) {
    const rotSpeed = this.speed * Math.PI; // half turn per second at speed=1
    const rotation = transform.rotation;
    switch (this.axis) {
      case 'x': rotation.x += rotSpeed * dt; break;
      case 'y': rotation.y += rotSpeed * dt; break;
      case 'z': rotation.z += rotSpeed * dt; break;
    }
  }

  _updateFloat(transform) {
    if (!this._initialPosition) return;
    const offset = Math.sin(this._elapsed * Math.PI * 2) * this.amplitude;
    switch (this.axis) {
      case 'x': transform.position.x = this._initialPosition.x + offset; break;
      case 'y': transform.position.y = this._initialPosition.y + offset; break;
      case 'z': transform.position.z = this._initialPosition.z + offset; break;
    }
  }

  _updatePulse(transform) {
    if (!this._initialScale) return;
    const scale = 1 + Math.sin(this._elapsed * Math.PI * 2) * this.amplitude * 0.5;
    transform.scale.x = this._initialScale.x * scale;
    transform.scale.y = this._initialScale.y * scale;
    transform.scale.z = this._initialScale.z * scale;
  }

  _updateOrbit(transform) {
    if (!this._initialPosition) return;
    const radius = this.amplitude;
    const angle = this._elapsed * Math.PI * 2;

    switch (this.axis) {
      case 'x': // orbit in YZ plane
        transform.position.y = this._initialPosition.y + Math.cos(angle) * radius;
        transform.position.z = this._initialPosition.z + Math.sin(angle) * radius;
        break;
      case 'y': // orbit in XZ plane
        transform.position.x = this._initialPosition.x + Math.cos(angle) * radius;
        transform.position.z = this._initialPosition.z + Math.sin(angle) * radius;
        break;
      case 'z': // orbit in XY plane
        transform.position.x = this._initialPosition.x + Math.cos(angle) * radius;
        transform.position.y = this._initialPosition.y + Math.sin(angle) * radius;
        break;
    }
  }

  /**
   * Reset the animation to initial state
   */
  reset() {
    this._elapsed = 0;
    if (this.entity) {
      const transform = this.entity.getComponent('Transform');
      if (transform && this._initialPosition) {
        transform.position.x = this._initialPosition.x;
        transform.position.y = this._initialPosition.y;
        transform.position.z = this._initialPosition.z;
      }
      if (transform && this._initialScale) {
        transform.scale.x = this._initialScale.x;
        transform.scale.y = this._initialScale.y;
        transform.scale.z = this._initialScale.z;
      }
    }
  }

  serialize() {
    return {
      animationType: this.animationType,
      speed: this.speed,
      amplitude: this.amplitude,
      axis: this.axis,
      autoPlay: this.autoPlay,
      playing: this.playing,
    };
  }

  deserialize(data) {
    if (!data) return;
    this.animationType = data.animationType ?? 'rotate';
    this.speed = data.speed ?? 1.0;
    this.amplitude = data.amplitude ?? 0.5;
    this.axis = data.axis ?? 'y';
    this.autoPlay = data.autoPlay ?? true;
    this.playing = data.playing ?? true;
  }
}
