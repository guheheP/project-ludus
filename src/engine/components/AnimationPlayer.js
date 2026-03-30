import { Component } from '../Component.js';
import { AnimationClip } from './AnimationClip.js';

/**
 * AnimationPlayer — Plays AnimationClip(s) on an entity
 * 
 * Applies keyframe values to entity properties each frame.
 * Supports multiple clips, loop, speed, and play/stop/pause control.
 */
export class AnimationPlayer extends Component {
  static typeName = 'AnimationPlayer';

  /** @type {AnimationClip[]} Available clips */
  clips = [];

  /** @type {number} Index of the currently active clip (-1 = none) */
  currentClipIndex = 0;

  /** @type {number} Playback speed multiplier */
  speed = 1.0;

  /** @type {boolean} Auto-play on start */
  autoPlay = false;

  /** @type {boolean} Currently playing */
  playing = false;

  /** @type {number} Current playback time in seconds */
  _time = 0;

  /** @type {object|null} Captured initial state for reset */
  _initialState = null;

  get currentClip() {
    if (this.currentClipIndex >= 0 && this.currentClipIndex < this.clips.length) {
      return this.clips[this.currentClipIndex];
    }
    return null;
  }

  get time() {
    return this._time;
  }

  set time(value) {
    this._time = Math.max(0, value);
    // Apply immediately (for scrubbing in editor)
    if (this.currentClip && this.entity) {
      this._applyClip(this.currentClip, this._time);
    }
  }

  onAttach() {
    // Create a default clip if none exists
    if (this.clips.length === 0) {
      this.clips.push(new AnimationClip('Default'));
    }
  }

  /**
   * Capture the current property values as the initial state
   */
  captureInitialState() {
    if (!this.entity) return;
    this._initialState = {};
    const transform = this.entity.getComponent('Transform');
    if (transform) {
      this._initialState.position = {
        x: transform.position.x,
        y: transform.position.y,
        z: transform.position.z,
      };
      this._initialState.rotation = {
        x: transform.rotation.x,
        y: transform.rotation.y,
        z: transform.rotation.z,
      };
      this._initialState.scale = {
        x: transform.scale.x,
        y: transform.scale.y,
        z: transform.scale.z,
      };
    }
  }

  /**
   * Restore the captured initial state
   */
  restoreInitialState() {
    if (!this.entity || !this._initialState) return;
    const transform = this.entity.getComponent('Transform');
    if (transform && this._initialState.position) {
      transform.setPosition(
        this._initialState.position.x,
        this._initialState.position.y,
        this._initialState.position.z
      );
      this.entity.object3D.rotation.set(
        this._initialState.rotation.x,
        this._initialState.rotation.y,
        this._initialState.rotation.z
      );
      transform.setScale(
        this._initialState.scale.x,
        this._initialState.scale.y,
        this._initialState.scale.z
      );
    }
  }

  /**
   * Start playback
   * @param {string|number} [clipNameOrIndex] - Optional clip to play
   */
  play(clipNameOrIndex) {
    if (clipNameOrIndex !== undefined) {
      if (typeof clipNameOrIndex === 'string') {
        const idx = this.clips.findIndex(c => c.name === clipNameOrIndex);
        if (idx >= 0) this.currentClipIndex = idx;
      } else {
        this.currentClipIndex = clipNameOrIndex;
      }
    }
    if (!this._initialState) this.captureInitialState();
    this.playing = true;
  }

  /**
   * Stop playback and reset to start
   */
  stop() {
    this.playing = false;
    this._time = 0;
    this.restoreInitialState();
  }

  /**
   * Pause playback
   */
  pause() {
    this.playing = false;
  }

  /**
   * Resume playback
   */
  resume() {
    this.playing = true;
  }

