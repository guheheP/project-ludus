import * as THREE from 'three';
import { GEOMETRY_TYPES } from '../../engine/components/MeshRenderer.js';
import { MODIFIER_TYPES, SHAPE_PARAMS } from '../../modeling/ProceduralMesh.js';

/**
 * Inspector Panel — Property editor for selected entity
 * Now with ProceduralMesh & modifier stack support
 */
export class Inspector {
  /** @type {HTMLElement} */
  container;

  /** @type {import('../../engine/Entity.js').Entity|null} */
  entity = null;

  /** @type {Function|null} */
  onPropertyChange = null;

  /** @type {Function|null} */
  onModifierChange = null;

  constructor(container) {
    this.container = container;
    this._showEmpty();
  }

  setEntity(entity) {
    this.entity = entity;
    this.refresh();
  }

  refresh() {
    this.container.innerHTML = '';

    if (!this.entity) {
      this._showEmpty();
      return;
    }

    // Entity name
    this._renderEntityName();

    // Transform component
    if (this.entity.hasComponent('Transform')) {
      this._renderTransform();
    }

    // ProceduralMesh component (takes priority over MeshRenderer)
    if (this.entity.hasComponent('ProceduralMesh')) {
      this._renderProceduralMesh();
      this._renderModifierStack();
    } else if (this.entity.hasComponent('MeshRenderer')) {
      this._renderMeshRenderer();
    }

    // Light component
    if (this.entity.hasComponent('Light')) {
      this._renderLight();
    }

    // Script component
    if (this.entity.hasComponent('Script')) {
      this._renderScript();
    }

    // RigidBody component
    if (this.entity.hasComponent('RigidBody')) {
      this._renderRigidBody();
    }

    // Collider component
    if (this.entity.hasComponent('Collider')) {
      this._renderCollider();
    }

    // Audio components
    if (this.entity.hasComponent('AudioListener')) {
      this._renderAudioListener();
    }
    if (this.entity.hasComponent('AudioSource')) {
      this._renderAudioSource();
    }

    // UICanvas
    if (this.entity.hasComponent('UICanvas')) {
      this._renderUICanvas();
    }

    // Add Component button
    this._renderAddComponentButton();
  }

  _showEmpty() {
    this.container.innerHTML = '<div class="inspector-empty">No entity selected</div>';
  }

  // =============================================
  // Entity Name
  // =============================================

  _renderEntityName() {
    const div = document.createElement('div');
    div.className = 'inspector-entity-name';

    const icon = document.createElement('span');
    icon.textContent = '📦';
    icon.style.fontSize = '18px';
    div.appendChild(icon);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = this.entity.name;
    input.addEventListener('change', (e) => {
      this.entity.name = e.target.value;
      this._emitChange();
    });
    div.appendChild(input);

    this.container.appendChild(div);
  }

  // =============================================
  // Transform
  // =============================================

  _renderTransform() {
    const transform = this.entity.getComponent('Transform');
    const section = this._createSection('⊞', 'Transform');
    const body = section.querySelector('.component-body');

    body.appendChild(this._createVec3Row('Position',
      transform.position,
      (axis, val) => { transform.position[axis] = val; this._emitChange(); }
    ));

    const rot = transform.rotation;
    const rad2deg = 180 / Math.PI;
    body.appendChild(this._createVec3Row('Rotation',
      { x: rot.x * rad2deg, y: rot.y * rad2deg, z: rot.z * rad2deg },
      (axis, val) => { rot[axis] = val * Math.PI / 180; this._emitChange(); }
    ));

    body.appendChild(this._createVec3Row('Scale',
      transform.scale,
      (axis, val) => { transform.scale[axis] = val; this._emitChange(); }
    ));

    this.container.appendChild(section);
  }

  // =============================================
  // ProceduralMesh (replaces MeshRenderer display)
  // =============================================

