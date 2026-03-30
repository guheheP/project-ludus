import { EASINGS } from '../systems/TweenManager.js';

/**
 * Keyframe — A single keyframe value at a specific time
 */
export class Keyframe {
  /** @type {number} Time in seconds */
  time = 0;

  /** @type {number} Value at this time */
  value = 0;

  /** @type {string} Easing to next keyframe */
  easing = 'linear';

  constructor(time = 0, value = 0, easing = 'linear') {
    this.time = time;
    this.value = value;
    this.easing = easing;
  }

  serialize() {
    return { time: this.time, value: this.value, easing: this.easing };
  }

  static deserialize(data) {
    return new Keyframe(data.time, data.value, data.easing || 'linear');
  }
}

/**
 * AnimationTrack — Animates a single property over time
 * 
 * Property paths use dot notation:
 *   "position.x", "rotation.y", "scale.z"
 *   "material.opacity", "material.emissive.r"
 *   "light.intensity", "light.color.r"
 */
export class AnimationTrack {
  /** @type {string} Property path (e.g. "position.x") */
  property = '';

  /** @type {Keyframe[]} Sorted by time */
  keyframes = [];

  constructor(property = '') {
    this.property = property;
  }

  /**
   * Add a keyframe, maintaining time-sorted order
   * @param {Keyframe} kf
   */
  addKeyframe(kf) {
    // Replace if a keyframe at the same time exists
    const existing = this.keyframes.findIndex(k => Math.abs(k.time - kf.time) < 0.001);
    if (existing >= 0) {
      this.keyframes[existing] = kf;
    } else {
      this.keyframes.push(kf);
      this.keyframes.sort((a, b) => a.time - b.time);
    }
  }

  /**
   * Remove keyframe at time
   * @param {number} time
   */
  removeKeyframeAt(time) {
    this.keyframes = this.keyframes.filter(k => Math.abs(k.time - time) > 0.001);
  }

  /**
   * Evaluate the track at a given time
   * @param {number} time
   * @returns {number} Interpolated value
   */
  evaluate(time) {
    const kfs = this.keyframes;
    if (kfs.length === 0) return 0;
    if (kfs.length === 1) return kfs[0].value;

    // Before first keyframe
    if (time <= kfs[0].time) return kfs[0].value;

    // After last keyframe
    if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;

    // Find surrounding keyframes
    for (let i = 0; i < kfs.length - 1; i++) {
      const a = kfs[i];
      const b = kfs[i + 1];
      if (time >= a.time && time <= b.time) {
        const duration = b.time - a.time;
        if (duration <= 0) return a.value;
        const rawT = (time - a.time) / duration;

        // Apply easing
        const easeFn = EASINGS[a.easing] || EASINGS.linear;
        const t = easeFn(rawT);

        return a.value + (b.value - a.value) * t;
      }
    }

    return kfs[kfs.length - 1].value;
  }

  /**
   * Get the duration of this track (time of last keyframe)
   * @returns {number}
   */
  get duration() {
    if (this.keyframes.length === 0) return 0;
    return this.keyframes[this.keyframes.length - 1].time;
  }

  serialize() {
    return {
      property: this.property,
      keyframes: this.keyframes.map(k => k.serialize()),
    };
  }

  static deserialize(data) {
    const track = new AnimationTrack(data.property);
    track.keyframes = (data.keyframes || []).map(k => Keyframe.deserialize(k));
    return track;
  }
}

/**
 * AnimationClip — A complete animation containing multiple tracks
 */
export class AnimationClip {
  /** @type {string} Clip name */
  name = 'New Clip';

  /** @type {AnimationTrack[]} */
  tracks = [];

  /** @type {boolean} Whether to loop playback */
  loop = false;

  constructor(name = 'New Clip') {
    this.name = name;
  }

  /**
   * Get or create a track for the given property
   * @param {string} property
   * @returns {AnimationTrack}
   */
  getTrack(property) {
    let track = this.tracks.find(t => t.property === property);
    if (!track) {
      track = new AnimationTrack(property);
      this.tracks.push(track);
    }
    return track;
  }

  /**
   * Remove a track by property name
   * @param {string} property
   */
  removeTrack(property) {
    this.tracks = this.tracks.filter(t => t.property !== property);
  }

  /**
   * Get the total duration of this clip (max track duration)
   * @returns {number}
   */
  get duration() {
    if (this.tracks.length === 0) return 0;
    return Math.max(...this.tracks.map(t => t.duration));
  }

  /**
   * Evaluate all tracks at a given time, returning a map of property → value
   * @param {number} time
   * @returns {Map<string, number>}
   */
  evaluate(time) {
    const result = new Map();
    for (const track of this.tracks) {
      result.set(track.property, track.evaluate(time));
    }
    return result;
  }

  serialize() {
    return {
      name: this.name,
      loop: this.loop,
      tracks: this.tracks.map(t => t.serialize()),
    };
  }

  static deserialize(data) {
    const clip = new AnimationClip(data.name || 'Clip');
    clip.loop = data.loop ?? false;
    clip.tracks = (data.tracks || []).map(t => AnimationTrack.deserialize(t));
    return clip;
  }
}

/**
 * Property path display names for the UI
 */
export const ANIMATABLE_PROPERTIES = [
  { path: 'position.x', label: 'Position X', group: 'Transform' },
  { path: 'position.y', label: 'Position Y', group: 'Transform' },
  { path: 'position.z', label: 'Position Z', group: 'Transform' },
  { path: 'rotation.x', label: 'Rotation X', group: 'Transform' },
  { path: 'rotation.y', label: 'Rotation Y', group: 'Transform' },
  { path: 'rotation.z', label: 'Rotation Z', group: 'Transform' },
  { path: 'scale.x', label: 'Scale X', group: 'Transform' },
  { path: 'scale.y', label: 'Scale Y', group: 'Transform' },
  { path: 'scale.z', label: 'Scale Z', group: 'Transform' },
  { path: 'material.opacity', label: 'Opacity', group: 'Material' },
  { path: 'material.emissiveIntensity', label: 'Emissive Intensity', group: 'Material' },
  { path: 'light.intensity', label: 'Light Intensity', group: 'Light' },
  { path: 'camera.fov', label: 'Camera FOV', group: 'Camera' },
];
