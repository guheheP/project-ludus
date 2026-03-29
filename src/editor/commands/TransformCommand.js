import { Command } from './Command.js';

/**
 * TransformCommand — Undoable transform change (position/rotation/scale)
 */
export class TransformCommand extends Command {
  /**
   * @param {import('../../engine/Entity.js').Entity} entity
   * @param {{ position: {x,y,z}, rotation: {x,y,z}, scale: {x,y,z} }} oldState
   * @param {{ position: {x,y,z}, rotation: {x,y,z}, scale: {x,y,z} }} newState
   */
  constructor(entity, oldState, newState) {
    super();
    this.entity = entity;
    this._name = entity.name;
    this.oldState = oldState;
    this.newState = newState;
  }

  get description() {
    return `Transform ${this._name}`;
  }

  execute() {
    this._applyState(this.newState);
  }

  undo() {
    this._applyState(this.oldState);
  }

  _applyState(state) {
    const transform = this.entity.getComponent('Transform');
    if (!transform) return;
    transform.position.set(state.position.x, state.position.y, state.position.z);
    this.entity.object3D.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
    transform.scale.set(state.scale.x, state.scale.y, state.scale.z);
  }

  /**
   * Capture current transform state
   * @param {import('../../engine/Entity.js').Entity} entity
   * @returns {{ position: {x,y,z}, rotation: {x,y,z}, scale: {x,y,z} }}
   */
  static captureState(entity) {
    const t = entity.getComponent('Transform');
    if (!t) return null;
    return {
      position: { x: t.position.x, y: t.position.y, z: t.position.z },
      rotation: { x: t.rotation.x, y: t.rotation.y, z: t.rotation.z },
      scale: { x: t.scale.x, y: t.scale.y, z: t.scale.z },
    };
  }
}
