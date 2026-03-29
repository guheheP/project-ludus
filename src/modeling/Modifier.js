/**
 * Modifier — Base class for procedural mesh modifiers
 * Modifiers transform geometry vertices non-destructively.
 */
export class Modifier {
  /** @type {string} */
  static typeName = 'Modifier';

  /** @type {string} */
  get name() { return this.constructor.typeName; }

  /** @type {boolean} */
  enabled = true;

  /** @type {boolean} */
  expanded = true;

  /**
   * Apply this modifier to a set of vertices
   * @param {Float32Array} positions - vertex positions (x,y,z interleaved)
   * @param {object} bounds - { min: {x,y,z}, max: {x,y,z}, center: {x,y,z}, size: {x,y,z} }
   * @returns {Float32Array} modified positions
   */
  apply(positions, bounds) {
    return positions;
  }

  /**
   * Get parameters for inspector UI
   * @returns {Array<{name: string, key: string, type: string, value: any, min?: number, max?: number, step?: number}>}
   */
  getParams() {
    return [];
  }

  /**
   * Set parameter value
   * @param {string} key
   * @param {any} value
   */
  setParam(key, value) {
    if (this.hasOwnProperty(key)) {
      this[key] = value;
    }
  }

  /**
   * Serialize to plain object
   * @returns {object}
   */
  serialize() {
    const data = { type: this.name, enabled: this.enabled };
    for (const param of this.getParams()) {
      data[param.key] = this[param.key];
    }
    return data;
  }
}
