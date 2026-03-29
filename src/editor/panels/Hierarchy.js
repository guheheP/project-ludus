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
    item.appendChild(name);

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
    if (entity.hasComponent('RigidBody') && entity.hasComponent('ProceduralMesh')) return '⚛️';
    if (entity.hasComponent('Script') && entity.hasComponent('ProceduralMesh')) return '📝';
    if (entity.hasComponent('ProceduralMesh')) return '🔷';
    if (entity.hasComponent('MeshRenderer')) return '📦';
    if (entity.hasComponent('RigidBody')) return '⚛️';
    if (entity.hasComponent('Script')) return '📝';
    if (entity.children.length > 0) return '📁';
    return '⬡';
  }
}
