/**
 * Hierarchy Panel — Tree view of all entities in the scene
 */
export class Hierarchy {
  /** @type {HTMLElement} */
  container;

  /** @type {import('../engine/Scene.js').Scene|null} */
  scene = null;

  /** @type {import('../engine/Entity.js').Entity|null} */
  selectedEntity = null;

  /** @type {Function|null} */
  onSelectEntity = null;

  /** @type {Function|null} */
  onContextMenu = null;

  /** @type {Function|null} Called when entity is reparented via D&D */
  onReparent = null;

  /** @type {number|null} Entity ID being dragged */
  _dragEntityId = null;

  /** @type {Set<number>} Hidden entity IDs (visibility toggled off) */
  hiddenIds = new Set();

  /** @type {Set<number>} Locked entity IDs (selection locked) */
  lockedIds = new Set();

  /** @type {Set<number>} */
  expandedIds = new Set();

  constructor(container) {
    this.container = container;
    this._bindEvents();
  }

  _bindEvents() {
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.onContextMenu) {
        // Find entity from clicked element
        const item = e.target.closest('.hierarchy-item');
        const entityId = item ? parseInt(item.dataset.entityId) : null;
        const entity = entityId !== null ? this.scene?.getEntityById(entityId) : null;
        this.onContextMenu(e.clientX, e.clientY, entity);
      }
    });
  }

  /**
   * Set the scene to display
   * @param {import('../engine/Scene.js').Scene} scene
   */
  setScene(scene) {
    this.scene = scene;
    // Expand root by default
    this.expandedIds.add(scene.root.id);
    this.refresh();
  }

  /**
   * Set selected entity
   * @param {import('../engine/Entity.js').Entity|null} entity
   */
  setSelected(entity) {
    this.selectedEntity = entity;
    this.refresh();
  }

  /**
   * Refresh the tree view
   */
  refresh() {
    if (!this.scene) return;

    this.container.innerHTML = '';
    const tree = document.createElement('div');
    tree.className = 'hierarchy-tree';
    this._renderEntity(tree, this.scene.root, 0);
    this.container.appendChild(tree);
  }

  /**
   * @param {HTMLElement} parent
   * @param {import('../engine/Entity.js').Entity} entity
   * @param {number} depth
   */
  _renderEntity(parent, entity, depth) {
    const item = document.createElement('div');
    item.className = 'hierarchy-item';
    item.dataset.entityId = entity.id;
    if (this.selectedEntity && this.selectedEntity.id === entity.id) {
      item.classList.add('selected');
    }

    const indent = depth * 16;
    item.style.paddingLeft = `${8 + indent}px`;

    // Toggle arrow
    const toggle = document.createElement('span');
    toggle.className = 'hierarchy-item-toggle';
    if (entity.children.length > 0) {
      toggle.textContent = '▶';
      if (this.expandedIds.has(entity.id)) {
        toggle.classList.add('open');
      }
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.expandedIds.has(entity.id)) {
          this.expandedIds.delete(entity.id);
        } else {
          this.expandedIds.add(entity.id);
        }
        this.refresh();
      });
    } else {
      toggle.textContent = '';
    }
    item.appendChild(toggle);

    // Icon
    const icon = document.createElement('span');
    icon.className = 'hierarchy-item-icon';
    icon.textContent = this._getEntityIcon(entity);
    item.appendChild(icon);

    // Name
    const name = document.createElement('span');
    name.className = 'hierarchy-item-name';
    name.textContent = entity.name;
    if (this.hiddenIds.has(entity.id)) {
      name.style.opacity = '0.4';
    }
    item.appendChild(name);

    // Spacer to push action buttons right
    const spacer = document.createElement('span');
    spacer.style.flex = '1';
    item.appendChild(spacer);

    // Action buttons (not for root)
    if (entity !== this.scene?.root) {
      // Visibility toggle
      const visBtn = document.createElement('span');
      visBtn.className = 'hierarchy-action-btn';
      visBtn.title = this.hiddenIds.has(entity.id) ? 'Show' : 'Hide';
      visBtn.textContent = this.hiddenIds.has(entity.id) ? '👁‍🗨' : '👁';
      if (this.hiddenIds.has(entity.id)) visBtn.style.opacity = '0.4';
      visBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleVisibility(entity);
      });
      item.appendChild(visBtn);

      // Lock toggle
      const lockBtn = document.createElement('span');
      lockBtn.className = 'hierarchy-action-btn';
      lockBtn.title = this.lockedIds.has(entity.id) ? 'Unlock' : 'Lock';
      lockBtn.textContent = this.lockedIds.has(entity.id) ? '🔒' : '🔓';
      if (this.lockedIds.has(entity.id)) lockBtn.style.opacity = '1';
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleLock(entity);
      });
      item.appendChild(lockBtn);
    }

    // Click to select
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onSelectEntity) {
        this.onSelectEntity(entity);
      }
    });

    // Double click to focus
    item.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (this.onSelectEntity) {
        this.onSelectEntity(entity, true); // true = focus
      }
    });

    // Drag & Drop (not for Scene root)
    if (entity !== this.scene?.root) {
      item.draggable = true;
      item.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        this._dragEntityId = entity.id;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(entity.id));
      });
      item.addEventListener('dragend', () => {
        this._dragEntityId = null;
        item.classList.remove('dragging');
        // Remove all drop indicators
        this.container.querySelectorAll('.drop-above,.drop-below,.drop-into').forEach(el => {
          el.classList.remove('drop-above', 'drop-below', 'drop-into');
        });
      });
    }

    // Drop target (all items including root)
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this._dragEntityId === entity.id) return;
      e.dataTransfer.dropEffect = 'move';

      // Remove previous indicators
      this.container.querySelectorAll('.drop-above,.drop-below,.drop-into').forEach(el => {
        el.classList.remove('drop-above', 'drop-below', 'drop-into');
      });

      // Determine drop zone (top 25% = above, bottom 25% = below, middle = into)
      const rect = item.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const h = rect.height;

      if (entity === this.scene?.root) {
        item.classList.add('drop-into');
      } else if (y < h * 0.25) {
        item.classList.add('drop-above');
      } else if (y > h * 0.75) {
        item.classList.add('drop-below');
      } else {
        item.classList.add('drop-into');
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drop-above', 'drop-below', 'drop-into');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.classList.remove('drop-above', 'drop-below', 'drop-into');

      const dragId = parseInt(e.dataTransfer.getData('text/plain'));
      if (isNaN(dragId) || dragId === entity.id) return;

      const dragEntity = this.scene?.getEntityById(dragId);
      if (!dragEntity) return;

      const rect = item.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const h = rect.height;

      if (this.onReparent) {
        if (entity === this.scene?.root || (y >= h * 0.25 && y <= h * 0.75)) {
          // Drop into: make child
          this.onReparent(dragEntity, entity, -1);
          this.expandedIds.add(entity.id);
        } else {
          // Drop above/below: same parent, reorder
          const parent = entity.parent || this.scene.root;
          const siblings = parent.children;
          let targetIndex = siblings.indexOf(entity);
          if (y > h * 0.75) targetIndex++;
          this.onReparent(dragEntity, parent, targetIndex);
        }
      }
    });

    parent.appendChild(item);

    // Render children if expanded
    if (this.expandedIds.has(entity.id)) {
      for (const child of entity.children) {
        this._renderEntity(parent, child, depth + 1);
      }
    }
  }

  /**
   * Get icon for entity based on its components
   * @param {import('../engine/Entity.js').Entity} entity
   * @returns {string}
   */
  _getEntityIcon(entity) {
    if (entity.hasComponent('Light')) {
      const light = entity.getComponent('Light');
      if (light.lightType === 'directional') return '☀️';
      if (light.lightType === 'point') return '💡';
      if (light.lightType === 'spot') return '🔦';
      return '💡';
    }
    if (entity.hasComponent('Camera')) return '🎥';
    if (entity.hasComponent('AnimationPlayer')) return '🎞️';
    if (entity.hasComponent('ParticleEmitter')) return '✨';
    if (entity.hasComponent('Animator')) return '🎬';
    if (entity.hasComponent('GLBModel')) return '🏗️';
    if (entity.hasComponent('InstancedMeshRenderer')) return '🧱';
    if (entity.hasComponent('RigidBody') && entity.hasComponent('ProceduralMesh')) return '⚛️';
    if (entity.hasComponent('Script') && entity.hasComponent('ProceduralMesh')) return '📝';
    if (entity.hasComponent('ProceduralMesh')) return '🔷';
    if (entity.hasComponent('MeshRenderer')) return '📦';
    if (entity.hasComponent('RigidBody')) return '⚛️';
    if (entity.hasComponent('Script')) return '📝';
    if (entity.children.length > 0) return '📁';
    return '⬡';
  }

  /**
   * Toggle visibility for an entity
   * @param {import('../../engine/Entity.js').Entity} entity
   */
  _toggleVisibility(entity) {
    if (this.hiddenIds.has(entity.id)) {
      this.hiddenIds.delete(entity.id);
      entity.object3D.visible = true;
    } else {
      this.hiddenIds.add(entity.id);
      entity.object3D.visible = false;
    }
    this.refresh();
  }

  /**
   * Toggle selection lock for an entity
   * @param {import('../../engine/Entity.js').Entity} entity
   */
  _toggleLock(entity) {
    if (this.lockedIds.has(entity.id)) {
      this.lockedIds.delete(entity.id);
    } else {
      this.lockedIds.add(entity.id);
    }
    this.refresh();
  }

  /**
   * Check if an entity is locked (selection prevented)
   * @param {number} entityId
   * @returns {boolean}
   */
  isLocked(entityId) {
    return this.lockedIds.has(entityId);
  }
}
