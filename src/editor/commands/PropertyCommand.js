import { Command } from './Command.js';

/**
 * PropertyCommand — Undoable property change on a component
 */
export class PropertyCommand extends Command {
  /**
   * @param {import('../../engine/Entity.js').Entity} entity
   * @param {string} componentType - e.g. 'ProceduralMesh', 'Light'
   * @param {string} propertyPath - e.g. 'color', 'intensity', 'shapeParams.width'
   * @param {*} oldValue
   * @param {*} newValue
   */
  constructor(entity, componentType, propertyPath, oldValue, newValue) {
    super();
    this.entity = entity;
    this._name = entity.name;
    this.componentType = componentType;
    this.propertyPath = propertyPath;
    this.oldValue = oldValue;
    this.newValue = newValue;
  }

  get description() {
    return `Change ${this.propertyPath} on ${this._name}`;
  }

  execute() {
    this._setValue(this.newValue);
  }

  undo() {
    this._setValue(this.oldValue);
  }

  _setValue(value) {
    const component = this.entity.getComponent(this.componentType);
    if (!component) return;

    const parts = this.propertyPath.split('.');
    let target = component;
    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]];
      if (!target) return;
    }
    target[parts[parts.length - 1]] = value;
  }
}
