import { Command } from './Command.js';

/**
 * AddComponentCommand — Undoable component addition
 */
export class AddComponentCommand extends Command {
  /**
   * @param {import('../../engine/Entity.js').Entity} entity
   * @param {import('../../engine/Component.js').Component} component
   */
  constructor(entity, component) {
    super();
    this.entity = entity;
    this._name = entity.name;
    this.component = component;
    this._typeName = component.constructor.typeName || component.constructor.name;
  }

  get description() {
    return `Add ${this._typeName} to ${this._name}`;
  }

  execute() {
    if (!this.entity.hasComponent(this._typeName)) {
      this.entity.addComponent(this.component);
    }
  }

  undo() {
    if (this.entity.hasComponent(this._typeName)) {
      this.entity.removeComponent(this._typeName);
    }
  }
}

/**
 * RemoveComponentCommand — Undoable component removal
 */
export class RemoveComponentCommand extends Command {
  /**
   * @param {import('../../engine/Entity.js').Entity} entity
   * @param {string} componentType
   */
  constructor(entity, componentType) {
    super();
    this.entity = entity;
    this._name = entity.name;
    this.componentType = componentType;
    // Capture the component reference before removal
    this.component = entity.getComponent(componentType);
    // Store serialized data for safe restore
    this._serialized = this.component ? this.component.serialize() : null;
  }

  get description() {
    return `Remove ${this.componentType} from ${this._name}`;
  }

  execute() {
    if (this.entity.hasComponent(this.componentType)) {
      this.entity.removeComponent(this.componentType);
    }
  }

  undo() {
    if (!this.entity.hasComponent(this.componentType) && this.component) {
      this.entity.addComponent(this.component);
    }
  }
}
