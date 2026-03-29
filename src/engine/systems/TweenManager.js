import * as THREE from 'three';

/**
 * Easing functions
 */
const EASINGS = {
  linear: t => t,
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: t => t * t * t,
  easeOutCubic: t => (--t) * t * t + 1,
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInBack: t => t * t * (2.70158 * t - 1.70158),
  easeOutBack: t => { const s = 1.70158; return (t -= 1) * t * ((s + 1) * t + s) + 1; },
  easeOutElastic: t => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  },
  easeOutBounce: t => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
};

export { EASINGS };

/**
 * Single Tween instance
 */
class Tween {
  /** @type {object} Target object (e.g., position, rotation) */
  target = null;
  /** @type {object} Start values */
  _from = {};
  /** @type {object} End values */
  _to = {};
  /** @type {number} Duration in seconds */
  duration = 1;
  /** @type {number} Elapsed time */
  _elapsed = 0;
  /** @type {string} Easing function name */
  easing = 'linear';
  /** @type {number} Delay before starting */
  _delay = 0;
  /** @type {number} Delay elapsed */
  _delayElapsed = 0;
  /** @type {boolean} */
  _started = false;
  /** @type {boolean} */
  _completed = false;
  /** @type {boolean} */
  _loop = false;
  /** @type {boolean} */
  _yoyo = false;
  /** @type {boolean} */
  _reversed = false;
  /** @type {Function|null} */
  _onCompleteFn = null;
  /** @type {Function|null} */
  _onUpdateFn = null;

  constructor(target, to, duration, easing = 'linear') {
    this.target = target;
    this._to = { ...to };
    this.duration = duration;
    this.easing = easing;

    // Capture start values
    for (const key of Object.keys(to)) {
      this._from[key] = target[key];
    }
  }

  /**
   * Set a delay before the tween starts
   * @param {number} seconds
   * @returns {Tween}
   */
  delay(seconds) {
    this._delay = seconds;
    return this;
  }

  /**
   * Set a callback for when the tween completes
   * @param {Function} fn
   * @returns {Tween}
   */
  onComplete(fn) {
    this._onCompleteFn = fn;
    return this;
  }

  /**
   * Set a callback for each update
   * @param {Function} fn
   * @returns {Tween}
   */
  onUpdate(fn) {
    this._onUpdateFn = fn;
    return this;
  }

  /**
   * Make the tween loop
   * @param {boolean} yoyo - If true, alternates direction each loop
   * @returns {Tween}
   */
  loop(yoyo = false) {
    this._loop = true;
    this._yoyo = yoyo;
    return this;
  }

  /**
   * Update the tween
   * @param {number} dt - Delta time in seconds
   * @returns {boolean} true if tween is still active
   */
  update(dt) {
    if (this._completed) return false;

    // Handle delay
    if (this._delayElapsed < this._delay) {
      this._delayElapsed += dt;
      return true;
    }

    if (!this._started) {
      this._started = true;
      // Re-capture start values in case they changed during delay
      for (const key of Object.keys(this._to)) {
        this._from[key] = this.target[key];
      }
    }

    this._elapsed += dt;
    let rawT = Math.min(this._elapsed / this.duration, 1);

    if (this._reversed) rawT = 1 - rawT;

    // Apply easing
    const easeFn = EASINGS[this.easing] || EASINGS.linear;
    const t = easeFn(this._reversed ? 1 - rawT : rawT);

    // Interpolate values
    for (const key of Object.keys(this._to)) {
      this.target[key] = this._from[key] + (this._to[key] - this._from[key]) * t;
    }

    if (this._onUpdateFn) this._onUpdateFn(t);

    // Check completion
    if (this._elapsed >= this.duration) {
      if (this._loop) {
        this._elapsed = 0;
        if (this._yoyo) {
          this._reversed = !this._reversed;
          // Swap from/to for yoyo
          const tmpFrom = { ...this._from };
          this._from = { ...this._to };
          this._to = tmpFrom;
        } else {
          // Reset target to start for loop
          for (const key of Object.keys(this._from)) {
            this.target[key] = this._from[key];
          }
        }
        return true;
      }

      this._completed = true;
      // Ensure final values are set
      if (!this._reversed) {
        for (const key of Object.keys(this._to)) {
          this.target[key] = this._to[key];
        }
      }
      if (this._onCompleteFn) this._onCompleteFn();
      return false;
    }

    return true;
  }
}

/**
 * TweenManager — Manages all active tweens
 */
export class TweenManager {
  /** @type {Tween[]} */
  _tweens = [];

  /**
   * Create a new tween
   * @param {object} target - Object to animate (e.g., entity.position)
   * @param {object} to - Target values (e.g., { x: 5, y: 10 })
   * @param {number} duration - Duration in seconds
   * @param {string} easing - Easing function name
   * @returns {Tween}
   */
  to(target, to, duration, easing = 'linear') {
    const tween = new Tween(target, to, duration, easing);
    this._tweens.push(tween);
    return tween;
  }

  /**
   * Kill all tweens targeting a specific object
   * @param {object} target
   */
  killTweensOf(target) {
    this._tweens = this._tweens.filter(t => t.target !== target);
  }

  /**
   * Kill all tweens
   */
  killAll() {
    this._tweens = [];
  }

  /**
   * Update all active tweens
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    // Update all tweens, remove completed ones
    this._tweens = this._tweens.filter(t => t.update(dt));
  }

  /**
   * Get the number of active tweens
   * @returns {number}
   */
  get count() {
    return this._tweens.length;
  }
}
