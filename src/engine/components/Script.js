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
 *
 * When filePath is set, the script code is stored as an external file
 * in the project's scripts/ directory, enabling AI IDE collaboration.
 * When filePath is null, code is embedded directly (standalone mode).
 */
export class ScriptComponent extends Component {
  static typeName = 'Script';

  /** @type {string} Script source code */
  code = DEFAULT_SCRIPT;

  /**
   * External file reference (relative to scripts/ folder).
   * When set, the script is saved as a separate .js file.
   * @type {string|null}
   */
  filePath = null;

  /** @type {string} Display name for the script */
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
    const data = {
      ...super.serialize(),
      fileName: this.fileName,
      enabled: this.enabled,
    };

    if (this.filePath) {
      // External file mode: store only the filePath reference
      data.filePath = this.filePath;
    } else {
      // Embedded mode: store the code directly
      data.code = this.code;
    }

    return data;
  }

  deserialize(data) {
    super.deserialize(data);
    this.fileName = data.fileName || 'script.js';
    this.enabled = data.enabled !== false;

    if (data.filePath) {
      // External file mode — code will be loaded by ProjectManager
      this.filePath = data.filePath;
      this.code = data.code || DEFAULT_SCRIPT; // fallback until loaded
    } else {
      // Embedded mode
      this.filePath = null;
      this.code = data.code || DEFAULT_SCRIPT;
    }
  }
}

