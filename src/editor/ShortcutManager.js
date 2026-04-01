// @ts-check
/**
 * ShortcutManager — Centralized keyboard shortcut handling
 * Extracted from Editor.js for maintainability (Phase 20-1)
 */
export class ShortcutManager {
  /** @type {Map<string, Function>} */
  _shortcuts = new Map();

  /** @type {boolean} */
  _enabled = true;

  constructor() {
    this._onKeyDown = this._onKeyDown.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
  }

  /**
   * Register a shortcut
   * @param {string} key - Key identifier (e.g. 'Delete', 'ctrl+d', 'f5')
   * @param {Function} handler - Handler function receiving the KeyboardEvent
   */
  register(key, handler) {
    this._shortcuts.set(key.toLowerCase(), handler);
  }

  /**
   * Register multiple shortcuts at once
   * @param {Object<string, Function>} map
   */
  registerAll(map) {
    for (const [key, handler] of Object.entries(map)) {
      this.register(key, handler);
    }
  }

  /**
   * Enable/disable shortcut processing
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this._enabled = enabled;
  }

  /**
   * @param {KeyboardEvent} e
   */
  _onKeyDown(e) {
    if (!this._enabled) return;

    // Don't hijack Monaco editor, input fields, etc.
    const target = /** @type {HTMLElement} */ (e.target);
    if (target.closest?.('.monaco-editor')) return;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // Build the key identifier
    let keyId = e.key.toLowerCase();
    if (ctrl && shift) keyId = `ctrl+shift+${keyId}`;
    else if (ctrl) keyId = `ctrl+${keyId}`;
    else if (shift && e.key.length > 1) keyId = `shift+${keyId}`;

    const handler = this._shortcuts.get(keyId);
    if (handler) {
      handler(e);
    }
  }

  /**
   * Clean up
   */
  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    this._shortcuts.clear();
  }
}
