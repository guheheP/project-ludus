import { Command } from './Command.js';

/**
 * ReparentCommand — Undoable parent-child relationship change
 */
export class ReparentCommand extends Command {
  /**
   * @param {import('../../engine/Scene.js').Scene} scene
   * @param {import('../../engine/Entity.js').Entity} entity
   * @param {import('../../engine/Entity.js').Entity} newParent
   * @param {number} newIndex - Position within new parent's children (-1 = append)
   */
  constructor(scene, entity, newParent, newIndex = -1) {
    super();
    this.scene = scene;
    this.entity = entity;
    this._name = entity.name;
    this.newParent = newParent;
    this.newIndex = newIndex;

    // Capture old state
    this.oldParent = entity.parent || scene.root;
    this.oldIndex = this.oldParent.children.indexOf(entity);
  }

  get description() {
    return `Move ${this._name} to ${this.newParent.name}`;
  }

  execute() {
    this._reparent(this.newParent, this.newIndex);
  }

  undo() {
    this._reparent(this.oldParent, this.oldIndex);
  }

  _reparent(parent, index) {
    // Remove from current parent
    if (this.entity.parent) {
      this.entity.parent.removeChild(this.entity);
    }

    // Add to new parent at specific index
    if (index >= 0 && index < parent.children.length) {
      parent.children.splice(index, 0, this.entity);
      this.entity.parent = parent;
      parent.object3D.add(this.entity.object3D);
    } else {
      parent.addChild(this.entity);
    }
  }
}
