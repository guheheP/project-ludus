import { Command } from './Command.js';

export class VertexTransformCommand extends Command {
  /**
   * @param {import('../../engine/Entity.js').Entity} entity
   * @param {number[]} uniqueIndices
   * @param {THREE.Vector3[]} oldPositions (array of world coordinates or local coordinates? We use uniquePositions array natively)
   * @param {THREE.Vector3[]} newPositions
   */
  constructor(entity, uniqueIndices, oldPositions, newPositions) {
    super();
    this.name = 'Edit Vertices';
    this.entity = entity;
    this.uniqueIndices = [...uniqueIndices];
    // Copy positions just to be safe
    this.oldPositions = oldPositions.map(p => ({ x: p.x, y: p.y, z: p.z }));
    this.newPositions = newPositions.map(p => ({ x: p.x, y: p.y, z: p.z }));
  }

  get description() {
    return `Move Vertices on ${this.entity.name}`;
  }

  _applyPositions(positions) {
    const entity = this.entity;
    if (!entity || !entity.hasComponent('EditableMesh')) return;

    const em = entity.getComponent('EditableMesh');
    for (let i = 0; i < this.uniqueIndices.length; i++) {
      const uIdx = this.uniqueIndices[i];
      const pos = positions[i];
      // The positions given are local coordinates
      em.setUniqueVertexPosition(uIdx, pos.x, pos.y, pos.z);
    }
    
    // Send a global event to refresh gizmos if the entity is selected
    if (window.editor) {
      window.editor._emitChange();
      // If vertex edit mode is ON and this entity is selected, update the dummy
      if (window.editor.sceneView.vertexEditMode && window.editor.sceneView._selectedEntity === entity) {
        window.editor.sceneView._updateVertexPoints();
        window.editor.sceneView._updateVertexDummyPos();
      }
    }
  }

  undo() {
    this._applyPositions(this.oldPositions);
  }

  execute() {
    this._applyPositions(this.newPositions);
  }
}
