import * as THREE from 'three';
import { Entity } from './Entity.js';

/**
 * Scene — Container for all entities in the game world
 */
export class Scene {
  /** @type {string} */
  name;

  /** @type {Entity} */
  root;

  /** @type {THREE.Scene} */
  threeScene;

  /** @type {Map<number, Entity>} */
  entityMap = new Map();

  constructor(name = 'Scene') {
    this.name = name;
    this.threeScene = new THREE.Scene();
    this.threeScene.background = new THREE.Color(0x0f0f23);

    // Root entity
    this.root = new Entity('Scene');
    this.threeScene.add(this.root.object3D);
    this.entityMap.set(this.root.id, this.root);
  }

  /**
   * Create a new entity and add it to the scene
   * @param {string} name
   * @param {Entity|null} parent
   * @returns {Entity}
   */
  createEntity(name = 'Entity', parent = null) {
    const entity = new Entity(name);
    this.entityMap.set(entity.id, entity);
    const parentEntity = parent || this.root;
    parentEntity.addChild(entity);
    return entity;
  }

  /**
   * Find entity by ID
   * @param {number} id
   * @returns {Entity|undefined}
   */
  getEntityById(id) {
    return this.entityMap.get(id);
  }

  /**
   * Find entity by name
   * @param {string} name
   * @returns {Entity|undefined}
   */
  findEntityByName(name) {
    for (const [, entity] of this.entityMap) {
      if (entity.name === name) return entity;
    }
    return undefined;
  }

  /**
   * Remove an entity from the scene
   * @param {Entity} entity
   */
  removeEntity(entity) {
    // Recursively remove children from map
    const removeFromMap = (e) => {
      for (const child of e.children) {
        removeFromMap(child);
      }
      this.entityMap.delete(e.id);
    };
    removeFromMap(entity);
    entity.destroy();
  }

  /**
   * Get all entities (flat list)
   * @returns {Entity[]}
   */
  getAllEntities() {
    return Array.from(this.entityMap.values());
  }

  /**
   * Serialize scene to JSON
   * @returns {object}
   */
  serialize() {
    return {
      name: this.name,
      root: this.root.serialize()
    };
  }
}
