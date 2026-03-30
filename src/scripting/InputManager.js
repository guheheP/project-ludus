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

  /** @type {{dx: number, dy: number}} Mouse movement delta this frame */
  mouseDelta = { dx: 0, dy: 0 };

  /** @type {boolean} */
  mouseLeft = false;

  /** @type {boolean} */
  mouseRight = false;

  /** @type {boolean} */
  isCursorLocked = false;

  /** @type {HTMLElement|null} */
  _element = null;

  constructor(element) {
    this._element = element;

    // Store bound handlers for cleanup
    this._onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (!this.keysDown.has(e.key)) {
        this.keysPressed.add(e.key);
      }
      this.keysDown.add(e.key);
    };

    this._onKeyUp = (e) => {
      this.keysDown.delete(e.key);
      this.keysReleased.add(e.key);
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    if (element) {
      this._onMouseMove = (e) => {
        const rect = element.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        // Accumulate movement delta
        this.mouseDelta.dx += e.movementX || 0;
        this.mouseDelta.dy += e.movementY || 0;
      };

      this._onMouseDown = (e) => {
        if (e.button === 0) this.mouseLeft = true;
        if (e.button === 2) this.mouseRight = true;
      };

      this._onMouseUp = (e) => {
        if (e.button === 0) this.mouseLeft = false;
        if (e.button === 2) this.mouseRight = false;
      };

      element.addEventListener('mousemove', this._onMouseMove);
      element.addEventListener('mousedown', this._onMouseDown);
      element.addEventListener('mouseup', this._onMouseUp);

      // Track pointer lock state
      this._onPointerLockChange = () => {
        this.isCursorLocked = document.pointerLockElement === element;
      };
      document.addEventListener('pointerlockchange', this._onPointerLockChange);
    }
  }

  /**
   * Lock the cursor (Pointer Lock API)
   */
  lockCursor() {
    if (this._element && !this.isCursorLocked) {
      this._element.requestPointerLock();
    }
  }

  /**
   * Unlock the cursor
   */
  unlockCursor() {
    if (this.isCursorLocked) {
      document.exitPointerLock();
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
    this.mouseDelta.dx = 0;
    this.mouseDelta.dy = 0;
  }

  /**
   * Remove all event listeners. Call when InputManager is no longer needed.
   */
  dispose() {
    // Release pointer lock if active
    if (this.isCursorLocked) {
      document.exitPointerLock();
    }

    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);

    if (this._element) {
      if (this._onMouseMove) this._element.removeEventListener('mousemove', this._onMouseMove);
      if (this._onMouseDown) this._element.removeEventListener('mousedown', this._onMouseDown);
      if (this._onMouseUp) this._element.removeEventListener('mouseup', this._onMouseUp);
    }

    if (this._onPointerLockChange) {
      document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    }

    this.keysDown.clear();
    this.keysPressed.clear();
    this.keysReleased.clear();
  }
}

