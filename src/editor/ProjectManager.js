/**
 * ProjectManager — Manages file-based project structure via File System Access API
 *
 * Project folder structure:
 *   project/
 *   ├── project.ludus.json      ← Project metadata
 *   ├── scenes/
 *   │   └── main.ludus.json     ← Scene definition
 *   ├── scripts/
 *   │   ├── player.js           ← Individual script files
 *   │   └── enemy.js
 *   └── assets/
 *       ├── textures/
 *       ├── models/
 *       └── audio/
 */
export class ProjectManager {
  /** @type {FileSystemDirectoryHandle|null} */
  rootHandle = null;

  /** @type {FileSystemDirectoryHandle|null} */
  scenesHandle = null;

  /** @type {FileSystemDirectoryHandle|null} */
  scriptsHandle = null;

  /** @type {FileSystemDirectoryHandle|null} */
  assetsHandle = null;

  /** @type {boolean} */
  isOpen = false;

  /** @type {string} */
  projectName = '';

  /** @type {number|null} Auto-save debounce timer */
  _saveTimer = null;

  /** @type {number} Auto-save debounce delay in ms */
  _saveDelay = 2000;

  /** @type {boolean} */
  _dirty = false;

  /** @type {Function|null} Callback when project state changes */
  onStateChange = null;

  /** @type {Function|null} Callback for log messages */
  onLog = null;

  /** @type {Map<string, number>} filePath -> last modified timestamp for change detection */
  _fileTimestamps = new Map();

  /** @type {Function|null} External change callback */
  onExternalChange = null;

  /** @type {number|null} Polling interval ID */
  _watchInterval = null;

  /** @type {number} Polling interval in ms */
  _watchDelay = 1500;

  // =============================================
  // Project Open / Create
  // =============================================

  /**
   * Open an existing project folder or create a new one
   * @returns {Promise<boolean>}
   */
  async openProject() {
    try {
      this.rootHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });

      this.projectName = this.rootHandle.name;

      // Ensure directory structure
      this.scenesHandle = await this._ensureDir(this.rootHandle, 'scenes');
      this.scriptsHandle = await this._ensureDir(this.rootHandle, 'scripts');
      this.assetsHandle = await this._ensureDir(this.rootHandle, 'assets');

      // Create project metadata if not existing
      await this._ensureProjectMeta();

      this.isOpen = true;
      this._dirty = false;
      this._log('info', `Project opened: ${this.projectName}`);
      this._emitStateChange();