  _renderProceduralMesh() {
    const pm = this.entity.getComponent('ProceduralMesh');
    const section = this._createSection('🔷', 'Procedural Mesh');
    const body = section.querySelector('.component-body');

    // Shape type
    const shapeTypes = Object.keys(SHAPE_PARAMS);
    body.appendChild(this._createSelectRow('Shape', pm.shapeType, shapeTypes, (val) => {
      pm.configure(val, {}, { color: pm.color, metalness: pm.metalness, roughness: pm.roughness });
      this.refresh(); // Rebuild to show new shape params
    }));

    // Shape-specific parameters
    const params = SHAPE_PARAMS[pm.shapeType] || [];
    for (const param of params) {
      const currentVal = pm.shapeParams[param.key] !== undefined ? pm.shapeParams[param.key] : param.default;
      body.appendChild(this._createNumberRow(param.name, currentVal, param.min, param.max, param.step, (val) => {
        pm.setShapeParam(param.key, val);
        this._emitChange();
      }));
    }

    // Separator
    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:var(--border);margin:8px 0;';
    body.appendChild(sep);

    // Material properties
    body.appendChild(this._createColorRow('Color', pm.color, (val) => {
      pm.setColor(val);
      this._emitChange();
    }));

    body.appendChild(this._createNumberRow('Metalness', pm.metalness, 0, 1, 0.05, (val) => {
      pm.setMetalness(val);
      this._emitChange();
    }));

    body.appendChild(this._createNumberRow('Roughness', pm.roughness, 0, 1, 0.05, (val) => {
      pm.setRoughness(val);
      this._emitChange();
    }));

    body.appendChild(this._createCheckboxRow('Wireframe', pm.wireframe, (val) => {
      pm.setWireframe(val);
      this._emitChange();
    }));

    this.container.appendChild(section);
  }

  // =============================================
  // Modifier Stack
  // =============================================

