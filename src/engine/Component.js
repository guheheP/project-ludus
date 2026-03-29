/**
 * Component — Base class for all components
 * Components store data and are attached to Entities.
 */
export class Component {
  /** @type {string} */
  static typeName = 'Component';

  /** @type {import('./Entity.js').Entity|null} */
  entity = null;

  /** @type {boolean} */
  enabled = true;

  /**
   * Called when the component is added to an entity
   */
  onAttach() {}

  /**
   * Called when the component is removed from an entity
   */
  onDetach() {}

  /**
   * Serialize component data to plain object
   * @returns {object}
   */
  serialize() {
    return { type: this.constructor.typeName, enabled: this.enabled };
  }

  /**
   * Deserialize component data from plain object
   * @param {object} data
   */
  deserialize(data) {
    if (data.enabled !== undefined) this.enabled = data.enabled;
  }
}
