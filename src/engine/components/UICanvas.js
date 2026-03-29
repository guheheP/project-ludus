import { Component } from '../Component.js';

/**
 * UICanvas — Enables a UI overlay for this entity's scripts.
 * Attach to any entity that needs to display game UI (HUD, menus, etc.)
 */
export class UICanvas extends Component {
  static typeName = 'UICanvas';

  constructor() {
    super();

    /** @type {boolean} Whether UI renders on top of everything */
    this.overlay = true;
  }

  clone() {
    const c = new UICanvas();
    c.overlay = this.overlay;
    return c;
  }

  serialize() {
    return { ...super.serialize(), overlay: this.overlay };
  }

  deserialize(data) {
    if (data.overlay !== undefined) this.overlay = data.overlay;
  }
}
