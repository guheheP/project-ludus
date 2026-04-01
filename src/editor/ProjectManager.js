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

  /** @type {number|null} Polling interval ID (legacy) */
  _watchInterval = null;

  /** @type {number|null} Polling timeout ID */
  _watchTimeout = null;

  /** @type {boolean} Whether watching is active */
  _watching = false;

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
      // File System Access API is only available in Chromium-based browsers (Chrome, Edge)
      if (!window.showDirectoryPicker) {
        this._log('error', 'File System Access API is not supported in this browser. Please use Chrome or Edge.');
        return false;
      }

      this.rootHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });

      this.projectName = this.rootHandle.name;

      // Ensure directory structure
      this.scenesHandle = await this._ensureDir(this.rootHandle, 'scenes');
      this.scriptsHandle = await this._ensureDir(this.rootHandle, 'scripts');
      this.assetsHandle = await this._ensureDir(this.rootHandle, 'assets');
      this.prefabsHandle = await this._ensureDir(this.rootHandle, 'prefabs');

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
    this.prefabsHandle = null;
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
   * @param {string} [sceneName='main'] - Scene name (without extension)
   */
  async saveScene(sceneData, sceneName = 'main') {
    if (!this.isOpen || !this.scenesHandle) return;

    try {
      const fileName = `${sceneName}.ludus.json`;
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
   * Load scene data from scenes/<sceneName>.ludus.json
   * @param {string} [sceneName='main']
   * @returns {Promise<object|null>}
   */
  async loadScene(sceneName = 'main') {
    if (!this.isOpen || !this.scenesHandle) return null;

    try {
      const json = await this._readFile(this.scenesHandle, `${sceneName}.ludus.json`);
      if (json === null) return null;
      return JSON.parse(json);
    } catch (err) {
      this._log('error', `Failed to load scene: ${err.message}`);
      return null;
    }
  }

  /**
   * List all scene files
   * @returns {Promise<string[]>} scene names (without extension)
   */
  async listScenes() {
    if (!this.isOpen || !this.scenesHandle) return [];
    const scenes = [];
    try {
      for await (const entry of this.scenesHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.ludus.json')) {
          scenes.push(entry.name.replace('.ludus.json', ''));
        }
      }
    } catch (err) {
      this._log('error', `Failed to list scenes: ${err.message}`);
    }
    return scenes;
  }

  /**
   * Delete a scene file
   * @param {string} sceneName
   */
  async deleteScene(sceneName) {
    if (!this.isOpen || !this.scenesHandle) return;
    try {
      await this.scenesHandle.removeEntry(`${sceneName}.ludus.json`);
      this._log('info', `Scene deleted: ${sceneName}`);
    } catch (err) {
      this._log('error', `Failed to delete scene: ${err.message}`);
    }
  }

  // =============================================
  // Prefabs
  // =============================================

  /**
   * Save a prefab (serialized entity template)
   * @param {string} prefabName
   * @param {object} prefabData
   */
  async savePrefab(prefabName, prefabData) {
    if (!this.isOpen || !this.prefabsHandle) return;
    try {
      const json = JSON.stringify(prefabData, null, 2);
      await this._writeFile(this.prefabsHandle, `${prefabName}.prefab.json`, json);
      this._log('info', `Prefab saved: ${prefabName}`);
    } catch (err) {
      this._log('error', `Failed to save prefab: ${err.message}`);
    }
  }

  /**
   * Load a prefab
   * @param {string} prefabName
   * @returns {Promise<object|null>}
   */
  async loadPrefab(prefabName) {
    if (!this.isOpen || !this.prefabsHandle) return null;
    try {
      const json = await this._readFile(this.prefabsHandle, `${prefabName}.prefab.json`);
      if (json === null) return null;
      return JSON.parse(json);
    } catch (err) {
      this._log('error', `Failed to load prefab: ${err.message}`);
      return null;
    }
  }

  /**
   * List all prefabs
   * @returns {Promise<string[]>}
   */
  async listPrefabs() {
    if (!this.isOpen || !this.prefabsHandle) return [];
    const prefabs = [];
    try {
      for await (const entry of this.prefabsHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.prefab.json')) {
          prefabs.push(entry.name.replace('.prefab.json', ''));
        }
      }
    } catch (err) {
      this._log('error', `Failed to list prefabs: ${err.message}`);
    }
    return prefabs;
  }

  /**
   * Delete a prefab
   * @param {string} prefabName
   */
  async deletePrefab(prefabName) {
    if (!this.isOpen || !this.prefabsHandle) return;
    try {
      await this.prefabsHandle.removeEntry(`${prefabName}.prefab.json`);
      this._log('info', `Prefab deleted: ${prefabName}`);
    } catch (err) {
      this._log('error', `Failed to delete prefab: ${err.message}`);
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

    // Build initial snapshot, then begin async polling loop
    this._buildTimestampSnapshot().then(() => {
      this._watching = true;
      this._schedulePoll();
      this._log('info', 'File watching started');
    });
  }

  /**
   * Schedule the next poll after the delay. Uses setTimeout so the next
   * poll only fires after the previous _pollChanges() completes.
   */
  _schedulePoll() {
    if (!this._watching) return;
    this._watchTimeout = setTimeout(async () => {
      await this._pollChanges();
      this._schedulePoll(); // schedule next only after completion
    }, this._watchDelay);
  }

  /**
   * Stop watching for changes
   */
  stopWatching() {
    this._watching = false;
    if (this._watchTimeout !== null) {
      clearTimeout(this._watchTimeout);
      this._watchTimeout = null;
    }
    // Legacy cleanup
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
    if (!existing) {
      const meta = {
        name: this.projectName,
        version: '1.0.0',
        engine: 'project-ludus',
        createdAt: new Date().toISOString(),
      };
      await this._writeFile(this.rootHandle, 'project.ludus.json', JSON.stringify(meta, null, 2));
    }

    // Generate AI-readable documentation
    await this._ensureDocumentation();
  }

  /**
   * Generate .ludus/ directory with AI-readable documentation and schema
   */
  async _ensureDocumentation() {
    const ludusDir = await this._ensureDir(this.rootHandle, '.ludus');

    // Always regenerate docs so they stay up-to-date with the engine
    const apiRef = await ProjectManager._loadAPIReference();
    await this._writeFile(ludusDir, 'api-reference.md', apiRef);
    await this._writeFile(ludusDir, 'scene-schema.json', ProjectManager._SCENE_SCHEMA);
    await this._writeFile(ludusDir, 'README.md', ProjectManager._PROJECT_README(this.projectName));

    this._log('info', 'Generated .ludus/ documentation for AI assistants');
  }

  // =============================================
  // Static Documentation Templates
  // =============================================

  static _PROJECT_README(name) {
    return `# ${name}

> Created with **Project Ludus** — A browser-based 3D game editor

## Project Structure

\`\`\`
${name}/
├── project.ludus.json         ← Project metadata
├── scenes/
│   └── main.ludus.json        ← Scene definition (entities + components)
├── scripts/
│   ├── player.js              ← Individual script source files
│   └── game_manager.js
├── prefabs/
│   └── enemy.prefab.json      ← Reusable entity templates
├── assets/
│   ├── textures/
│   ├── models/                ← GLB/GLTF 3D models
│   └── audio/                 ← MP3/WAV audio files
└── .ludus/
    ├── README.md              ← This file
    ├── api-reference.md       ← Full scripting API reference
    └── scene-schema.json      ← Scene JSON schema
\`\`\`

## For AI Assistants

- **Read \`.ludus/api-reference.md\`** for the complete scripting API, component list, and code examples.
- **Read \`.ludus/scene-schema.json\`** for the scene file format (JSON Schema).
- Scripts are in \`scripts/\` and are written in vanilla JavaScript.
- Scene files are in \`scenes/\` and follow the schema in \`.ludus/scene-schema.json\`.

## Engine Features

- **ECS Architecture**: Entity-Component-System with Transform, Mesh, Physics, Audio, UI, Camera, Particles, Animations
- **Procedural Modeling**: Box, Sphere, Cylinder, Cone, Torus, Plane, Capsule with Twist/Bend/Taper/Noise/Subdivide modifiers
- **Vertex Editing**: Convert ProceduralMesh to EditableMesh for direct vertex manipulation with symmetry support
- **Physics**: Rapier3D (dynamic, static, kinematic bodies; box/sphere/capsule/cylinder/mesh/convex colliders)
- **Scripting**: Per-entity JavaScript scripts with \`start()\`, \`update(dt)\`, \`onCollision(other)\` lifecycle
- **Post-Processing**: Bloom, SSAO, Vignette, Color Grading
- **Environment**: Sky presets (day/sunset/night/overcast), gradient backgrounds, fog (linear/exponential)
- **Audio**: Spatial and 2D audio with AudioSource/AudioListener components
- **UI System**: HUD text, buttons, progress bars, images via UICanvas
- **Animation**: Keyframe Animator + AnimationPlayer for property-based animations
- **Export**: One-click export to standalone HTML+JS zip
`;
  }

  static _API_REFERENCE = ''; // Will be loaded asynchronously

  /**
   * Load the API reference markdown from the bundled .ludus directory
   */
  static async _loadAPIReference() {
    if (ProjectManager._API_REFERENCE) return ProjectManager._API_REFERENCE;
    try {
      const resp = await fetch(new URL('../../.ludus/api-reference.md', import.meta.url));
      if (resp.ok) {
        ProjectManager._API_REFERENCE = await resp.text();
        return ProjectManager._API_REFERENCE;
      }
    } catch (_) {
      // Fetch failed, use fallback
    }
    // Minimal fallback
    ProjectManager._API_REFERENCE = [
      '# Project Ludus — Scripting API Reference',
      '',
      '> See the full documentation at .ludus/api-reference.md in your project.',
      '',
      'This file could not be auto-generated. Please copy the API reference',
      'from the engine source directory.',
    ].join('\n');
    return ProjectManager._API_REFERENCE;
  }

  static _SCENE_SCHEMA = JSON.stringify({
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "Project Ludus Scene",
    "description": "Schema for Project Ludus scene files (.ludus.json)",
    "type": "object",
    "required": ["version", "name", "entities"],
    "properties": {
      "version": { "type": "string", "const": "1.0.0" },
      "name": { "type": "string", "description": "Scene display name" },
      "createdAt": { "type": "string", "format": "date-time" },
      "entities": { "type": "array", "items": { "$ref": "#/definitions/Entity" } },
      "postProcess": { "$ref": "#/definitions/PostProcess" },
      "environment": { "$ref": "#/definitions/Environment" }
    },
    "definitions": {
      "Vec3": {
        "type": "object",
        "required": ["x", "y", "z"],
        "properties": {
          "x": { "type": "number" },
          "y": { "type": "number" },
          "z": { "type": "number" }
        }
      },
      "Entity": {
        "type": "object",
        "required": ["id", "name", "components"],
        "properties": {
          "id": { "type": "integer", "description": "Unique entity ID" },
          "name": { "type": "string" },
          "tag": { "type": "string" },
          "active": { "type": "boolean" },
          "parentId": { "type": ["integer", "null"], "description": "Parent entity ID (null = root child)" },
          "components": { "$ref": "#/definitions/Components" }
        }
      },
      "Components": {
        "type": "object",
        "properties": {
          "Transform": { "$ref": "#/definitions/TransformComponent" },
          "ProceduralMesh": { "$ref": "#/definitions/ProceduralMeshComponent" },
          "EditableMesh": { "$ref": "#/definitions/EditableMeshComponent" },
          "MeshRenderer": { "$ref": "#/definitions/MeshRendererComponent" },
          "Light": { "$ref": "#/definitions/LightComponent" },
          "Script": { "$ref": "#/definitions/ScriptComponent" },
          "RigidBody": { "$ref": "#/definitions/RigidBodyComponent" },
          "Collider": { "$ref": "#/definitions/ColliderComponent" },
          "Camera": { "$ref": "#/definitions/CameraComponent" },
          "AudioListener": { "type": "object" },
          "AudioSource": { "$ref": "#/definitions/AudioSourceComponent" },
          "UICanvas": { "$ref": "#/definitions/UICanvasComponent" },
          "GLBModel": { "$ref": "#/definitions/GLBModelComponent" },
          "ParticleEmitter": { "$ref": "#/definitions/ParticleEmitterComponent" },
          "Animator": { "type": "object", "description": "Keyframe animation controller" },
          "AnimationPlayer": { "$ref": "#/definitions/AnimationPlayerComponent" },
          "InstancedMeshRenderer": { "type": "object", "description": "GPU-instanced mesh rendering" }
        }
      },
      "TransformComponent": {
        "type": "object",
        "properties": {
          "position": { "$ref": "#/definitions/Vec3" },
          "rotation": { "$ref": "#/definitions/Vec3", "description": "Euler rotation in radians" },
          "scale": { "$ref": "#/definitions/Vec3" }
        }
      },
      "ProceduralMeshComponent": {
        "type": "object",
        "required": ["shapeType"],
        "properties": {
          "shapeType": { "type": "string", "enum": ["box", "sphere", "cylinder", "cone", "torus", "plane", "capsule"] },
          "shapeParams": { "type": "object" },
          "color": { "type": "string" },
          "metalness": { "type": "number", "minimum": 0, "maximum": 1 },
          "roughness": { "type": "number", "minimum": 0, "maximum": 1 },
          "wireframe": { "type": "boolean" },
          "modifiers": { "type": "array", "items": { "$ref": "#/definitions/Modifier" } },
          "diffuseMapId": { "type": ["string", "null"] },
          "normalMapId": { "type": ["string", "null"] },
          "roughnessMapId": { "type": ["string", "null"] },
          "metalnessMapId": { "type": ["string", "null"] },
          "emissiveMapId": { "type": ["string", "null"] },
          "emissiveIntensity": { "type": "number" },
          "emissiveColor": { "type": "string" },
          "normalScale": { "type": "number" },
          "uvRepeat": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } } }
        }
      },
      "EditableMeshComponent": {
        "type": "object",
        "description": "Vertex-editable mesh baked from ProceduralMesh",
        "properties": {
          "positions": { "type": "array", "items": { "type": "number" }, "description": "Flat array of vertex positions [x0,y0,z0,x1,y1,z1,...]" },
          "uvs": { "type": "array", "items": { "type": "number" } },
          "normals": { "type": "array", "items": { "type": "number" } },
          "indices": { "type": "array", "items": { "type": "integer" } },
          "color": { "type": "string" },
          "metalness": { "type": "number" },
          "roughness": { "type": "number" },
          "wireframe": { "type": "boolean" }
        }
      },
      "Modifier": {
        "type": "object",
        "required": ["type", "enabled"],
        "properties": {
          "type": { "type": "string", "enum": ["Twist", "Bend", "Taper", "Noise", "Subdivide"] },
          "enabled": { "type": "boolean" },
          "angle": { "type": "number" },
          "axis": { "type": "string", "enum": ["x", "y", "z"] },
          "direction": { "type": "string", "enum": ["x", "y", "z"] },
          "amount": { "type": "number" },
          "curve": { "type": "string", "enum": ["linear", "smooth", "sqrt"] },
          "strength": { "type": "number" },
          "frequency": { "type": "number" },
          "seed": { "type": "number" },
          "iterations": { "type": "integer", "minimum": 0, "maximum": 4 }
        }
      },
      "MeshRendererComponent": {
        "type": "object",
        "description": "Legacy mesh renderer (use ProceduralMesh for new entities)",
        "properties": {
          "geometryType": { "type": "string" },
          "geometryParams": { "type": "object" },
          "color": { "type": "string" },
          "metalness": { "type": "number" },
          "roughness": { "type": "number" },
          "wireframe": { "type": "boolean" }
        }
      },
      "LightComponent": {
        "type": "object",
        "required": ["lightType"],
        "properties": {
          "lightType": { "type": "string", "enum": ["directional", "point", "spot", "ambient"] },
          "color": { "type": "string" },
          "intensity": { "type": "number", "minimum": 0 },
          "castShadow": { "type": "boolean" }
        }
      },
      "ScriptComponent": {
        "type": "object",
        "properties": {
          "fileName": { "type": "string", "description": "Display name for the script" },
          "filePath": { "type": "string", "description": "External file reference in scripts/ folder" },
          "code": { "type": "string", "description": "Embedded code (only when filePath is not set)" },
          "enabled": { "type": "boolean" }
        }
      },
      "RigidBodyComponent": {
        "type": "object",
        "properties": {
          "bodyType": { "type": "string", "enum": ["dynamic", "static", "kinematic"] },
          "mass": { "type": "number", "minimum": 0.01 },
          "gravityScale": { "type": "number" },
          "linearDamping": { "type": "number", "minimum": 0 },
          "angularDamping": { "type": "number", "minimum": 0 },
          "lockRotation": {
            "type": "object",
            "properties": {
              "x": { "type": "boolean" },
              "y": { "type": "boolean" },
              "z": { "type": "boolean" }
            }
          }
        }
      },
      "ColliderComponent": {
        "type": "object",
        "properties": {
          "shape": { "type": "string", "enum": ["box", "sphere", "capsule", "cylinder", "mesh", "convex"] },
          "size": { "$ref": "#/definitions/Vec3", "description": "Box half-extents" },
          "radius": { "type": "number", "minimum": 0.01 },
          "height": { "type": "number", "minimum": 0.01 },
          "restitution": { "type": "number", "minimum": 0, "maximum": 1 },
          "friction": { "type": "number", "minimum": 0, "maximum": 2 },
          "isTrigger": { "type": "boolean" },
          "autoFit": { "type": "boolean", "description": "Auto-fit collider to mesh geometry" }
        }
      },
      "CameraComponent": {
        "type": "object",
        "properties": {
          "fov": { "type": "number", "minimum": 10, "maximum": 170 },
          "near": { "type": "number", "minimum": 0.01 },
          "far": { "type": "number" }
        }
      },
      "AudioSourceComponent": {
        "type": "object",
        "properties": {
          "assetId": { "type": ["string", "null"] },
          "autoplay": { "type": "boolean" },
          "loop": { "type": "boolean" },
          "volume": { "type": "number", "minimum": 0, "maximum": 1 },
          "spatial": { "type": "boolean" }
        }
      },
      "UICanvasComponent": {
        "type": "object",
        "properties": {
          "overlay": { "type": "boolean" }
        }
      },
      "GLBModelComponent": {
        "type": "object",
        "properties": {
          "assetId": { "type": "string" },
          "fileName": { "type": "string" }
        }
      },
      "ParticleEmitterComponent": {
        "type": "object",
        "properties": {
          "maxParticles": { "type": "integer" },
          "emitRate": { "type": "number" },
          "lifetime": { "type": "number" },
          "speed": { "type": "number" },
          "size": { "type": "number" },
          "color": { "type": "string" },
          "preset": { "type": "string", "enum": ["fire", "smoke", "sparkle", "snow", "rain"] }
        }
      },
      "AnimationPlayerComponent": {
        "type": "object",
        "properties": {
          "duration": { "type": "number" },
          "loop": { "type": "boolean" },
          "autoPlay": { "type": "boolean" },
          "keyframes": { "type": "array" }
        }
      },
      "PostProcess": {
        "type": "object",
        "properties": {
          "enabled": { "type": "boolean" },
          "bloom": { "type": "object", "properties": { "enabled": { "type": "boolean" }, "strength": { "type": "number" }, "threshold": { "type": "number" }, "radius": { "type": "number" } } },
          "ssao": { "type": "object", "properties": { "enabled": { "type": "boolean" }, "radius": { "type": "number" }, "intensity": { "type": "number" } } },
          "vignette": { "type": "object", "properties": { "enabled": { "type": "boolean" }, "offset": { "type": "number" }, "darkness": { "type": "number" } } },
          "colorGrading": { "type": "object", "properties": { "enabled": { "type": "boolean" }, "brightness": { "type": "number" }, "contrast": { "type": "number" }, "saturation": { "type": "number" } } }
        }
      },
      "Environment": {
        "type": "object",
        "properties": {
          "backgroundType": { "type": "string", "enum": ["solid", "gradient", "sky"] },
          "backgroundColor": { "type": "string" },
          "gradientTop": { "type": "string" },
          "gradientBottom": { "type": "string" },
          "skyPreset": { "type": "string", "enum": ["day", "sunset", "night", "overcast"] },
          "fogEnabled": { "type": "boolean" },
          "fogType": { "type": "string", "enum": ["linear", "exponential"] },
          "fogColor": { "type": "string" },
          "fogNear": { "type": "number" },
          "fogFar": { "type": "number" },
          "fogDensity": { "type": "number" }
        }
      }
    }
  }, null, 2);

  _log(level, message) {
    if (this.onLog) this.onLog(level, message);
  }

  _emitStateChange() {
    if (this.onStateChange) this.onStateChange(this.isOpen, this._dirty);
  }
}
