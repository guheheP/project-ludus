/**
 * Toolbar — Top menu bar with tools and play controls
 */
export class Toolbar {
  /** @type {HTMLElement} */
  container;

  /** @type {Function|null} */
  onTransformModeChange = null;

  /** @type {Function|null} */
  onAddEntity = null;

  /** @type {Function|null} */
  onSnapToggle = null;

  /** @type {Function|null} */
  onDelete = null;

  /** @type {Function|null} */
  onDuplicate = null;

  /** @type {Function|null} */
  onSave = null;

  /** @type {Function|null} */
  onLoad = null;

  /** @type {Function|null} */
  onExport = null;

  /** @type {string} */
  currentMode = 'translate';

  /** @type {boolean} */
  snapEnabled = false;

  constructor(container) {
    this.container = container;
    this._build();
  }

  _build() {
    this.container.innerHTML = '';

    // Title
    const title = document.createElement('span');
    title.className = 'toolbar-title';
    title.textContent = '⬡ Project Ludus';
    this.container.appendChild(title);

    // Transform tools
    const transformGroup = this._createGroup();
    this.btnTranslate = this._addButton(transformGroup, '⊞', 'Move (W)', 'translate', true);
    this.btnRotate = this._addButton(transformGroup, '↻', 'Rotate (E)', 'rotate');
    this.btnScale = this._addButton(transformGroup, '⤡', 'Scale (R)', 'scale');
    this.container.appendChild(transformGroup);

    this._addSeparator();

    // Snap toggle
    const snapGroup = this._createGroup();
    this.btnSnap = this._addButton(snapGroup, '⊡', 'Snap (G)', 'snap');
    this.container.appendChild(snapGroup);

    this._addSeparator();

    // Add objects
    const addGroup = this._createGroup();
    this._addButton(addGroup, '⬜', 'Cube', 'add-box');
    this._addButton(addGroup, '⬤', 'Sphere', 'add-sphere');
    this._addButton(addGroup, '▣', 'Cylinder', 'add-cylinder');
    this._addButton(addGroup, '◇', 'Cone', 'add-cone');
    this._addButton(addGroup, '◎', 'Torus', 'add-torus');
    this._addButton(addGroup, '▬', 'Plane', 'add-plane');
    this.container.appendChild(addGroup);

    this._addSeparator();

    // Lighting
    const lightGroup = this._createGroup();
    this._addButton(lightGroup, '☀️', 'Dir Light', 'add-dirlight');
    this._addButton(lightGroup, '💡', 'Point Light', 'add-pointlight');
    this.container.appendChild(lightGroup);

    this._addSeparator();

    // File operations
    const fileGroup = this._createGroup();
    this._addButton(fileGroup, '💾', 'Save Scene (Ctrl+S)', 'save');
    this._addButton(fileGroup, '📂', 'Load Scene (Ctrl+O)', 'load');
    this._addButton(fileGroup, '📦', 'Export Game (.zip)', 'export');
    this.container.appendChild(fileGroup);

    // Play controls (centered)
    const playGroup = document.createElement('div');
    playGroup.className = 'toolbar-play-group';
    this.btnPlay = this._addPlayButton(playGroup, '▶', 'Play');
    this.btnPause = this._addPlayButton(playGroup, '⏸', 'Pause');
    this.btnStop = this._addPlayButton(playGroup, '⏹', 'Stop');
    this.container.appendChild(playGroup);

    // Bind click events
    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest('.toolbar-btn');
      if (!btn) return;

      const action = btn.dataset.action;
      if (!action) return;

      switch (action) {
        case 'translate':
        case 'rotate':
        case 'scale':
          this._setTransformMode(action);
          break;
        case 'snap':
          this.snapEnabled = !this.snapEnabled;
          btn.classList.toggle('active', this.snapEnabled);
          if (this.onSnapToggle) this.onSnapToggle(this.snapEnabled);
          break;
        case 'add-box':
          this.onAddEntity?.('box');
          break;
        case 'add-sphere':
          this.onAddEntity?.('sphere');
          break;
        case 'add-cylinder':
          this.onAddEntity?.('cylinder');
          break;
        case 'add-cone':
          this.onAddEntity?.('cone');
          break;
        case 'add-torus':
          this.onAddEntity?.('torus');
          break;
        case 'add-plane':
          this.onAddEntity?.('plane');
          break;
        case 'add-dirlight':
          this.onAddEntity?.('directional-light');
          break;
        case 'add-pointlight':
          this.onAddEntity?.('point-light');
          break;
        case 'save':
          this.onSave?.();
          break;
        case 'load':
          this.onLoad?.();
          break;
        case 'export':
          this.onExport?.();
          break;
      }
    });
  }

  _createGroup() {
    const group = document.createElement('div');
    group.className = 'toolbar-group';
    return group;
  }

  _addButton(group, icon, tooltip, action, active = false) {
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn' + (active ? ' active' : '');
    btn.title = tooltip;
    btn.dataset.action = action;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'toolbar-btn-icon';
    iconSpan.textContent = icon;
    btn.appendChild(iconSpan);

    group.appendChild(btn);
    return btn;
  }

  _addPlayButton(group, icon, tooltip) {
    const btn = document.createElement('button');
    btn.className = 'toolbar-play-btn';
    btn.title = tooltip;
    btn.textContent = icon;
    group.appendChild(btn);
    return btn;
  }

  _addSeparator() {
    const sep = document.createElement('div');
    sep.className = 'toolbar-separator';
    this.container.appendChild(sep);
  }

  _setTransformMode(mode) {
    this.currentMode = mode;
    this.btnTranslate.classList.toggle('active', mode === 'translate');
    this.btnRotate.classList.toggle('active', mode === 'rotate');
    this.btnScale.classList.toggle('active', mode === 'scale');
    if (this.onTransformModeChange) {
      this.onTransformModeChange(mode);
    }
  }

  /**
   * Handle keyboard shortcuts
   * @param {string} key
   */
  handleKey(key) {
    switch (key.toLowerCase()) {
      case 'w': this._setTransformMode('translate'); break;
      case 'e': this._setTransformMode('rotate'); break;
      case 'r': this._setTransformMode('scale'); break;
      case 'g':
        this.snapEnabled = !this.snapEnabled;
        this.btnSnap.classList.toggle('active', this.snapEnabled);
        if (this.onSnapToggle) this.onSnapToggle(this.snapEnabled);
        break;
    }
  }
}