  /**
   * Update each frame
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (!this.playing || !this.entity) return;

    const clip = this.currentClip;
    if (!clip || clip.tracks.length === 0) return;

    this._time += dt * this.speed;

    const duration = clip.duration;
    if (duration <= 0) return;

    // Handle looping
    if (this._time > duration) {
      if (clip.loop) {
        this._time = this._time % duration;
      } else {
        this._time = duration;
        this.playing = false;
      }
    }

    this._applyClip(clip, this._time);
  }

  /**
   * Apply clip values at the given time to the entity
   * @param {AnimationClip} clip
   * @param {number} time
   */
  _applyClip(clip, time) {
    const values = clip.evaluate(time);

    for (const [property, value] of values) {
      this._setProperty(property, value);
    }
  }

  /**
   * Set a property value on the entity by dot-path
   * @param {string} path - e.g. "position.x", "material.opacity"
   * @param {number} value
   */
  _setProperty(path, value) {
    if (!this.entity) return;

    const parts = path.split('.');

    // Transform properties
    if (parts[0] === 'position' || parts[0] === 'rotation' || parts[0] === 'scale') {
      const transform = this.entity.getComponent('Transform');
      if (transform) {
        transform[parts[0]][parts[1]] = value;
      }
      return;
    }

    // Material properties
    if (parts[0] === 'material') {
      const mesh = this.entity.object3D?.children?.find(c => c.isMesh);
      if (mesh && mesh.material) {
        if (parts.length === 2) {
          mesh.material[parts[1]] = value;
        } else if (parts.length === 3) {
          // e.g. material.emissive.r
          if (mesh.material[parts[1]]) {
            mesh.material[parts[1]][parts[2]] = value;
          }
        }
        mesh.material.needsUpdate = true;
      }
      return;
    }

    // Light properties
    if (parts[0] === 'light') {
      const lightComp = this.entity.getComponent('Light');
      if (lightComp && lightComp._threeLight) {
        if (parts.length === 2) {
          lightComp._threeLight[parts[1]] = value;
        }
      }
      return;
    }

    // Camera properties
    if (parts[0] === 'camera') {
      const camComp = this.entity.getComponent('Camera');
      if (camComp) {
        if (parts[1] === 'fov') {
          camComp.fov = value;
          if (camComp._threeCamera) {
            camComp._threeCamera.fov = value;
            camComp._threeCamera.updateProjectionMatrix();
          }
        }
      }
      return;
    }
  }

  /**
   * Read a property value from the entity by dot-path
   * @param {string} path
   * @returns {number|null}
   */
  getPropertyValue(path) {
    if (!this.entity) return null;
    const parts = path.split('.');

    if (parts[0] === 'position' || parts[0] === 'rotation' || parts[0] === 'scale') {
      const transform = this.entity.getComponent('Transform');
      if (transform) return transform[parts[0]][parts[1]];
    }

    if (parts[0] === 'material') {
      const mesh = this.entity.object3D?.children?.find(c => c.isMesh);
      if (mesh && mesh.material) {
        if (parts.length === 2) return mesh.material[parts[1]];
        if (parts.length === 3 && mesh.material[parts[1]]) {
          return mesh.material[parts[1]][parts[2]];
        }
      }
    }

    if (parts[0] === 'light') {
      const lightComp = this.entity.getComponent('Light');
      if (lightComp && lightComp._threeLight && parts.length === 2) {
        return lightComp._threeLight[parts[1]];
      }
    }

    if (parts[0] === 'camera') {
      const camComp = this.entity.getComponent('Camera');
      if (camComp && parts[1] === 'fov') return camComp.fov;
    }

    return null;
  }

  serialize() {
    return {
      ...super.serialize(),
      clips: this.clips.map(c => c.serialize()),
      currentClipIndex: this.currentClipIndex,
      speed: this.speed,
      autoPlay: this.autoPlay,
    };
  }

  deserialize(data) {
    super.deserialize(data);
    this.clips = (data.clips || []).map(c => AnimationClip.deserialize(c));
    this.currentClipIndex = data.currentClipIndex ?? 0;
    this.speed = data.speed ?? 1.0;
    this.autoPlay = data.autoPlay ?? false;
    if (this.clips.length === 0) {
      this.clips.push(new AnimationClip('Default'));
    }
  }
}
