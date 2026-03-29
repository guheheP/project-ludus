import * as THREE from 'three';

/**
 * Entity — The core game object in the ECS
 * Entities are containers for components and can have parent-child relationships.
 */
let entityIdCounter = 0;

export class Entity {
  /** @type {number} */
  id;

  /** @type {string} */
  name;

  /** @type {string} */
  tag = '';

  /** @type {boolean} */
  active = true;

  /** @type {Map<string, import('./Component.js').Component>} */
  components = new Map();

  /** @type {Entity|null} */
  parent = null;

  /** @type {Entity[]} */
  children = [];

  /** @type {THREE.Object3D} */
  object3D;

  /**
   * @param {string} name
   */
  constructor(name = 'Entity') {
    this.id = entityIdCounter++;
    this.name = name;
    this.object3D = new THREE.Object3D();
    this.object3D.userData.entityId = this.id;
  }

  /**
   * Add a component to this entity
   * @param {import('./Component.js').Component} component
   * @returns {import('./Component.js').Component}
   */
  addComponent(component) {
    const typeName = component.constructor.typeName;
    if (this.components.has(typeName)) {
      console.warn(`Entity "${this.name}" already has component "${typeName}"`);
      return this.components.get(typeName);
    }
    component.entity = this;
    this.components.set(typeName, component);
    component.onAttach();
    return component;
  }

  /**
   * Get a component by type name
   * @param {string} typeName
   * @returns {import('./Component.js').Component|undefined}
   */
  getComponent(typeName) {
    return this.components.get(typeName);
  }

  /**
   * Check if entity has a component
   * @param {string} typeName
   * @returns {boolean}
   */
  hasComponent(typeName) {
    return this.components.has(typeName);
  }

  /**
   * Remove a component by type name
   * @param {string} typeName
   */
  removeComponent(typeName) {
    const comp = this.components.get(typeName);
    if (comp) {
      comp.onDetach();
      comp.entity = null;
      this.components.delete(typeName);
    }
  }

  /**
   * Add a child entity
   * @param {Entity} child
   */
  addChild(child) {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.push(child);
    this.object3D.add(child.object3D);
  }

  /**
   * Remove a child entity
   * @param {Entity} child
   */
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parent = null;
      this.object3D.remove(child.object3D);
    }
  }

  /**
   * Destroy this entity and all children
   */
  destroy() {
    // Destroy children first
    for (const child of [...this.children]) {
      child.destroy();
    }
    // Detach all components
    for (const [, comp] of this.components) {
      comp.onDetach();
      comp.entity = null;
    }
    this.components.clear();
    // Remove from parent
    if (this.parent) {
      this.parent.removeChild(this);
    }
  }

  /**
   * Serialize entity to plain object
   * @returns {object}
   */
  serialize() {
    const data = {
      id: this.id,
      name: this.name,
      tag: this.tag,
      active: this.active,
      components: {},
      children: this.children.map(c => c.serialize())
    };
    for (const [typeName, comp] of this.components) {
      data.components[typeName] = comp.serialize();
    }
    return data;
  }
}
