import { createIcon } from '../utils/Icon.js';

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
  onVertexEditToggle = null;

  /** @type {Function|null} */
  onSymmetryToggle = null;

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

  /** @type {Function|null} */
  onPreview = null;

  /** @type {Function|null} */
  onOpenProject = null;

  /** @type {Function|null} */
  onUndo = null;

  /** @type {Function|null} */
  onRedo = null;

  /** @type {string} */
  currentMode = 'translate';

  /** @type {boolean} */
  snapEnabled = false;

  /** @type {boolean} */
  vertexEditEnabled = false;

  /** @type {{x:boolean, y:boolean, z:boolean}} */
  symmetryEnabled = { x: false, y: false, z: false };

  constructor(container) {
    this.container = container;
    this._build();
  }

  _build() {
    this.container.innerHTML = '';

    // Title
    const title = document.createElement('span');
    title.className = 'toolbar-title';
    title.textContent = 'Project Ludus';
    this.container.appendChild(title);

    // Transform tools
    const transformGroup = this._createGroup();
    this.btnTranslate = this._addButton(transformGroup, 'translate', 'Move (W)', 'translate', true);
    this.btnRotate = this._addButton(transformGroup, 'rotate', 'Rotate (E)', 'rotate');
    this.btnScale = this._addButton(transformGroup, 'scale', 'Scale (R)', 'scale');
    
    // Add small separator inside group
    const inlineSep = document.createElement('div');
    inlineSep.style.cssText = 'width:1px; height:16px; background:var(--border); margin:0 4px; display:inline-block; vertical-align:middle;';
    transformGroup.appendChild(inlineSep);
    
    
    this.btnVertexEdit = this._addButton(transformGroup, 'vertex-edit', 'Vertex Edit (V)', 'vertex-edit');
    
    // Symmetry buttons
    const symSep = document.createElement('div');
    symSep.style.cssText = 'width:1px; height:16px; background:var(--border); margin:0 4px; display:inline-block; vertical-align:middle;';
    transformGroup.appendChild(symSep);
    
    this.btnSymX = this._addButton(transformGroup, 'sym-x', 'X Symmetry', 'sym-x');
    this.btnSymY = this._addButton(transformGroup, 'sym-y', 'Y Symmetry', 'sym-y');
    this.btnSymZ = this._addButton(transformGroup, 'sym-z', 'Z Symmetry', 'sym-z');

    this.container.appendChild(transformGroup);

    this._addSeparator();

    // Snap toggle
    const snapGroup = this._createGroup();
    this.btnSnap = this._addButton(snapGroup, 'snap', 'Snap (G)', 'snap');
    this.container.appendChild(snapGroup);

    this._addSeparator();

    // Add objects
    const addGroup = this._createGroup();
    this._addButton(addGroup, 'add-box', 'Cube', 'add-box');
    this._addButton(addGroup, 'add-sphere', 'Sphere', 'add-sphere');
    this._addButton(addGroup, 'add-cylinder', 'Cylinder', 'add-cylinder');
    this._addButton(addGroup, 'add-cone', 'Cone', 'add-cone');
    this._addButton(addGroup, 'add-torus', 'Torus', 'add-torus');
    this._addButton(addGroup, 'add-plane', 'Plane', 'add-plane');
    this.container.appendChild(addGroup);

    this._addSeparator();

    // Lighting
    const lightGroup = this._createGroup();
    this._addButton(lightGroup, 'add-dirlight', 'Dir Light', 'add-dirlight');
    this._addButton(lightGroup, 'add-pointlight', 'Point Light', 'add-pointlight');
    this._addButton(lightGroup, 'add-camera', 'Camera', 'add-camera');
    this.container.appendChild(lightGroup);

    this._addSeparator();

    // Effects
    const fxGroup = this._createGroup();
    this._addButton(fxGroup, 'add-particle', 'Particle Emitter', 'add-particle');
    this.container.appendChild(fxGroup);

    this._addSeparator();

    // File operations
    const fileGroup = this._createGroup();
    this._addButton(fileGroup, 'save', 'Save Scene (Ctrl+S)', 'save');
    this._addButton(fileGroup, 'load', 'Load Scene (Ctrl+O)', 'load');
    this._addButton(fileGroup, 'export', 'Export Game (.zip)', 'export');
    this._addButton(fileGroup, 'preview', 'Preview (F8)', 'preview');
    this.container.appendChild(fileGroup);

    this._addSeparator();

    // Project operations
    const projectGroup = this._createGroup();
    this._addButton(projectGroup, '🗂️', 'Open Project Folder', 'open-project');
    this.projectIndicator = document.createElement('span');
    this.projectIndicator.className = 'toolbar-project-indicator';
    this.projectIndicator.textContent = '';
    projectGroup.appendChild(this.projectIndicator);
    this.container.appendChild(projectGroup);

    this._addSeparator();

    // Undo/Redo
    const undoGroup = this._createGroup();
    this.btnUndo = this._addButton(undoGroup, 'undo', 'Undo (Ctrl+Z)', 'undo');
    this.btnRedo = this._addButton(undoGroup, 'redo', 'Redo (Ctrl+Y)', 'redo');
    this.btnUndo.classList.add('disabled');
    this.btnRedo.classList.add('disabled');
    this.container.appendChild(undoGroup);

    // Play controls (centered)
    const playGroup = document.createElement('div');
    playGroup.className = 'toolbar-play-group';
    this.btnPlay = this._addPlayButton(playGroup, 'play', 'Play');
    this.btnPause = this._addPlayButton(playGroup, 'pause', 'Pause');
    this.btnStop = this._addPlayButton(playGroup, 'stop', 'Stop');
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
        case 'vertex-edit':
          this.vertexEditEnabled = !this.vertexEditEnabled;
          btn.classList.toggle('active', this.vertexEditEnabled);
          if (this.onVertexEditToggle) this.onVertexEditToggle(this.vertexEditEnabled);
          break;
        case 'sym-x':
          this._setSymmetry('x', !this.symmetryEnabled.x);
          break;
        case 'sym-y':
          this._setSymmetry('y', !this.symmetryEnabled.y);
          break;
        case 'sym-z':
          this._setSymmetry('z', !this.symmetryEnabled.z);
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
        case 'add-particle':
          this.onAddEntity?.('particle');
          break;
        case 'add-camera':
          this.onAddEntity?.('camera');
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
        case 'preview':
          this.onPreview?.();
          break;
        case 'open-project':
          this.onOpenProject?.();
          break;
        case 'undo':
          this.onUndo?.();
          break;
        case 'redo':
          this.onRedo?.();
          break;
      }
    });
  }

  _createGroup() {
    const group = document.createElement('div');
    group.className = 'toolbar-group';
    return group;
  }

  _addButton(group, iconName, tooltip, action, active = false) {
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn' + (active ? ' active' : '');
    btn.title = tooltip;
    btn.dataset.action = action;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'toolbar-btn-icon';
    iconSpan.appendChild(createIcon(iconName));
    btn.appendChild(iconSpan);

    group.appendChild(btn);
    return btn;
  }

  _addPlayButton(group, iconName, tooltip) {
    const btn = document.createElement('button');
    btn.className = 'toolbar-play-btn';
    btn.title = tooltip;
    btn.appendChild(createIcon(iconName, { width: 14, height: 14 }));
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

  _setSymmetry(axis, enabled) {
    this.symmetryEnabled[axis] = enabled;
    
    if (axis === 'x') this.btnSymX.classList.toggle('active', enabled);
    if (axis === 'y') this.btnSymY.classList.toggle('active', enabled);
    if (axis === 'z') this.btnSymZ.classList.toggle('active', enabled);

    if (this.onSymmetryToggle) {
      this.onSymmetryToggle(axis, enabled);
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
      case 'v':
        this.vertexEditEnabled = !this.vertexEditEnabled;
        this.btnVertexEdit.classList.toggle('active', this.vertexEditEnabled);
        if (this.onVertexEditToggle) this.onVertexEditToggle(this.vertexEditEnabled);
        break;
    }
  }

  /**
   * Update the project state indicator
   * @param {boolean} isOpen
   * @param {boolean} isDirty
   */
  setProjectState(isOpen, isDirty) {
    if (!this.projectIndicator) return;
    if (isOpen) {
      const dot = isDirty ? '●' : '✓';
      this.projectIndicator.textContent = `${dot} Project`;
      this.projectIndicator.style.color = isDirty ? '#f5a623' : '#4ade80';
    } else {
      this.projectIndicator.textContent = '';
    }
  }

  /**
   * Update undo/redo button states
   * @param {boolean} canUndo
   * @param {boolean} canRedo
   */
  setUndoState(canUndo, canRedo) {
    if (this.btnUndo) {
      this.btnUndo.classList.toggle('disabled', !canUndo);
    }
    if (this.btnRedo) {
      this.btnRedo.classList.toggle('disabled', !canRedo);
    }
  }
}