      return true;
    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled the picker
        return false;
      }
      this._log('error', `Failed to open project: ${err.message}`);
      return false;
    }
  }

  /**
   * Close the current project
   */
  closeProject() {
    this.stopWatching();
    this.rootHandle = null;
    this.scenesHandle = null;
    this.scriptsHandle = null;
    this.assetsHandle = null;
    this.isOpen = false;
    this.projectName = '';
    this._dirty = false;
    this._clearSaveTimer();
    this._fileTimestamps.clear();
    this._emitStateChange();
    this._log('info', 'Project closed');
  }

  // =============================================
  // Scene Read / Write
  // =============================================

  /**
   * Save scene data to scenes/main.ludus.json
   * @param {object} sceneData - Serialized scene data
   */
  async saveScene(sceneData) {
    if (!this.isOpen || !this.scenesHandle) return;

    try {
      const fileName = 'main.ludus.json';
      const json = JSON.stringify(sceneData, null, 2);
      await this._writeFile(this.scenesHandle, fileName, json);
      this._dirty = false;
      this._emitStateChange();
      this._log('info', `Scene saved: ${fileName}`);
    } catch (err) {
      this._log('error', `Failed to save scene: ${err.message}`);
    }
  }

  /**
   * Load scene data from scenes/main.ludus.json
   * @returns {Promise<object|null>}
   */
  async loadScene() {
    if (!this.isOpen || !this.scenesHandle) return null;

    try {
      const json = await this._readFile(this.scenesHandle, 'main.ludus.json');
      if (json === null) return null;
      return JSON.parse(json);
    } catch (err) {
      this._log('error', `Failed to load scene: ${err.message}`);
      return null;
    }
  }

  // =============================================
  // Script File Read / Write
  // =============================================

  /**
   * Save a script to scripts/<fileName>
   * @param {string} fileName - e.g. "player.js"
   * @param {string} code - Script source code
   */
  async saveScript(fileName, code) {
    if (!this.isOpen || !this.scriptsHandle) return;

    try {
      await this._writeFile(this.scriptsHandle, fileName, code);
      this._log('info', `Script saved: ${fileName}`);
    } catch (err) {
      this._log('error', `Failed to save script ${fileName}: ${err.message}`);
    }
  }

  /**
   * Load a script from scripts/<fileName>
   * @param {string} fileName
   * @returns {Promise<string|null>}
   */
  async loadScript(fileName) {
    if (!this.isOpen || !this.scriptsHandle) return null;

    try {
      return await this._readFile(this.scriptsHandle, fileName);
    } catch (err) {
      this._log('error', `Failed to load script ${fileName}: ${err.message}`);
      return null;
    }
  }

  /**
   * List all script files in the scripts/ directory
   * @returns {Promise<string[]>}
   */
  async listScripts() {
    if (!this.isOpen || !this.scriptsHandle) return [];

    const files = [];
    try {
      for await (const entry of this.scriptsHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.js')) {
          files.push(entry.name);
        }
      }
    } catch (err) {
      this._log('error', `Failed to list scripts: ${err.message}`);
    }
    return files;
  }

  /**
   * Delete a script file
   * @param {string} fileName
   */
  async deleteScript(fileName) {
    if (!this.isOpen || !this.scriptsHandle) return;

    try {
      await this.scriptsHandle.removeEntry(fileName);
      this._log('info', `Script deleted: ${fileName}`);
    } catch (err) {
      this._log('error', `Failed to delete script ${fileName}: ${err.message}`);
    }
  }

  // =============================================
  // Auto-save (Debounced)
  // =============================================

  /**
   * Mark the project as having unsaved changes.
   * Triggers auto-save after the debounce delay.
   * @param {Function} saveCallback - called when it's time to save
   */
  markDirty(saveCallback) {
    if (!this.isOpen) return;

    this._dirty = true;
    this._emitStateChange();

    this._clearSaveTimer();
    this._saveTimer = setTimeout(async () => {
      if (this._dirty && this.isOpen) {
        try {
          await saveCallback();
        } catch (err) {
          this._log('error', `Auto-save failed: ${err.message}`);
        }
      }
    }, this._saveDelay);
  }

  /** @returns {boolean} */
  get isDirty() {
    return this._dirty;
  }

  _clearSaveTimer() {
    if (this._saveTimer !== null) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
  }

  // =============================================
  // File Watching (Polling)
  // =============================================

  /**
   * Start watching scripts/ and scenes/ for external changes
   */
  startWatching() {
    if (!this.isOpen) return;
    this.stopWatching();

    // Build initial snapshot
    this._buildTimestampSnapshot().then(() => {
      this._watchInterval = setInterval(() => this._pollChanges(), this._watchDelay);
      this._log('info', 'File watching started');
    });
  }

  /**
   * Stop watching for changes
   */
  stopWatching() {
    if (this._watchInterval !== null) {
      clearInterval(this._watchInterval);
      this._watchInterval = null;
    }
  }

  /**
   * Build a snapshot of file timestamps
   */
  async _buildTimestampSnapshot() {
    this._fileTimestamps.clear();

    // Snapshot scripts/
    if (this.scriptsHandle) {
      await this._snapshotDir(this.scriptsHandle, 'scripts/');
    }
    // Snapshot scenes/
    if (this.scenesHandle) {
      await this._snapshotDir(this.scenesHandle, 'scenes/');
    }
  }

  async _snapshotDir(dirHandle, prefix) {
    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          this._fileTimestamps.set(prefix + entry.name, file.lastModified);
        }
      }
    } catch (err) {
      // Directory might not exist yet
    }
  }

  /**
   * Poll for changes and emit events
   */
  async _pollChanges() {
    if (!this.isOpen) return;

    const changes = [];

    // Check scripts/
    if (this.scriptsHandle) {
      const scriptChanges = await this._checkDirChanges(this.scriptsHandle, 'scripts/');
      changes.push(...scriptChanges);
    }

    // Check scenes/
    if (this.scenesHandle) {
      const sceneChanges = await this._checkDirChanges(this.scenesHandle, 'scenes/');
      changes.push(...sceneChanges);
    }

    if (changes.length > 0 && this.onExternalChange) {
      this.onExternalChange(changes);
    }
  }

  /**
   * @param {FileSystemDirectoryHandle} dirHandle
   * @param {string} prefix
   * @returns {Promise<Array<{type: string, path: string, name: string}>>}
   */
  async _checkDirChanges(dirHandle, prefix) {
    const changes = [];
    const currentFiles = new Set();

    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const path = prefix + entry.name;
          currentFiles.add(path);

          const file = await entry.getFile();
          const oldTs = this._fileTimestamps.get(path);

          if (oldTs === undefined) {
            // New file
            changes.push({ type: 'added', path, name: entry.name });
            this._fileTimestamps.set(path, file.lastModified);
          } else if (file.lastModified !== oldTs) {
            // Modified file
            changes.push({ type: 'modified', path, name: entry.name });
            this._fileTimestamps.set(path, file.lastModified);
          }
        }
      }

      // Check for deleted files
      for (const [path] of this._fileTimestamps) {
        if (path.startsWith(prefix) && !currentFiles.has(path)) {
          const name = path.substring(prefix.length);
          changes.push({ type: 'deleted', path, name });
          this._fileTimestamps.delete(path);
        }
      }
    } catch (err) {
      // ignore
    }

    return changes;
  }

  // =============================================
  // Internal Helpers
  // =============================================

  /**
   * Ensure a subdirectory exists
   * @param {FileSystemDirectoryHandle} parent
   * @param {string} name
   * @returns {Promise<FileSystemDirectoryHandle>}
   */
  async _ensureDir(parent, name) {
    return await parent.getDirectoryHandle(name, { create: true });
  }

  /**
   * Write a text file
   * @param {FileSystemDirectoryHandle} dirHandle
   * @param {string} fileName
   * @param {string} content
   */
  async _writeFile(dirHandle, fileName, content) {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    // Update timestamp snapshot
    const file = await fileHandle.getFile();
    // Find the prefix by checking which handle this belongs to
    let prefix = '';
    if (dirHandle === this.scriptsHandle) prefix = 'scripts/';
    else if (dirHandle === this.scenesHandle) prefix = 'scenes/';
    this._fileTimestamps.set(prefix + fileName, file.lastModified);
  }

  /**
   * Read a text file
   * @param {FileSystemDirectoryHandle} dirHandle
   * @param {string} fileName
   * @returns {Promise<string|null>}
   */
  async _readFile(dirHandle, fileName) {
    try {
      const fileHandle = await dirHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (err) {
      if (err.name === 'NotFoundError') return null;
      throw err;
    }
  }

  /**
   * Ensure project.ludus.json exists
   */
  async _ensureProjectMeta() {
    const existing = await this._readFile(this.rootHandle, 'project.ludus.json');
    if (existing) return;

    const meta = {
      name: this.projectName,
      version: '1.0.0',
      engine: 'project-ludus',
      createdAt: new Date().toISOString(),
    };
    await this._writeFile(this.rootHandle, 'project.ludus.json', JSON.stringify(meta, null, 2));
  }

  _log(level, message) {
    if (this.onLog) this.onLog(level, message);
  }

  _emitStateChange() {
    if (this.onStateChange) this.onStateChange(this.isOpen, this._dirty);
  }
}
