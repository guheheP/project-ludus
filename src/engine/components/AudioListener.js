import { Component } from '../Component.js';

/**
 * AudioListener - Typically attached to the Camera entity to receive spatial audio
 */
export class AudioListener extends Component {
  static typeName = 'AudioListener';

  constructor() {
    super();
  }

  clone() {
    return new AudioListener();
  }

  serialize() {
    return {};
  }

  deserialize(data) {
  }
}
