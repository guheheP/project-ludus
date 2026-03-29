import { Component } from '../Component.js';

/**
 * Default script template
 */
export const DEFAULT_SCRIPT = `// Project Ludus Script
// Available APIs:
//   this.entity    — Reference to this entity
//   this.transform — Transform shortcut (position, rotation, scale)
//   this.scene     — Scene reference
//   this.input     — Input state (keys, mouse)
//   this.time      — Time info (dt, elapsed, frame)

function start() {
  // Called once when Play starts
  console.log('Hello from ' + this.entity.name);
}

function update(dt) {
  // Called every frame
  // dt = delta time in seconds

  // Example: rotate this object
  // this.transform.rotation.y += 1.0 * dt;
}
`;

/**
 * Script Component — Holds user code for an entity
 */
export class ScriptComponent extends Component {
  static typeName = 'Script';

  /** @type {string} */
  code = DEFAULT_SCRIPT;

  /** @type {string} */
  fileName = 'script.js';

  /** @type {boolean} */
  enabled = true;

  /** @type {object|null} Runtime context — set by ScriptRuntime */
  _runtimeContext = null;

  /** @type {Function|null} Compiled start function */
  _startFn = null;

  /** @type {Function|null} Compiled update function */
  _updateFn = null;

  /** @type {boolean} */
  _started = false;

  /** @type {boolean} */
  _hasError = false;

  /** @type {string} */
  _errorMessage = '';

  serialize() {
    return {
      ...super.serialize(),
      code: this.code,
      fileName: this.fileName,
      enabled: this.enabled,
    };
  }

  deserialize(data) {
    super.deserialize(data);
    this.code = data.code || DEFAULT_SCRIPT;
    this.fileName = data.fileName || 'script.js';
    this.enabled = data.enabled !== false;
  }
}
