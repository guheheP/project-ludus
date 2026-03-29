import * as THREE from 'three';

/**
 * InputManager — Tracks keyboard & mouse state for scripts
 */
export class InputManager {
  /** @type {Set<string>} Currently pressed keys */
  keysDown = new Set();

  /** @type {Set<string>} Keys pressed this frame */
  keysPressed = new Set();

  /** @type {Set<string>} Keys released this frame */
  keysReleased = new Set();

  /** @type {{x: number, y: number}} Normalized mouse pos (-1 to 1) */
  mouse = { x: 0, y: 0 };

  /** @type {boolean} */
  mouseLeft = false;

  /** @type {boolean} */
  mouseRight = false;

  /** @type {HTMLElement|null} */
  _element = null;

  constructor(element) {
    this._element = element;

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (!this.keysDown.has(e.key)) {
        this.keysPressed.add(e.key);
      }
      this.keysDown.add(e.key);
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.key);
      this.keysReleased.add(e.key);
    });

    if (element) {
      element.addEventListener('mousemove', (e) => {
        const rect = element.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      });

      element.addEventListener('mousedown', (e) => {
        if (e.button === 0) this.mouseLeft = true;
        if (e.button === 2) this.mouseRight = true;
      });

      element.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.mouseLeft = false;
        if (e.button === 2) this.mouseRight = false;
      });
    }
  }

  /**
   * Check if a key is currently held down
   * @param {string} key
   * @returns {boolean}
   */
  isKeyDown(key) {
    return this.keysDown.has(key) || this.keysDown.has(key.toLowerCase()) || this.keysDown.has(key.toUpperCase());
  }

  /**
   * Check if a key was just pressed this frame
   * @param {string} key
   * @returns {boolean}
   */
  isKeyPressed(key) {
    return this.keysPressed.has(key) || this.keysPressed.has(key.toLowerCase()) || this.keysPressed.has(key.toUpperCase());
  }

  /**
   * Check if a key was just released this frame
   * @param {string} key
   * @returns {boolean}
   */
  isKeyReleased(key) {
    return this.keysReleased.has(key) || this.keysReleased.has(key.toLowerCase()) || this.keysReleased.has(key.toUpperCase());
  }

  /**
   * Clear per-frame state. Call at end of each frame.
   */
  endFrame() {
    this.keysPressed.clear();
    this.keysReleased.clear();
  }
}
