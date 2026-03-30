import { Command } from './Command.js';
import { SceneSerializer } from '../SceneSerializer.js';

/**
 * AddEntityCommand — Undoable entity creation
 */
export class AddEntityCommand extends Command {
  /**
   * @param {import('../../engine/Scene.js').Scene} scene
   * @param {import('../../engine/Entity.js').Entity} entity
   * @param {import('../../engine/Entity.js').Entity} parent
   */
  constructor(scene, entity, parent) {
    super();
    this.scene = scene;
    this.entity = entity;
    this.parent = parent;
    this._name = entity.name;
  }

  get description() {
    return `Add ${this._name}`;
  }

  execute() {
    // Re-add if previously removed (redo case)
    if (!this.scene.entityMap.has(this.entity.id)) {
      this.scene.entityMap.set(this.entity.id, this.entity);
      if (this.parent) {
        this.parent.addChild(this.entity);
      } else {
        this.scene.root.addChild(this.entity);
      }
      this.scene.threeScene.add(this.entity.object3D);
    }
  }

  undo() {
    this.scene.removeEntity(this.entity);
  }
}

/**
 * DeleteEntityCommand — Undoable entity deletion
 * Captures full serialized state for restore.
 */
export class DeleteEntityCommand extends Command {
  /**
   * @param {import('../../engine/Scene.js').Scene} scene
   * @param {import('../../engine/Entity.js').Entity} entity
   */
  constructor(scene, entity) {
    super();
    this.scene = scene;
    this.entity = entity;
    this._name = entity.name;
    this.parent = entity.parent || scene.root;
    this._childIndex = this.parent.children.indexOf(entity);

    // Serialize the entity state for full restore
    this._serializedData = SceneSerializer.serializeEntity(entity);
  }

  get description() {
    return `Delete ${this._name}`;
  }

  execute() {
    // Guard: only remove if entity is still in the scene
    if (this.scene.entityMap.has(this.entity.id)) {
      this.scene.removeEntity(this.entity);
    }
  }

  undo() {
    // Guard: only restore if entity is NOT already in the scene
    if (!this.scene.entityMap.has(this.entity.id)) {
      const restored = SceneSerializer.deserializeEntity(this._serializedData, this.scene, this.parent);
      // Update our reference so future execute()/undo() cycles work correctly
      this.entity = restored;
    }
  }
}
