/**
 * UISystem — Manages HTML overlay for game UI during play mode
 * Creates/destroys UI elements via a script-friendly API.
 */
export class UISystem {
  constructor() {
    /** @type {HTMLElement|null} */
    this.container = null;

    /** @type {Map<string, HTMLElement>} id -> element */
    this.elements = new Map();

    /** @type {number} Auto-increment for IDs */
    this._idCounter = 0;
  }

  /**
   * Called when entering play mode
   * @param {HTMLElement} sceneContainer - the scene-container div to overlay on
   */
  init(sceneContainer) {
    // Create overlay container
    this.container = document.createElement('div');
    this.container.id = 'ui-overlay';
    this.container.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 10;
      overflow: hidden;
      font-family: 'Inter', sans-serif;
    `;
    sceneContainer.style.position = 'relative';
    sceneContainer.appendChild(this.container);
  }

  /**
   * Called when leaving play mode
   */
  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.elements.clear();
    this._idCounter = 0;
  }

  /**
   * Generate a unique ID
   */
  _nextId() {
    return 'ui_' + (this._idCounter++);
  }

  /**
   * Create a text label
   * @param {string} text
   * @param {object} options - { x, y, fontSize, color, fontWeight, textAlign, id }
   * @returns {string} element ID
   */
  createText(text, options = {}) {
    const id = options.id || this._nextId();
    const el = document.createElement('div');
    el.style.cssText = `
      position: absolute;
      left: ${options.x ?? 10}px;
      top: ${options.y ?? 10}px;
      font-size: ${options.fontSize ?? 16}px;
      color: ${options.color ?? '#ffffff'};
      font-weight: ${options.fontWeight ?? '400'};
      text-align: ${options.textAlign ?? 'left'};
      text-shadow: 1px 1px 3px rgba(0,0,0,0.7);
      pointer-events: none;
      white-space: pre-wrap;
    `;
    el.textContent = text;
    this.container.appendChild(el);
    this.elements.set(id, el);
    return id;
  }

  /**
   * Create a button
   * @param {string} label
   * @param {Function} onClick
   * @param {object} options - { x, y, width, height, fontSize, bgColor, color, id }
   * @returns {string} element ID
   */
  createButton(label, onClick, options = {}) {
    const id = options.id || this._nextId();
    const el = document.createElement('button');
    el.style.cssText = `
      position: absolute;
      left: ${options.x ?? 10}px;
      top: ${options.y ?? 10}px;
      min-width: ${options.width ?? 120}px;
      height: ${options.height ?? 36}px;
      font-size: ${options.fontSize ?? 14}px;
      background: ${options.bgColor ?? 'rgba(59,130,246,0.85)'};
      color: ${options.color ?? '#ffffff'};
      border: none;
      border-radius: 6px;
      cursor: pointer;
      pointer-events: auto;
      font-family: 'Inter', sans-serif;
      font-weight: 500;
      transition: background 0.2s, transform 0.1s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    el.textContent = label;
    el.addEventListener('mouseenter', () => {
      el.style.filter = 'brightness(1.15)';
      el.style.transform = 'scale(1.03)';
    });
    el.addEventListener('mouseleave', () => {
      el.style.filter = '';
      el.style.transform = '';
    });
    if (onClick) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
    }
    this.container.appendChild(el);
    this.elements.set(id, el);
    return id;
  }

  /**
   * Create a progress bar (e.g. health bar)
   * @param {number} value - 0 to 1
   * @param {object} options - { x, y, width, height, bgColor, fillColor, id }
   * @returns {string} element ID
   */
  createProgressBar(value, options = {}) {
    const id = options.id || this._nextId();
    const width = options.width ?? 200;
    const height = options.height ?? 20;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position: absolute;
      left: ${options.x ?? 10}px;
      top: ${options.y ?? 10}px;
      width: ${width}px;
      height: ${height}px;
      background: ${options.bgColor ?? 'rgba(0,0,0,0.5)'};
      border-radius: ${height / 2}px;
      overflow: hidden;
      pointer-events: none;
      border: 1px solid rgba(255,255,255,0.15);
    `;

    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.cssText = `
      height: 100%;
      width: ${Math.max(0, Math.min(1, value)) * 100}%;
      background: ${options.fillColor ?? 'linear-gradient(90deg, #22c55e, #4ade80)'};
      border-radius: ${height / 2}px;
      transition: width 0.25s ease;
    `;

    wrapper.appendChild(fill);
    this.container.appendChild(wrapper);
    this.elements.set(id, wrapper);
    return id;
  }

  /**
   * Create an image element
   * @param {string} src - image URL (can be from AssetManager)
   * @param {object} options - { x, y, width, height, id }
   * @returns {string} element ID
   */
  createImage(src, options = {}) {
    const id = options.id || this._nextId();
    const el = document.createElement('img');
    el.src = src;
    el.style.cssText = `
      position: absolute;
      left: ${options.x ?? 10}px;
      top: ${options.y ?? 10}px;
      width: ${options.width ?? 64}px;
      height: ${options.height ?? 'auto'};
      pointer-events: none;
      object-fit: contain;
    `;
    this.container.appendChild(el);
    this.elements.set(id, el);
    return id;
  }

  /**
   * Update the text content of an element
   */
  updateText(id, newText) {
    const el = this.elements.get(id);
    if (el) el.textContent = newText;
  }

  /**
   * Update progress bar value (0 to 1)
   */
  updateProgressBar(id, value) {
    const el = this.elements.get(id);
    if (!el) return;
    const fill = el.querySelector('.progress-fill');
    if (fill) {
      fill.style.width = Math.max(0, Math.min(1, value)) * 100 + '%';
    }
  }

  /**
   * Set position of an element
   */
  setPosition(id, x, y) {
    const el = this.elements.get(id);
    if (el) {
      el.style.left = x + 'px';
      el.style.top = y + 'px';
    }
  }

  /**
   * Set visibility
   */
  setVisible(id, visible) {
    const el = this.elements.get(id);
    if (el) el.style.display = visible ? '' : 'none';
  }

  /**
   * Remove an element
   */
  removeElement(id) {
    const el = this.elements.get(id);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
    this.elements.delete(id);
  }

  /**
   * Remove all elements
   */
  clearAll() {
    this.elements.forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    this.elements.clear();
    this._idCounter = 0;
  }
}