  _renderModifierStack() {
    const pm = this.entity.getComponent('ProceduralMesh');
    const section = document.createElement('div');
    section.className = 'component-section modifier-stack-section';

    // Header
    const header = document.createElement('div');
    header.className = 'component-header';
    header.innerHTML = `
      <span class="component-header-toggle open">▶</span>
      <span class="component-header-icon">📐</span>
      <span class="component-header-name">Modifier Stack</span>
      <span class="modifier-stack-count">${pm.modifiers.length}</span>
    `;

    const body = document.createElement('div');
    body.className = 'component-body modifier-stack-body';

    header.addEventListener('click', () => {
      const toggle = header.querySelector('.component-header-toggle');
      toggle.classList.toggle('open');
      body.classList.toggle('collapsed');
    });

    section.appendChild(header);

    // Render each modifier
    if (pm.modifiers.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'modifier-empty';
      empty.textContent = 'No modifiers. Add one below.';
      body.appendChild(empty);
    } else {
      pm.modifiers.forEach((mod, index) => {
        body.appendChild(this._renderModifierItem(pm, mod, index));
      });
    }

    // Add modifier dropdown
    const addRow = document.createElement('div');
    addRow.className = 'modifier-add-row';

    const select = document.createElement('select');
    select.className = 'prop-select modifier-add-select';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '+ Add Modifier...';
    defaultOpt.disabled = true;
    defaultOpt.selected = true;
    select.appendChild(defaultOpt);

    Object.keys(MODIFIER_TYPES).forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });

    select.addEventListener('change', (e) => {
      const ModClass = MODIFIER_TYPES[e.target.value];
      if (ModClass) {
        pm.addModifier(new ModClass());
        this.refresh();
        this._emitChange();
      }
    });

    addRow.appendChild(select);
    body.appendChild(addRow);

    section.appendChild(body);
    this.container.appendChild(section);
  }

  _renderModifierItem(pm, mod, index) {
    const item = document.createElement('div');
    item.className = `modifier-item ${mod.enabled ? '' : 'modifier-disabled'}`;

    // Modifier header
    const modHeader = document.createElement('div');
    modHeader.className = 'modifier-item-header';

    // Enable checkbox
    const enableCb = document.createElement('input');
    enableCb.type = 'checkbox';
    enableCb.className = 'modifier-enable-cb';
    enableCb.checked = mod.enabled;
    enableCb.addEventListener('change', (e) => {
      e.stopPropagation();
      mod.enabled = e.target.checked;
      pm.rebuild();
      this.refresh();
      this._emitChange();
    });
    modHeader.appendChild(enableCb);

    // Name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'modifier-item-name';
    nameSpan.textContent = mod.name;
    modHeader.appendChild(nameSpan);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'modifier-item-controls';

    // Move up
    if (index > 0) {
      const upBtn = this._createSmallBtn('▲', 'Move Up', () => {
        pm.moveModifier(index, index - 1);
        this.refresh();
        this._emitChange();
      });
      controls.appendChild(upBtn);
    }

    // Move down
    if (index < pm.modifiers.length - 1) {
      const downBtn = this._createSmallBtn('▼', 'Move Down', () => {
        pm.moveModifier(index, index + 1);
        this.refresh();
        this._emitChange();
      });
      controls.appendChild(downBtn);
    }

    // Delete
    const delBtn = this._createSmallBtn('✕', 'Remove', () => {
      pm.removeModifier(index);
      this.refresh();
      this._emitChange();
    });
    delBtn.style.color = 'var(--danger)';
    controls.appendChild(delBtn);

    modHeader.appendChild(controls);

    // Toggle body
    const modBody = document.createElement('div');
    modBody.className = `modifier-item-body ${mod.expanded ? '' : 'collapsed'}`;

    modHeader.addEventListener('click', (e) => {
      if (e.target === enableCb || e.target.closest('.modifier-item-controls')) return;
      mod.expanded = !mod.expanded;
      modBody.classList.toggle('collapsed');
    });

    item.appendChild(modHeader);

    // Parameters
    const params = mod.getParams();
    for (const param of params) {
      if (param.type === 'number') {
        modBody.appendChild(this._createNumberRow(param.name, mod[param.key], param.min, param.max, param.step, (val) => {
          mod.setParam(param.key, val);
          pm.rebuild();
          this._emitChange();
        }));
      } else if (param.type === 'select') {
        modBody.appendChild(this._createSelectRow(param.name, mod[param.key], param.options, (val) => {
          mod.setParam(param.key, val);
          pm.rebuild();
          this._emitChange();
        }));
      }
    }

    item.appendChild(modBody);
    return item;
  }

  // =============================================
  // MeshRenderer (legacy, for non-procedural meshes)
  // =============================================

  _renderMeshRenderer() {
    const mr = this.entity.getComponent('MeshRenderer');
    const section = this._createSection('🔷', 'Mesh Renderer');
    const body = section.querySelector('.component-body');

    body.appendChild(this._createSelectRow('Shape', mr.geometryType,
      Object.keys(GEOMETRY_TYPES),
      (val) => { mr.setGeometry(val, {}); this._emitChange(); }
    ));

    body.appendChild(this._createColorRow('Color', mr.color, (val) => {
      mr.setColor(val); this._emitChange();
    }));

    body.appendChild(this._createNumberRow('Metalness', mr.metalness, 0, 1, 0.05, (val) => {
      mr.metalness = val; if (mr.mesh) mr.mesh.material.metalness = val; this._emitChange();
    }));

    body.appendChild(this._createNumberRow('Roughness', mr.roughness, 0, 1, 0.05, (val) => {
      mr.roughness = val; if (mr.mesh) mr.mesh.material.roughness = val; this._emitChange();
    }));

    body.appendChild(this._createCheckboxRow('Wireframe', mr.wireframe, (val) => {
      mr.wireframe = val; if (mr.mesh) mr.mesh.material.wireframe = val; this._emitChange();
    }));

    this.container.appendChild(section);
  }

  // =============================================
  // Light
  // =============================================

  _renderLight() {
    const light = this.entity.getComponent('Light');
    const section = this._createSection('💡', 'Light');
    const body = section.querySelector('.component-body');

    body.appendChild(this._createSelectRow('Type', light.lightType,
      ['directional', 'point', 'spot', 'ambient'],
      (val) => { light.configure(val, { color: light.color, intensity: light.intensity }); this._emitChange(); }
    ));

    body.appendChild(this._createColorRow('Color', light.color, (val) => {
      light.color = val; if (light.light) light.light.color.set(val); this._emitChange();
    }));

    body.appendChild(this._createNumberRow('Intensity', light.intensity, 0, 10, 0.1, (val) => {
      light.intensity = val; if (light.light) light.light.intensity = val; this._emitChange();
    }));

    this.container.appendChild(section);
  }

  // =============================================
  // Script
  // =============================================

  _renderScript() {
    const script = this.entity.getComponent('Script');
    const section = this._createSection('📝', 'Script');
    const body = section.querySelector('.component-body');

    // Filename
    body.appendChild(this._createTextRow('File', script.fileName, (val) => {
      script.fileName = val;
      this._emitChange();
    }));

    // Enabled
    body.appendChild(this._createCheckboxRow('Enabled', script.enabled, (val) => {
      script.enabled = val;
      this._emitChange();
    }));

    // Error display
    if (script._hasError) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'script-error-badge';
      errorDiv.textContent = '⚠ ' + script._errorMessage;
      body.appendChild(errorDiv);
    }

    // Open in editor hint
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:10px;color:var(--text-muted);margin-top:4px;text-align:center;';
    hint.textContent = 'Click "Script" tab below to edit code';
    body.appendChild(hint);

    this.container.appendChild(section);
  }

  // =============================================
  // RigidBody
  // =============================================

  _renderRigidBody() {
    const rb = this.entity.getComponent('RigidBody');
    const section = this._createSection('⚛️', 'RigidBody');
    const body = section.querySelector('.component-body');

    // Body Type
    body.appendChild(this._createSelectRow('Type', rb.bodyType,
      ['dynamic', 'static', 'kinematic'],
      (val) => { rb.bodyType = val; this._emitChange(); }
    ));

    // Mass (only for dynamic)
    if (rb.bodyType === 'dynamic') {
      body.appendChild(this._createNumberRow('Mass', rb.mass, 0.01, 1000, 0.1, (val) => {
        rb.mass = val; this._emitChange();
      }));
    }

    // Gravity Scale
    body.appendChild(this._createNumberRow('Gravity', rb.gravityScale, 0, 10, 0.1, (val) => {
      rb.gravityScale = val; this._emitChange();
    }));

    // Damping
    body.appendChild(this._createNumberRow('Lin Damp', rb.linearDamping, 0, 10, 0.01, (val) => {
      rb.linearDamping = val; this._emitChange();
    }));
    body.appendChild(this._createNumberRow('Ang Damp', rb.angularDamping, 0, 10, 0.01, (val) => {
      rb.angularDamping = val; this._emitChange();
    }));

    // Lock Rotation
    const lockRow = document.createElement('div');
    lockRow.className = 'prop-row';
    const lockLabel = document.createElement('span');
    lockLabel.className = 'prop-label';
    lockLabel.textContent = 'Lock Rot';
    lockRow.appendChild(lockLabel);
    const lockValue = document.createElement('div');
    lockValue.className = 'prop-value';
    lockValue.style.display = 'flex';
    lockValue.style.gap = '6px';
    lockValue.style.alignItems = 'center';
    ['x', 'y', 'z'].forEach(axis => {
      const lbl = document.createElement('label');
      lbl.style.cssText = 'display:flex;align-items:center;gap:2px;font-size:11px;color:var(--text-secondary);cursor:pointer;';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = rb.lockRotation[axis];
      cb.addEventListener('change', (e) => {
        rb.lockRotation[axis] = e.target.checked;
        this._emitChange();
      });
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(axis.toUpperCase()));
      lockValue.appendChild(lbl);
    });
    lockRow.appendChild(lockValue);
    body.appendChild(lockRow);

    this.container.appendChild(section);
  }

  // =============================================
  // Collider
  // =============================================

  _renderCollider() {
    const col = this.entity.getComponent('Collider');
    const section = this._createSection('🔲', 'Collider');
    const body = section.querySelector('.component-body');

    // Shape
    body.appendChild(this._createSelectRow('Shape', col.shape,
      ['box', 'sphere', 'capsule', 'cylinder'],
      (val) => { col.shape = val; this._emitChange(); this.refresh(); }
    ));

    // Size (box)
    if (col.shape === 'box') {
      body.appendChild(this._createVec3Row('Size', col.size, (axis, val) => {
        col.size[axis] = val; this._emitChange();
      }));
    }

    // Radius (sphere, capsule, cylinder)
    if (col.shape !== 'box') {
      body.appendChild(this._createNumberRow('Radius', col.radius, 0.01, 100, 0.05, (val) => {
        col.radius = val; this._emitChange();
      }));
    }

    // Height (capsule, cylinder)
    if (col.shape === 'capsule' || col.shape === 'cylinder') {
      body.appendChild(this._createNumberRow('Height', col.height, 0.01, 100, 0.1, (val) => {
        col.height = val; this._emitChange();
      }));
    }

    // Restitution
    body.appendChild(this._createNumberRow('Bounce', col.restitution, 0, 1, 0.05, (val) => {
      col.restitution = val; this._emitChange();
    }));

    // Friction
    body.appendChild(this._createNumberRow('Friction', col.friction, 0, 2, 0.05, (val) => {
      col.friction = val; this._emitChange();
    }));

    // Trigger
    body.appendChild(this._createCheckboxRow('Is Trigger', col.isTrigger, (val) => {
      col.isTrigger = val; this._emitChange();
    }));

    // Auto-fit button
    if (this.entity.hasComponent('ProceduralMesh')) {
      const autoBtn = document.createElement('button');
      autoBtn.className = 'modifier-small-btn';
      autoBtn.style.cssText = 'width:100%;margin-top:4px;padding:4px 8px;';
      autoBtn.textContent = '↻ Auto-fit to Mesh';
      autoBtn.addEventListener('click', () => {
        col.autoFit();
        this._emitChange();
        this.refresh();
      });
      body.appendChild(autoBtn);
    }

    this.container.appendChild(section);
  }

  // =============================================
  // Audio
  // =============================================

  _renderAudioListener() {
    const section = this._createSection('🎧', 'AudioListener');
    const body = section.querySelector('.component-body');

    const info = document.createElement('div');
    info.style.cssText = 'font-size:11px; color:var(--text-muted); margin-top:4px;';
    info.textContent = 'Listens for 3D positional audio. Add to Camera.';
    body.appendChild(info);

    this.container.appendChild(section);
  }

  _renderAudioSource() {
    const section = this._createSection('🎵', 'AudioSource');
    const body = section.querySelector('.component-body');

    const src = this.entity.getComponent('AudioSource');

    // Asset ID (Can drag from project browser)
    const assetRow = document.createElement('div');
    assetRow.style.cssText = 'display:flex; justify-content:space-between; margin-bottom:8px; align-items:center; border: 1px dashed var(--border-light); padding:4px; border-radius: 4px; border-color: #3b82f633;';
    const label = document.createElement('div');
    label.textContent = 'Audio Asset';
    label.style.fontSize = '12px';
    const dropZone = document.createElement('div');
    dropZone.textContent = src.assetId ? 'Asset Bound' : 'Drop Audio Here';
    dropZone.style.cssText = 'font-size:11px; opacity:0.8;';
    
    // Drag and drop onto row
    assetRow.addEventListener('dragover', (e) => { e.preventDefault(); assetRow.style.background = 'var(--bg-hover)'; });
    assetRow.addEventListener('dragleave', () => { assetRow.style.background = ''; });
    assetRow.addEventListener('drop', (e) => {
      e.preventDefault();
      assetRow.style.background = '';
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data.type === 'asset' && data.assetType === 'audio') {
          src.assetId = data.id;
          this._emitChange();
          this.refresh();
        }
      } catch (err) {}
    });
    assetRow.appendChild(label);
    assetRow.appendChild(dropZone);
    body.appendChild(assetRow);

    body.appendChild(this._createCheckboxRow('Autoplay', src.autoplay, (val) => {
      src.autoplay = val; this._emitChange();
    }));
    body.appendChild(this._createCheckboxRow('Loop', src.loop, (val) => {
      src.loop = val; this._emitChange();
    }));
    body.appendChild(this._createNumberRow('Volume', src.volume, 0, 1, 0.1, (val) => {
      src.volume = val; this._emitChange();
    }));
    body.appendChild(this._createCheckboxRow('3D Spatial', src.spatial, (val) => {
      src.spatial = val; this._emitChange();
    }));

    this.container.appendChild(section);
  }

  _renderUICanvas() {
    const section = this._createSection('🖼️', 'UICanvas');
    const body = section.querySelector('.component-body');

    const canvas = this.entity.getComponent('UICanvas');

    body.appendChild(this._createCheckboxRow('Overlay', canvas.overlay, (val) => {
      canvas.overlay = val; this._emitChange();
    }));

    const info = document.createElement('div');
    info.style.cssText = 'font-size:11px; color:var(--text-muted); margin-top:4px;';
    info.textContent = 'Enables game UI (HUD) via this.ui in scripts.';
    body.appendChild(info);

    this.container.appendChild(section);
  }

  // =============================================
  // Add Component Button
  // =============================================

  _renderAddComponentButton() {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding:8px 12px;';

    const btn = document.createElement('button');
    btn.className = 'add-component-btn';
    btn.innerHTML = '<span>+</span> Add Component';
    btn.addEventListener('click', () => {
      this._showAddComponentMenu(btn);
    });
    wrapper.appendChild(btn);
    this.container.appendChild(wrapper);
  }

  _showAddComponentMenu(anchor) {
    // Remove any existing menu
    const existing = document.querySelector('.add-component-menu');
    if (existing) { existing.remove(); return; }

    const menu = document.createElement('div');
    menu.className = 'add-component-menu';
    menu.style.cssText = `
      position: absolute;
      background: var(--bg-secondary);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      padding: 4px 0;
      min-width: 180px;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    `;

    const items = [];
    if (!this.entity.hasComponent('Script')) {
      items.push({ label: '📝 Script', comp: 'Script' });
    }
    if (!this.entity.hasComponent('RigidBody')) {
      items.push({ label: '⚛️ RigidBody', comp: 'RigidBody' });
    }
    if (!this.entity.hasComponent('Collider')) {
      items.push({ label: '🔲 Collider', comp: 'Collider' });
    }
    if (!this.entity.hasComponent('AudioListener')) {
      items.push({ label: '🎧 AudioListener', comp: 'AudioListener' });
    }
    if (!this.entity.hasComponent('AudioSource')) {
      items.push({ label: '🎵 AudioSource', comp: 'AudioSource' });
    }
    if (!this.entity.hasComponent('UICanvas')) {
      items.push({ label: '🖼️ UICanvas', comp: 'UICanvas' });
    }

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:8px 12px;color:var(--text-muted);font-size:11px;';
      empty.textContent = 'All components added';
      menu.appendChild(empty);
    }

    for (const item of items) {
      const row = document.createElement('div');
      row.style.cssText = 'padding:6px 12px;cursor:pointer;font-size:12px;color:var(--text-primary);transition:background 0.15s;';
      row.textContent = item.label;
      row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg-hover)'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });
      row.addEventListener('click', () => {
        this._addComponentByType(item.comp);
        menu.remove();
      });
      menu.appendChild(row);
    }

    // Position menu
    const rect = anchor.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 4) + 'px';
    document.body.appendChild(menu);

    // Close on outside click
    const closeHandler = (e) => {
      if (!menu.contains(e.target) && e.target !== anchor) {
        menu.remove();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
  }

  _addComponentByType(type) {
    if (!this.entity) return;

    if (type === 'RigidBody') {
      // Dynamically import to avoid circular deps at module load
      import('../../engine/components/RigidBody.js').then(({ RigidBody }) => {
        const rb = new RigidBody();
        this.entity.addComponent(rb);
        this._emitChange();
        this.refresh();
      });
    } else if (type === 'Collider') {
      import('../../engine/components/Collider.js').then(({ Collider }) => {
        const col = new Collider();
        // Auto-fit if there's a mesh
        this.entity.addComponent(col);
        col.autoFit();
        this._emitChange();
        this.refresh();
      });
    } else if (type === 'Script') {
      import('../../engine/components/Script.js').then(({ ScriptComponent }) => {
        const s = new ScriptComponent();
        this.entity.addComponent(s);
        this._emitChange();
        this.refresh();
      });
    } else if (type === 'AudioListener') {
      import('../../engine/components/AudioListener.js').then(({ AudioListener }) => {
        const al = new AudioListener();
        this.entity.addComponent(al);
        this._emitChange();
        this.refresh();
      });
    } else if (type === 'AudioSource') {
      import('../../engine/components/AudioSource.js').then(({ AudioSource }) => {
        const as = new AudioSource();
        this.entity.addComponent(as);
        this._emitChange();
        this.refresh();
      });
    } else if (type === 'UICanvas') {
      import('../../engine/components/UICanvas.js').then(({ UICanvas }) => {
        const uc = new UICanvas();
        this.entity.addComponent(uc);
        this._emitChange();
        this.refresh();
      });
    }
  }

  // =============================================
  // UI Helper Methods
  // =============================================

  _createSection(icon, title) {
    const section = document.createElement('div');
    section.className = 'component-section';

    const header = document.createElement('div');
    header.className = 'component-header';

    const toggle = document.createElement('span');
    toggle.className = 'component-header-toggle open';
    toggle.textContent = '▶';
    header.appendChild(toggle);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'component-header-icon';
    iconSpan.textContent = icon;
    header.appendChild(iconSpan);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'component-header-name';
    titleSpan.textContent = title;
    header.appendChild(titleSpan);

    const body = document.createElement('div');
    body.className = 'component-body';

    header.addEventListener('click', () => {
      toggle.classList.toggle('open');
      body.classList.toggle('collapsed');
    });

    section.appendChild(header);
    section.appendChild(body);
    return section;
  }

  _createVec3Row(label, vec, onChange) {
    const row = document.createElement('div');
    row.className = 'prop-row';

    const lbl = document.createElement('span');
    lbl.className = 'prop-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const value = document.createElement('div');
    value.className = 'prop-value';

    ['x', 'y', 'z'].forEach(axis => {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = `prop-input prop-input-${axis}`;
      input.value = parseFloat(vec[axis]).toFixed(2);
      input.step = '0.1';
      input.addEventListener('change', (e) => {
        onChange(axis, parseFloat(e.target.value) || 0);
      });
      this._addDragBehavior(input, (delta) => {
        const newVal = parseFloat(input.value) + delta * 0.01;
        input.value = newVal.toFixed(2);
        onChange(axis, newVal);
      });
      value.appendChild(input);
    });

    row.appendChild(value);
    return row;
  }

  _createNumberRow(label, currentValue, min, max, step, onChange) {
    const row = document.createElement('div');
    row.className = 'prop-row';

    const lbl = document.createElement('span');
    lbl.className = 'prop-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const value = document.createElement('div');
    value.className = 'prop-value';

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'prop-input';
    input.value = parseFloat(currentValue).toFixed(2);
    input.min = min;
    input.max = max;
    input.step = step;
    input.addEventListener('change', (e) => {
      onChange(parseFloat(e.target.value) || 0);
    });
    value.appendChild(input);

    row.appendChild(value);
    return row;
  }

  _createColorRow(label, currentColor, onChange) {
    const row = document.createElement('div');
    row.className = 'prop-row';

    const lbl = document.createElement('span');
    lbl.className = 'prop-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const value = document.createElement('div');
    value.className = 'prop-value';

    // Convert any color format to hex for the color input
    let hexColor = currentColor;
    if (currentColor && !currentColor.startsWith('#')) {
      const tempColor = new THREE.Color(currentColor);
      hexColor = '#' + tempColor.getHexString();
    }

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'prop-color';
    colorInput.value = hexColor;
    colorInput.addEventListener('input', (e) => {
      textInput.value = e.target.value;
      onChange(e.target.value);
    });
    value.appendChild(colorInput);

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'prop-input';
    textInput.value = hexColor;
    textInput.addEventListener('change', (e) => {
      colorInput.value = e.target.value;
      onChange(e.target.value);
    });
    value.appendChild(textInput);

    row.appendChild(value);
    return row;
  }

  _createSelectRow(label, currentValue, options, onChange) {
    const row = document.createElement('div');
    row.className = 'prop-row';

    const lbl = document.createElement('span');
    lbl.className = 'prop-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const value = document.createElement('div');
    value.className = 'prop-value';

    const select = document.createElement('select');
    select.className = 'prop-select';
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
      if (opt === currentValue) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', (e) => onChange(e.target.value));
    value.appendChild(select);

    row.appendChild(value);
    return row;
  }

  _createCheckboxRow(label, currentValue, onChange) {
    const row = document.createElement('div');
    row.className = 'prop-row';

    const lbl = document.createElement('span');
    lbl.className = 'prop-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const value = document.createElement('div');
    value.className = 'prop-value';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'prop-checkbox';
    checkbox.checked = currentValue;
    checkbox.addEventListener('change', (e) => onChange(e.target.checked));
    value.appendChild(checkbox);

    row.appendChild(value);
    return row;
  }

  _createTextRow(label, currentValue, onChange) {
    const row = document.createElement('div');
    row.className = 'prop-row';

    const lbl = document.createElement('span');
    lbl.className = 'prop-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const value = document.createElement('div');
    value.className = 'prop-value';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'prop-input';
    input.value = currentValue;
    input.addEventListener('change', (e) => onChange(e.target.value));
    value.appendChild(input);

    row.appendChild(value);
    return row;
  }

  _createSmallBtn(text, tooltip, onClick) {
    const btn = document.createElement('button');
    btn.className = 'modifier-small-btn';
    btn.textContent = text;
    btn.title = tooltip;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  _addDragBehavior(input, onChange) {
    let isDragging = false;
    let startX = 0;

    input.addEventListener('mousedown', (e) => {
      if (document.activeElement === input) return;
      isDragging = true;
      startX = e.clientX;
      input.style.cursor = 'ew-resize';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const delta = e.clientX - startX;
      startX = e.clientX;
      onChange(delta);
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        input.style.cursor = '';
      }
    });
  }

  _emitChange() {
    if (this.onPropertyChange) {
      this.onPropertyChange(this.entity);
    }
  }
}
