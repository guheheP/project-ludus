import * as THREE from 'three';
import { Scene } from '../engine/Scene.js';
import { Transform } from '../engine/components/Transform.js';
import { MeshRenderer } from '../engine/components/MeshRenderer.js';
import { Light } from '../engine/components/Light.js';
import { ScriptComponent, DEFAULT_SCRIPT } from '../engine/components/Script.js';
import { RigidBody } from '../engine/components/RigidBody.js';
import { Collider } from '../engine/components/Collider.js';
import { GLBModel } from '../engine/components/GLBModel.js';
import { ParticleEmitter } from '../engine/components/ParticleEmitter.js';
import { Animator } from '../engine/components/Animator.js';
import { Camera } from '../engine/components/Camera.js';
import { ProceduralMesh } from '../modeling/ProceduralMesh.js';
import { TwistModifier } from '../modeling/modifiers/Twist.js';
import { SceneView } from './panels/SceneView.js';
import { Hierarchy } from './panels/Hierarchy.js';
import { Inspector } from './panels/Inspector.js';
import { Toolbar } from './panels/Toolbar.js';
import { PanelManager } from './panels/PanelManager.js';
import { ContextMenu } from './ContextMenu.js';
import { SceneSerializer } from './SceneSerializer.js';
import { ScriptEditor } from './panels/ScriptEditor.js';
import { ScriptRuntime } from '../scripting/ScriptRuntime.js';
import { InputManager } from '../scripting/InputManager.js';
import { PhysicsWorld } from '../engine/systems/PhysicsWorld.js';
import { AudioSystem } from '../engine/systems/AudioSystem.js';
import { AssetManager } from '../engine/AssetManager.js';
import { ProjectBrowser } from './panels/ProjectBrowser.js';
import { AudioListener } from '../engine/components/AudioListener.js';
import { AudioSource } from '../engine/components/AudioSource.js';
import { UICanvas } from '../engine/components/UICanvas.js';
import { UISystem } from '../engine/systems/UISystem.js';
import { TweenManager } from '../engine/systems/TweenManager.js';
import { Exporter } from './Exporter.js';
import { ProjectManager } from './ProjectManager.js';
import { UndoManager } from './UndoManager.js';
import { AddEntityCommand, DeleteEntityCommand } from './commands/EntityCommands.js';
import { TransformCommand } from './commands/TransformCommand.js';
import { RemoveComponentCommand } from './commands/ComponentCommands.js';
import { ReparentCommand } from './commands/ReparentCommand.js';

const THREE_REVISION = THREE.REVISION;

/**
 * Editor — Main editor class that orchestrates all panels and the engine
 */
export class Editor {
  /** @type {Scene} */
  scene;

  /** @type {SceneView} */
  sceneView;

  /** @type {Hierarchy} */
  hierarchy;

  /** @type {Inspector} */
  inspector;

  /** @type {Toolbar} */
  toolbar;

  /** @type {PanelManager} */
  panelManager;

  /** @type {ContextMenu} */
  contextMenu;

  /** @type {ScriptEditor} */
  scriptEditor;

  /** @type {ScriptRuntime|null} */
  scriptRuntime = null;

  /** @type {InputManager|null} */
  inputManager = null;

  /** @type {PhysicsWorld|null} */
  physics = null;

  /** @type {AssetManager} */
  assetManager;

  /** @type {AudioSystem|null} */
  audioSystem = null;

  /** @type {UISystem|null} */
  uiSystem = null;

  /** @type {ProjectManager} */
  projectManager;

  /** @type {UndoManager} */
  undoManager;

  /** @type {TweenManager} */
  tweenManager;

  /** @type {object|null} Captured transform state before gizmo drag */
  _gizmoOldState = null;

  /** @type {ProjectBrowser} */
  projectBrowser;

  /** @type {import('../engine/Entity.js').Entity|null} */
  selectedEntity = null;

  /** @type {'edit'|'play'|'pause'} */
  mode = 'edit';

  /** @type {string|null} Serialized scene snapshot before play */
  _playSnapshot = null;

  /** @type {HTMLElement|null} */
  _playIndicator = null;

  /** @type {string} Currently active bottom tab */
  activeBottomTab = 'console';

  constructor() {
    // Initialize panels
    this.panelManager = new PanelManager();
    this.contextMenu = new ContextMenu();

    // Project Manager (File System Access API)
    this.projectManager = new ProjectManager();
    this.projectManager.onLog = (level, msg) => this._log(level, msg);
    this.projectManager.onStateChange = (isOpen, isDirty) => this._onProjectStateChange(isOpen, isDirty);
    this.projectManager.onExternalChange = (changes) => this._onExternalFileChange(changes);

    // Undo Manager
    this.undoManager = new UndoManager();
    this.undoManager.onStateChange = (canUndo, canRedo) => {
      this.toolbar.setUndoState?.(canUndo, canRedo);
    };

    // Tween Manager
    this.tweenManager = new TweenManager();

    // Asset Manager
    this.assetManager = new AssetManager();
    this.assetManager.init().then(() => {
      this._log('info', `Loaded ${this.assetManager.assets.length} stored assets`);
      if (this.projectBrowser) this.projectBrowser.refresh();
    });

    // Scene
    this.scene = new Scene('Main Scene');

    // Scene View
    const sceneContainer = document.getElementById('scene-container');
    this.sceneView = new SceneView(sceneContainer);
    this.sceneView.setScene(this.scene);
    this.sceneView.onSelectEntity = (entity) => this.selectEntity(entity);
    this.sceneView.onTransformChange = () => this._onTransformChanged();
    this.sceneView.onTransformStart = () => this._onTransformStart();
    this.sceneView.onTransformEnd = () => this._onTransformEnd();

    // Input manager (for scripts)
    this.inputManager = new InputManager(sceneContainer);

    // Hierarchy
    const hierarchyContent = document.getElementById('hierarchy-content');
    this.hierarchy = new Hierarchy(hierarchyContent);
    this.hierarchy.setScene(this.scene);
    this.hierarchy.onSelectEntity = (entity, focus) => {
      this.selectEntity(entity);
      if (focus) this.sceneView.focusOn(entity);
    };
    this.hierarchy.onContextMenu = (x, y, entity) => {
      this._showHierarchyContextMenu(x, y, entity);
    };
    this.hierarchy.onReparent = (entity, newParent, index) => {
      this.reparentEntity(entity, newParent, index);
    };

    // Inspector
    const inspectorContent = document.getElementById('inspector-content');
    this.inspector = new Inspector(inspectorContent);
    this.inspector.onPropertyChange = () => {
      this.hierarchy.refresh();
      this._markProjectDirty();
    };
    this.inspector.onRemoveComponent = (entity, componentType) => {
      this.removeComponent(entity, componentType);
    };
    // postProcess will be set after sceneView is created (below)
    this.inspector.postProcess = this.sceneView.postProcess;

    // Toolbar
    const toolbarEl = document.getElementById('toolbar');
    this.toolbar = new Toolbar(toolbarEl);
    this.toolbar.onTransformModeChange = (mode) => {
      this.sceneView.setTransformMode(mode);
    };
    this.toolbar.onAddEntity = (type) => this._addEntity(type);
    this.toolbar.onSnapToggle = (enabled) => {
      this.sceneView.setSnap(enabled);
    };
    this.toolbar.onSave = () => this._saveScene();
    this.toolbar.onLoad = () => this._loadScene();
    this.toolbar.onExport = () => this._exportProject();
    this.toolbar.onOpenProject = () => this._openProject();
    this.toolbar.onUndo = () => { this.undoManager.undo(); this._afterUndoRedo(); };
    this.toolbar.onRedo = () => { this.undoManager.redo(); this._afterUndoRedo(); };

    // Script Editor (in bottom panel)
    const scriptEditorContainer = document.getElementById('script-editor-content');
    this.scriptEditor = new ScriptEditor(scriptEditorContainer);
    this.scriptEditor.onScriptChange = (script) => {
      this._log('info', `Script updated: ${script.fileName}`);
      this._onScriptEdited(script);
    };

    // Bottom panel tab switching
    this._initBottomTabs();

    // Project Browser (in bottom panel)
    const projectContent = document.getElementById('project-content');
    if (projectContent) {
      this.projectBrowser = new ProjectBrowser(projectContent, this.assetManager);
      this.projectBrowser.onAddModelToScene = (assetId, fileName) => {
        this._addGLBModel(assetId, fileName);
      };
    }

    // SceneView drop handler for model assets
    this._initSceneViewDrop();

    // Scene toolbar
    this._initSceneToolbar();

    // Play controls
    this._initPlayControls();

    // Keyboard shortcuts
    this._initKeyboardShortcuts();

    // Create default scene
    this._createDefaultScene();

    // Initialize physics (async)
    this._initPhysics();

    // Start render loop
    this._startRenderLoop();

    // Log
    this._log('info', 'Project Ludus Editor initialized');
    this._log('info', 'Three.js r' + THREE_REVISION);
    this._log('info', 'Procedural modeling & scripting ready');
  }

  async _initPhysics() {
    try {
      this.physics = new PhysicsWorld();
      await this.physics.init();
      this._log('info', 'Rapier physics engine initialized');
    } catch (err) {
      this._log('error', `Physics init failed: ${err.message}`);
    }
  }

  /**
   * Select an entity
   * @param {import('../engine/Entity.js').Entity|null} entity
   */
  selectEntity(entity) {
    this.selectedEntity = entity;
    this.sceneView.selectEntity(entity);
    this.hierarchy.setSelected(entity);
    this.inspector.setEntity(entity);

    // Update script editor
    this.scriptEditor.setEntity(entity);
    // Auto-switch to Script tab when selecting entity with script
    if (entity && entity.hasComponent('Script') && this.activeBottomTab !== 'script') {
      this._switchBottomTab('script');
    }
  }

  // =============================================
  // Bottom Panel Tab Switching
  // =============================================

  _initBottomTabs() {
    const tabs = document.querySelectorAll('.panel-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this._switchBottomTab(tab.dataset.tab);
      });
    });
  }

  _switchBottomTab(tabName) {
    this.activeBottomTab = tabName;

    // Update tab buttons
    const tabs = document.querySelectorAll('.panel-tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Show/hide content
    const consoleOutput = document.getElementById('console-output');
    const scriptEditor = document.getElementById('script-editor-content');
    const projectContent = document.getElementById('project-content');

    if (consoleOutput) consoleOutput.style.display = tabName === 'console' ? 'block' : 'none';
    if (scriptEditor) {
      scriptEditor.style.display = tabName === 'script' ? 'flex' : 'none';
      if (tabName === 'script') {
        // Trigger Monaco layout after display change
        setTimeout(() => this.scriptEditor.layout(), 50);
      }
    }
    if (projectContent) {
      projectContent.style.display = tabName === 'project' ? 'flex' : 'none';
    }
  }

  // =============================================
  // Play / Pause / Stop
  // =============================================

  _initPlayControls() {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    // Find play buttons created by Toolbar
    const playBtns = toolbar.querySelectorAll('.toolbar-play-btn');
    if (playBtns.length >= 3) {
      playBtns[0].addEventListener('click', () => this._play());   // ▶
      playBtns[1].addEventListener('click', () => this._pause());  // ⏸
      playBtns[2].addEventListener('click', () => this._stop());   // ⏹
    }
  }

  _play() {
    if (this.mode === 'play') return;

    if (this.mode === 'edit') {
      // Snapshot the scene before playing
      this._playSnapshot = JSON.stringify(SceneSerializer.serialize(this.scene));

      // Initialize physics bodies
      if (this.physics && this.physics.initialized) {
        this.physics.reset();
        this.physics.initDebug(this.scene.threeScene);
        this._registerPhysicsBodies();
      }

      // Initialize and start audio
      this.audioSystem = new AudioSystem(this.scene, this.assetManager);
      this.audioSystem.init();

      // Initialize UI system
      this.uiSystem = new UISystem();
      const sceneContainer = document.getElementById('scene-container');
      this.uiSystem.init(sceneContainer);

      // Create script runtime
      this.scriptRuntime = new ScriptRuntime(this.scene, this.inputManager, this.physics, this.audioSystem, this.uiSystem, this.tweenManager);
      this.scriptRuntime.onLog = (level, msg) => this._log(level, msg);
      this.scriptRuntime.onError = (msg) => this._log('error', msg);
      this.scriptRuntime.onCriticalError = (msg) => {
        this._log('error', `⛔ Script error — auto-stopping play mode: ${msg}`);
        // Defer stop to avoid re-entrant issues mid-update loop
        setTimeout(() => this._stop(), 0);
      };
      this.scriptRuntime.start();

      // If a Camera entity exists, switch rendering to its camera
      if (this.scriptRuntime.activeCamera) {
        this.sceneView._gameCamera = this.scriptRuntime.activeCamera;
      }
    } else if (this.mode === 'pause') {
      // Resume from pause
      if (this.scriptRuntime) this.scriptRuntime.isRunning = true;
    }

    this.mode = 'play';
    this._updatePlayUI();
    this._log('info', '▶ Play mode started');
  }

  _pause() {
    if (this.mode !== 'play') return;
    this.mode = 'pause';
    if (this.scriptRuntime) this.scriptRuntime.isRunning = false;
    this._updatePlayUI();
    this._log('info', '⏸ Paused');
  }

  _stop() {
    if (this.mode === 'edit') return;

    // Restore editor camera
    this.sceneView._gameCamera = null;

    // Stop scripts
    if (this.scriptRuntime) {
      this.scriptRuntime.stop();
      this.scriptRuntime = null;
    }

    // Stop audio
    if (this.audioSystem) {
      this.audioSystem.dispose();
      this.audioSystem = null;
    }

    // Stop UI
    if (this.uiSystem) {
      this.uiSystem.dispose();
      this.uiSystem = null;
    }

    // Kill all active tweens so they don't leak into edit mode
    if (this.tweenManager) {
      this.tweenManager.killAll();
    }

    // Reset all Animators so _elapsed doesn't carry over to next Play
    this.scene.entityMap.forEach((entity) => {
      if (entity.hasComponent('Animator')) {
        entity.getComponent('Animator').reset();
      }
    });

    // Reset physics
    if (this.physics) {
      this.physics.reset();
    }

    // Restore scene from snapshot
    if (this._playSnapshot) {
      try {
        const data = JSON.parse(this._playSnapshot);
        SceneSerializer.deserialize(data, this.scene);
        this._applyPostProcessFromScene();
        this.selectEntity(null);
        this.hierarchy.refresh();
      } catch (err) {
        this._log('error', `Scene restore failed: ${err.message}`);
      }
      this._playSnapshot = null;
    }

    this.mode = 'edit';
    this._updatePlayUI();
    this._log('info', '⏹ Stopped — Scene restored');
  }

  /**
   * Register all entities with RigidBody+Collider to the physics world
   */
  _registerPhysicsBodies() {
    this.scene.entityMap.forEach((entity) => {
      if (entity.hasComponent('RigidBody') && entity.hasComponent('Collider')) {
        this.physics.addBody(entity);
      }
    });
  }

  /**
   * Toggle physics debug visualization
   */
  _togglePhysicsDebug() {
    if (this.physics && this.physics.initialized) {
      this.physics.toggleDebug(this.scene.threeScene);
      this._log('info', `Physics debug: ${this.physics.debugVisible ? 'ON' : 'OFF'}`);
    }
  }

  _updatePlayUI() {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    const playBtns = toolbar.querySelectorAll('.toolbar-play-btn');
    if (playBtns.length >= 3) {
      playBtns[0].classList.toggle('playing', this.mode === 'play');
      playBtns[2].classList.toggle('playing', false);
    }

    // Play mode indicator bar
    if (this.mode === 'play' || this.mode === 'pause') {
      if (!this._playIndicator) {
        this._playIndicator = document.createElement('div');
        this._playIndicator.className = 'play-mode-indicator';
        document.body.appendChild(this._playIndicator);
      }
      this._playIndicator.classList.toggle('paused', this.mode === 'pause');
    } else {
      if (this._playIndicator) {
        this._playIndicator.remove();
        this._playIndicator = null;
      }
    }
  }

  // =============================================
  // Entity management
  // =============================================

  _addEntity(type) {
    let entity;
    const names = {
      'box': 'Cube', 'sphere': 'Sphere', 'cylinder': 'Cylinder',
      'cone': 'Cone', 'torus': 'Torus', 'plane': 'Plane', 'capsule': 'Capsule',
    };

    if (type === 'camera') {
      entity = this.scene.createEntity('Camera');
      entity.addComponent(new Transform());
      entity.getComponent('Transform').setPosition(0, 5, 10);
      const cam = new Camera();
      entity.addComponent(cam);
    } else if (type.includes('light')) {
      const lightType = type.replace('-light', '');
      const lightNames = { 'directional': 'Directional Light', 'point': 'Point Light' };
      entity = this.scene.createEntity(lightNames[lightType] || 'Light');
      entity.addComponent(new Transform());
      const light = new Light();
      entity.addComponent(light);
      light.configure(lightType, { intensity: 1.5 });
      const transform = entity.getComponent('Transform');
      if (lightType === 'directional') {
        transform.setPosition(5, 8, 5);
      } else {
        transform.setPosition(0, 3, 0);
      }
    } else if (type === 'particle') {
      entity = this.scene.createEntity('Particle Emitter');
      entity.addComponent(new Transform());
      const pe = new ParticleEmitter();
      pe.applyPreset('fire');
      entity.addComponent(pe);
      pe.init();
    } else {
      entity = this.scene.createEntity(names[type] || type);
      entity.addComponent(new Transform());
      const pm = new ProceduralMesh();
      entity.addComponent(pm);
      pm.configure(type, {}, { color: this._randomPastelColor() });
    }

    this.hierarchy.refresh();
    this.selectEntity(entity);
    this._log('info', `Created: ${entity.name}`);
    this._markProjectDirty();
    return entity;
  }

  /**
   * Add a GLB model entity to the scene
   * @param {string} assetId
   * @param {string} fileName
   */
  async _addGLBModel(assetId, fileName) {
    const displayName = fileName.replace(/\.(glb|gltf)$/i, '');
    const entity = this.scene.createEntity(displayName);
    entity.addComponent(new Transform());

    const glb = new GLBModel();
    glb.assetId = assetId;
    glb.fileName = fileName;
    entity.addComponent(glb);

    try {
      await glb.loadFromAssetManager(this.assetManager);
      this.hierarchy.refresh();
      this.selectEntity(entity);
      this._log('info', `Loaded model: ${fileName} (${glb.stats.triangles} tris, ${glb.stats.meshes} meshes)`);
      this._markProjectDirty();
    } catch (err) {
      this._log('error', `Failed to load model: ${fileName}`);
      this.scene.removeEntity(entity);
    }
  }

  /**
   * Initialize SceneView drop handler for asset drag & drop
   */
  _initSceneViewDrop() {
    const container = this.sceneView.renderer.domElement;

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data.type === 'asset' && data.assetType === 'model') {
          const meta = this.assetManager.getAssetMeta(data.id);
          if (meta) {
            this._addGLBModel(data.id, meta.name);
          }
        }
      } catch (err) {
        // Not a JSON drag, ignore
      }
    });
  }

  /**
   * Add Script component to selected entity
   */
  _addScriptToSelected() {
    if (!this.selectedEntity) return;
    if (this.selectedEntity.hasComponent('Script')) {
      this._log('warn', 'Entity already has a Script component');
      return;
    }
    const script = new ScriptComponent();
    this.selectedEntity.addComponent(script);
    this.inspector.refresh();
    this.scriptEditor.setEntity(this.selectedEntity);
    this._switchBottomTab('script');
    this._log('info', `Script added to ${this.selectedEntity.name}`);
  }

  _deleteSelected() {
    if (!this.selectedEntity || this.selectedEntity === this.scene.root) return;
    const entity = this.selectedEntity;
    const cmd = new DeleteEntityCommand(this.scene, entity);
    this.undoManager.execute(cmd);
    this.selectEntity(null);
    this.hierarchy.refresh();
    this._log('info', `Deleted: ${entity.name}`);
    this._markProjectDirty();
  }

  _duplicateSelected() {
    if (!this.selectedEntity || this.selectedEntity === this.scene.root) return;
    const src = this.selectedEntity;
    const entity = this.scene.createEntity(src.name + ' (Copy)', src.parent);

    if (src.hasComponent('Transform')) {
      const t = new Transform();
      entity.addComponent(t);
      const srcT = src.getComponent('Transform');
      t.setPosition(srcT.position.x + 1, srcT.position.y, srcT.position.z);
      t.setScale(srcT.scale.x, srcT.scale.y, srcT.scale.z);
      entity.object3D.rotation.copy(srcT.rotation);
    }

    if (src.hasComponent('ProceduralMesh')) {
      const srcPM = src.getComponent('ProceduralMesh');
      const pm = new ProceduralMesh();
      entity.addComponent(pm);
      pm.deserialize(srcPM.serialize());
    } else if (src.hasComponent('MeshRenderer')) {
      const srcMR = src.getComponent('MeshRenderer');
      const mr = new MeshRenderer();
      entity.addComponent(mr);
      mr.configure(srcMR.geometryType, { ...srcMR.geometryParams }, {
        color: srcMR.color, metalness: srcMR.metalness,
        roughness: srcMR.roughness, wireframe: srcMR.wireframe,
      });
    }

    if (src.hasComponent('Light')) {
      const srcL = src.getComponent('Light');
      const light = new Light();
      entity.addComponent(light);
      light.configure(srcL.lightType, {
        color: srcL.color, intensity: srcL.intensity,
      });
    }

    if (src.hasComponent('Script')) {
      const srcS = src.getComponent('Script');
      const script = new ScriptComponent();
      script.code = srcS.code;
      script.fileName = srcS.fileName;
      entity.addComponent(script);
    }

    if (src.hasComponent('RigidBody')) {
      const srcRB = src.getComponent('RigidBody');
      const rb = new RigidBody();
      rb.deserialize(srcRB.serialize());
      entity.addComponent(rb);
    }

    if (src.hasComponent('Collider')) {
      const srcCol = src.getComponent('Collider');
      const col = new Collider();
      col.deserialize(srcCol.serialize());
      entity.addComponent(col);
    }

    if (src.hasComponent('AudioListener')) {
      const al = new AudioListener();
      entity.addComponent(al);
    }

    if (src.hasComponent('AudioSource')) {
      const srcAS = src.getComponent('AudioSource');
      const as = new AudioSource();
      as.deserialize(srcAS.serialize());
      entity.addComponent(as);
    }

    if (src.hasComponent('UICanvas')) {
      const srcUC = src.getComponent('UICanvas');
      const uc = new UICanvas();
      uc.deserialize(srcUC.serialize());
      entity.addComponent(uc);
    }

    if (src.hasComponent('GLBModel')) {
      const srcGLB = src.getComponent('GLBModel');
      const glb = new GLBModel();
      glb.deserialize(srcGLB.serialize());
      entity.addComponent(glb);
      // Async load
      glb.loadFromAssetManager(this.assetManager).catch(() => {});
    }

    // ParticleEmitter
    if (src.hasComponent('ParticleEmitter')) {
      const srcPE = src.getComponent('ParticleEmitter');
      const pe = new ParticleEmitter();
      pe.deserialize(srcPE.serialize());
      entity.addComponent(pe);
      pe.init();
    }

    // Animator
    if (src.hasComponent('Animator')) {
      const srcAnim = src.getComponent('Animator');
      const anim = new Animator();
      anim.deserialize(srcAnim.serialize());
      entity.addComponent(anim);
    }

    // Camera
    if (src.hasComponent('Camera')) {
      const srcCam = src.getComponent('Camera');
      const cam = new Camera();
      cam.deserialize(srcCam.serialize());
      entity.addComponent(cam);
    }

    this.hierarchy.refresh();
    this.selectEntity(entity);
    this._log('info', `Duplicated: ${src.name}`);
  }

  // =============================================
  // Default scene setup
  // =============================================

  _createDefaultScene() {
    // Directional light
    const dirLight = this.scene.createEntity('Directional Light');
    dirLight.addComponent(new Transform());
    const dl = new Light();
    dirLight.addComponent(dl);
    dl.configure('directional', { intensity: 2.0, castShadow: true });
    dirLight.getComponent('Transform').setPosition(5, 8, 5);

    // Ambient light
    const ambLight = this.scene.createEntity('Ambient Light');
    ambLight.addComponent(new Transform());
    const al = new Light();
    ambLight.addComponent(al);
    al.configure('ambient', { intensity: 0.3, color: '#6670aa' });

    // Ground plane
    const ground = this.scene.createEntity('Ground');
    ground.addComponent(new Transform());
    const groundMR = new MeshRenderer();
    ground.addComponent(groundMR);
    groundMR.configure('plane', { width: 20, height: 20 }, {
      color: '#2a2a4a', roughness: 0.9, metalness: 0.0,
    });
    ground.getComponent('Transform').setRotationDeg(-90, 0, 0);
    ground.getComponent('Transform').setPosition(0, -0.5, 0);

    // Twisted Cube with Twist modifier
    const cube = this.scene.createEntity('Twisted Cube');
    cube.addComponent(new Transform());
    const cubePM = new ProceduralMesh();
    cube.addComponent(cubePM);
    cubePM.configure('box', { width: 1, height: 2, depth: 1 }, {
      color: '#6c63ff', metalness: 0.3, roughness: 0.4
    });
    cubePM.addModifier(new TwistModifier());
    cube.getComponent('Transform').setPosition(0, 1, 0);

    // Spinning Sphere with Script
    const sphere = this.scene.createEntity('Spinning Sphere');
    sphere.addComponent(new Transform());
    const spherePM = new ProceduralMesh();
    sphere.addComponent(spherePM);
    spherePM.configure('sphere', {}, {
      color: '#f87171', metalness: 0.5, roughness: 0.3
    });
    sphere.getComponent('Transform').setPosition(2.5, 0.5, 0);
    // Add demo script
    const sphereScript = new ScriptComponent();
    sphereScript.code = `// Spinning Sphere Script
// Press Play (▶) to see it in action!

function start() {
  console.log('Spinning sphere started!');
}

function update(dt) {
  // Rotate around Y axis
  this.transform.rotation.y += 2.0 * dt;

  // Gentle bobbing motion
  const t = this.time.elapsed;
  this.transform.position.y = 0.5 + Math.sin(t * 2) * 0.2;

  // Keyboard interaction
  if (this.input.isKeyDown('ArrowRight')) {
    this.transform.position.x += 2.0 * dt;
  }
  if (this.input.isKeyDown('ArrowLeft')) {
    this.transform.position.x -= 2.0 * dt;
  }
}
`;
    sphereScript.fileName = 'spin.js';
    sphere.addComponent(sphereScript);

    // Cylinder
    const cyl = this.scene.createEntity('Cylinder');
    cyl.addComponent(new Transform());
    const cylPM = new ProceduralMesh();
    cyl.addComponent(cylPM);
    cylPM.configure('cylinder', {}, {
      color: '#4ade80', metalness: 0.2, roughness: 0.5
    });
    cyl.getComponent('Transform').setPosition(-2.5, 0.5, 0);

    // === Physics Demo Objects ===

    // Ground gets a static rigidbody + box collider
    // Note: Ground visual is a plane rotated -90° around X,
    // but for physics we want a flat box on the XZ plane at Y=0
    const groundRB = new RigidBody();
    groundRB.bodyType = 'static';
    ground.addComponent(groundRB);
    const groundCol = new Collider();
    groundCol.shape = 'box';
    groundCol.size = { x: 10, y: 10, z: 0.5 };
    groundCol.restitution = 0.2;
    groundCol.friction = 0.8;
    ground.addComponent(groundCol);

    // Falling Cube — dynamic with physics
    const fallingCube = this.scene.createEntity('Physics Cube');
    fallingCube.addComponent(new Transform());
    const fcPM = new ProceduralMesh();
    fallingCube.addComponent(fcPM);
    fcPM.configure('box', { width: 0.6, height: 0.6, depth: 0.6 }, {
      color: '#fbbf24', metalness: 0.4, roughness: 0.3
    });
    fallingCube.getComponent('Transform').setPosition(0, 4, -1.5);
    const fcRB = new RigidBody();
    fcRB.bodyType = 'dynamic';
    fcRB.mass = 1.0;
    fallingCube.addComponent(fcRB);
    const fcCol = new Collider();
    fcCol.shape = 'box';
    fcCol.size = { x: 0.3, y: 0.3, z: 0.3 };
    fcCol.restitution = 0.5;
    fallingCube.addComponent(fcCol);

    // Bouncy Ball — dynamic sphere with high restitution
    const ball = this.scene.createEntity('Bouncy Ball');
    ball.addComponent(new Transform());
    const ballPM = new ProceduralMesh();
    ball.addComponent(ballPM);
    ballPM.configure('sphere', { radius: 0.3 }, {
      color: '#f472b6', metalness: 0.6, roughness: 0.2
    });
    ball.getComponent('Transform').setPosition(1, 5, -1.5);
    const ballRB = new RigidBody();
    ballRB.bodyType = 'dynamic';
    ballRB.mass = 0.5;
    ball.addComponent(ballRB);
    const ballCol = new Collider();
    ballCol.shape = 'sphere';
    ballCol.radius = 0.3;
    ballCol.restitution = 0.85;
    ball.addComponent(ballCol);

    // Add script to Physics Cube for interaction
    const cubeScript = new ScriptComponent();
    cubeScript.code = `// Physics Cube
// Press Play and use SPACE to launch!

function start() {
  console.log('Physics Cube ready. Press SPACE to launch!');
}

function update(dt) {
  if (this.input.isKeyPressed('Space')) {
    this.rigidbody.addImpulse(0, 5, 0);
    console.log('Launch!');
  }
}
`;
    cubeScript.fileName = 'physics_cube.js';
    fallingCube.addComponent(cubeScript);

    this.hierarchy.refresh();
  }

  // =============================================
  // Scene toolbar
  // =============================================

  _initSceneToolbar() {
    const stb = document.getElementById('scene-toolbar');
    if (!stb) return;

    const info = document.createElement('span');
    info.className = 'scene-info';
    info.id = 'scene-info';
    info.textContent = '0 entities | 60 fps';
    stb.appendChild(info);
  }

  // =============================================
  // Context Menu
  // =============================================

  _showHierarchyContextMenu(x, y, entity) {
    const items = [];

    items.push({ label: 'Add Cube', icon: '⬜', action: () => this._addEntity('box') });
    items.push({ label: 'Add Sphere', icon: '⬤', action: () => this._addEntity('sphere') });
    items.push({ label: 'Add Cylinder', icon: '▣', action: () => this._addEntity('cylinder') });
    items.push({ label: 'Add Cone', icon: '◇', action: () => this._addEntity('cone') });
    items.push({ label: 'Add Torus', icon: '◎', action: () => this._addEntity('torus') });
    items.push({ label: 'Add Plane', icon: '▬', action: () => this._addEntity('plane') });
    items.push({ label: 'Add Capsule', icon: '💊', action: () => this._addEntity('capsule') });
    items.push({ separator: true });
    items.push({ label: 'Add Dir Light', icon: '☀️', action: () => this._addEntity('directional-light') });
    items.push({ label: 'Add Point Light', icon: '💡', action: () => this._addEntity('point-light') });
    items.push({ label: 'Add Camera', icon: '🎥', action: () => this._addEntity('camera') });
    items.push({ label: 'Add Particles', icon: '✨', action: () => this._addEntity('particle') });

    if (entity && entity !== this.scene.root) {
      items.push({ separator: true });
      items.push({ label: 'Add Script', icon: '📝', action: () => {
        this.selectEntity(entity);
        this._addScriptToSelected();
      }});
      items.push({ label: 'Duplicate', icon: '📋', action: () => {
        this.selectEntity(entity);
        this._duplicateSelected();
      }, shortcut: 'Ctrl+D' });
      items.push({ label: 'Delete', icon: '🗑️', action: () => {
        this.selectEntity(entity);
        this._deleteSelected();
      }, shortcut: 'Del' });
      items.push({ separator: true });
      items.push({ label: 'Focus', icon: '🎯', action: () => {
        this.selectEntity(entity);
        this.sceneView.focusOn(entity);
      }, shortcut: 'F' });
    }

    this.contextMenu.show(x, y, items);
  }

  // =============================================
  // Keyboard shortcuts
  // =============================================

  _initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't hijack Monaco editor input
      if (e.target.closest('.monaco-editor')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      switch (e.key) {
        case 'w':
        case 'e':
        case 'r':
        case 'g':
          this.toolbar.handleKey(e.key);
          break;
        case 'Delete':
        case 'Backspace':
          this._deleteSelected();
          break;
        case 'd':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this._duplicateSelected();
          }
          break;
        case 'f':
          if (this.selectedEntity) {
            this.sceneView.focusOn(this.selectedEntity);
          }
          break;
        case 'z':
          if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
            e.preventDefault();
            this.undoManager.undo();
            this._afterUndoRedo();
          } else if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            e.preventDefault();
            this.undoManager.redo();
            this._afterUndoRedo();
          }
          break;
        case 'y':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.undoManager.redo();
            this._afterUndoRedo();
          }
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this._saveScene();
          }
          break;
        case 'o':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this._loadScene();
          }
          break;
        case 'F5':
          e.preventDefault();
          if (this.mode === 'edit') this._play();
          else this._stop();
          break;
        case 'F6':
          e.preventDefault();
          this._pause();
          break;
        case 'Escape':
          if (this.mode !== 'edit') {
            this._stop();
          } else {
            this.selectEntity(null);
          }
          break;
      }
    });
  }

  // =============================================
  // Project Management
  // =============================================

  async _openProject() {
    const opened = await this.projectManager.openProject();
    if (!opened) return;

    // Try to load existing scene
    const sceneData = await this.projectManager.loadScene();
    if (sceneData) {
      SceneSerializer.deserialize(sceneData, this.scene);
      this._applyPostProcessFromScene();
      // Load external script files
      await this._loadExternalScripts();
      // Reload GLB models
      await this._reloadGLBModels();
      // Initialize particle emitters
      this._initParticleEmitters();
      this.selectEntity(null);
      this.hierarchy.refresh();
      this._log('info', 'Project scene loaded from disk');
    } else {
      // First time — save current scene to project
      await this._saveSceneToProject();
      this._log('info', 'Default scene saved to new project');
    }

    // Start watching for external changes (AI IDE edits)
    this.projectManager.startWatching();
  }

  /**
   * Load script code from external files for all entities with filePath
   */
  async _loadExternalScripts() {
    if (!this.projectManager.isOpen) return;

    for (const [, entity] of this.scene.entityMap) {
      if (entity.hasComponent('Script')) {
        const script = entity.getComponent('Script');
        if (script.filePath) {
          const code = await this.projectManager.loadScript(script.filePath);
          if (code !== null) {
            script.code = code;
          }
        }
      }
    }
  }

  /**
   * Reload all GLBModel components in the scene
   */
  async _reloadGLBModels() {
    const promises = [];
    this.scene.entityMap.forEach((entity) => {
      if (entity.hasComponent('GLBModel')) {
        const glb = entity.getComponent('GLBModel');
        if (glb.assetId && !glb.loaded) {
          promises.push(
            glb.loadFromAssetManager(this.assetManager)
              .then(() => this._log('info', `Reloaded model: ${glb.fileName}`))
              .catch(() => this._log('warn', `Failed to reload model: ${glb.fileName}`))
          );
        }
      }
    });
    if (promises.length > 0) {
      await Promise.all(promises);
      this.hierarchy.refresh();
    }
  }

  /**
   * Initialize all ParticleEmitter components in the scene (after deserialize)
   */
  _initParticleEmitters() {
    this.scene.entityMap.forEach((entity) => {
      if (entity.hasComponent('ParticleEmitter')) {
        const pe = entity.getComponent('ParticleEmitter');
        if (!pe._initialized) {
          pe.init();
        }
      }
    });
  }

  /**
   * Update all particle emitters each frame
   * @param {number} dt
   */
  _updateParticles(dt) {
    this.scene.entityMap.forEach((entity) => {
      if (entity.hasComponent('ParticleEmitter')) {
        const pe = entity.getComponent('ParticleEmitter');
        if (!pe._initialized) pe.init();
        pe.update(dt);
      }
    });
  }

  /**
   * Update all Animator components each frame
   * @param {number} dt
   */
  _updateAnimators(dt) {
    this.scene.entityMap.forEach((entity) => {
      if (entity.hasComponent('Animator')) {
        entity.getComponent('Animator').update(dt);
      }
    });
  }

  /**
   * Update all GLBModel animation mixers each frame
   * @param {number} dt
   */
  _updateGLBAnimations(dt) {
    this.scene.entityMap.forEach((entity) => {
      if (entity.hasComponent('GLBModel')) {
        entity.getComponent('GLBModel').updateAnimation(dt);
      }
    });
  }

  /**
   * Apply post-process settings stored from deserialized scene data
   */
  _applyPostProcessFromScene() {
    if (this.scene._postProcessData && this.sceneView?.postProcess) {
      this.sceneView.postProcess.deserialize(this.scene._postProcessData);
      delete this.scene._postProcessData;
    }
  }

  /**
   * Save scene and all external scripts to project folder
   */
  async _saveSceneToProject() {
    if (!this.projectManager.isOpen) return;

    // Save scripts as external files
    for (const [, entity] of this.scene.entityMap) {
      if (entity.hasComponent('Script')) {
        const script = entity.getComponent('Script');
        // Auto-assign filePath if not set
        if (!script.filePath) {
          script.filePath = this._generateScriptFileName(entity, script);
        }
        await this.projectManager.saveScript(script.filePath, script.code);
      }
    }

    // Serialize and save scene
    const sceneData = SceneSerializer.serialize(this.scene, {
      postProcess: this.sceneView?.postProcess
    });
    await this.projectManager.saveScene(sceneData);
  }

  /**
   * Generate a unique script file name for an entity
   */
  _generateScriptFileName(entity, script) {
    // Use entity name, sanitized for file system
    const baseName = entity.name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_');
    return `${baseName}.js`;
  }

  /**
   * Mark project as dirty (triggers auto-save)
   */
  _markProjectDirty() {
    if (!this.projectManager.isOpen) return;
    this.projectManager.markDirty(() => this._saveSceneToProject());
  }

  /**
   * Handle script content changes from the script editor
   */
  async _onScriptEdited(script) {
    if (!this.projectManager.isOpen || !script.filePath) return;
    await this.projectManager.saveScript(script.filePath, script.code);
  }

  /**
   * Handle project state changes (open/close, dirty flag)
   */
  _onProjectStateChange(isOpen, isDirty) {
    // Update toolbar indicator
    this.toolbar.setProjectState?.(isOpen, isDirty);
  }

  /**
   * Handle external file changes (AI IDE edits)
   */
  async _onExternalFileChange(changes) {
    for (const change of changes) {
      if (change.path.startsWith('scripts/') && change.type === 'modified') {
        // Script file was modified externally
        const scriptName = change.name;
        this._log('info', `External change detected: ${scriptName}`);

        // Find the entity that uses this script
        this.scene.entityMap.forEach((entity) => {
          if (entity.hasComponent('Script')) {
            const script = entity.getComponent('Script');
            if (script.filePath === scriptName) {
              // Reload the script code
              this.projectManager.loadScript(scriptName).then((code) => {
                if (code !== null) {
                  script.code = code;
                  // Refresh script editor if this entity is selected
                  if (this.selectedEntity === entity) {
                    this.scriptEditor.setEntity(entity);
                  }
                  this._log('info', `Script reloaded: ${scriptName}`);
                }
              });
            }
          }
        });
      } else if (change.path.startsWith('scenes/') && change.type === 'modified') {
        // Scene file was modified externally
        this._log('info', `External scene change detected: ${change.name}`);
        const sceneData = await this.projectManager.loadScene();
        if (sceneData) {
          SceneSerializer.deserialize(sceneData, this.scene);
          this._applyPostProcessFromScene();
          await this._loadExternalScripts();
          this.selectEntity(null);
          this.hierarchy.refresh();
          this._log('info', 'Scene reloaded from external change');
        }
      }
    }
  }

  // =============================================
  // Save / Load (File Dialog Fallback)
  // =============================================

  async _saveScene() {
    if (this.projectManager.isOpen) {
      // Save to project folder
      try {
        await this._saveSceneToProject();
        this._log('info', 'Scene saved to project');
      } catch (err) {
        this._log('error', `Save failed: ${err.message}`);
      }
    } else {
      // Fallback: download as JSON
      try {
        SceneSerializer.downloadSceneJSON(this.scene);
        this._log('info', 'Scene saved as JSON (download)');
      } catch (err) {
        this._log('error', `Save failed: ${err.message}`);
      }
    }
  }

  async _loadScene() {
    if (this.projectManager.isOpen) {
      // Load from project folder
      try {
        const sceneData = await this.projectManager.loadScene();
        if (sceneData) {
          SceneSerializer.deserialize(sceneData, this.scene);
          this._applyPostProcessFromScene();
          await this._loadExternalScripts();
          this.selectEntity(null);
          this.hierarchy.refresh();
          this._log('info', 'Scene loaded from project');
        }
      } catch (err) {
        this._log('error', `Load failed: ${err.message}`);
      }
    } else {
      // Fallback: file dialog
      try {
        await SceneSerializer.loadSceneJSON(this.scene);
        this.selectEntity(null);
        this.hierarchy.refresh();
        this._log('info', 'Scene loaded successfully');
      } catch (err) {
        if (err.message !== 'No file selected') {
          this._log('error', `Load failed: ${err.message}`);
        }
      }
    }
  }

  async _exportProject() {
    this._log('info', 'Exporting project to standalone ZIP...');
    try {
      const exporter = new Exporter(this.scene, this.assetManager);
      await exporter.exportZip();
      this._log('info', 'Export successful.');
    } catch (err) {
      this._log('error', `Export failed: ${err.message}`);
      console.error(err);
    }
  }

  // =============================================
  // Render loop
  // =============================================

  _startRenderLoop() {
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTime = 0;

    const animate = () => {
      requestAnimationFrame(animate);

      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05); // Cap at 50ms
      lastTime = now;

      // Update physics & scripts if playing
      if (this.mode === 'play') {
        if (this.physics && this.physics.initialized) {
          this.physics.step(dt);
        }
        if (this.scriptRuntime) {
          this.scriptRuntime.update(dt);
          // Sync game camera from ScriptRuntime
          if (this.scriptRuntime.activeCamera) {
            this.sceneView._gameCamera = this.scriptRuntime.activeCamera;
          }
        }
      }

      frameCount++;
      fpsTime += dt;
      if (fpsTime >= 1.0) {
        const fps = Math.round(frameCount / fpsTime);
        const entityCount = this.scene.entityMap.size - 1;
        const info = document.getElementById('scene-info');
        if (info) {
          const modeLabel = this.mode === 'play' ? ' [PLAYING]' : this.mode === 'pause' ? ' [PAUSED]' : '';
          info.textContent = `${entityCount} entities | ${fps} fps${modeLabel}`;
        }
        frameCount = 0;
        fpsTime = 0;
      }

      // Update particle systems (always, for editor preview)
      this._updateParticles(dt);

      // Update animators (always, for editor preview)
      this._updateAnimators(dt);

      // Update GLB model animations
      this._updateGLBAnimations(dt);

      // Update tweens
      if (this.tweenManager) {
        this.tweenManager.update(dt);
      }

      this.sceneView.render();
    };

    animate();
  }

  _onTransformChanged() {
    this.inspector.refresh();
  }

  _onTransformStart() {
    if (this.selectedEntity) {
      this._gizmoOldState = TransformCommand.captureState(this.selectedEntity);
    }
  }

  _onTransformEnd() {
    if (this.selectedEntity && this._gizmoOldState) {
      const newState = TransformCommand.captureState(this.selectedEntity);
      if (newState) {
        const cmd = new TransformCommand(this.selectedEntity, this._gizmoOldState, newState);
        // Push directly to stack (already executed via gizmo)
        this.undoManager._undoStack.push(cmd);
        this.undoManager._redoStack.length = 0;
        if (this.undoManager._undoStack.length > this.undoManager._maxStack) {
          this.undoManager._undoStack.shift();
        }
        this.undoManager._emitStateChange();
        this._markProjectDirty();
      }
      this._gizmoOldState = null;
    }
  }

  /**
   * Refresh UI after undo/redo
   */
  _afterUndoRedo() {
    this.selectEntity(this.selectedEntity);
    this.hierarchy.refresh();
    this.inspector.refresh();
    this._markProjectDirty();
  }

  /**
   * Remove a component from the selected entity (called from Inspector)
   * @param {import('../engine/Entity.js').Entity} entity
   * @param {string} componentType
   */
  removeComponent(entity, componentType) {
    if (!entity || componentType === 'Transform') return;
    const cmd = new RemoveComponentCommand(entity, componentType);
    this.undoManager.execute(cmd);
    this.hierarchy.refresh();
    this.inspector.refresh();
    this._markProjectDirty();
    this._log('info', `Removed ${componentType} from ${entity.name}`);
  }

  /**
   * Reparent an entity (called from Hierarchy D&D)
   * @param {import('../engine/Entity.js').Entity} entity
   * @param {import('../engine/Entity.js').Entity} newParent
   * @param {number} index
   */
  reparentEntity(entity, newParent, index = -1) {
    if (!entity || entity === this.scene.root) return;
    // Prevent parenting to self or own descendant
    let check = newParent;
    while (check) {
      if (check === entity) {
        this._log('warn', `Cannot move "${entity.name}" into its own descendant "${newParent.name}"`);
        return;
      }
      check = check.parent;
    }
    const cmd = new ReparentCommand(this.scene, entity, newParent, index);
    this.undoManager.execute(cmd);
    this.hierarchy.refresh();
    this._markProjectDirty();
    this._log('info', `Moved ${entity.name} to ${newParent.name}`);
  }

  // =============================================
  // Utilities
  // =============================================

  _randomPastelColor() {
    const hue = Math.random() * 360;
    return `hsl(${hue}, 60%, 55%)`;
  }

  _log(level, message) {
    const output = document.getElementById('console-output');
    if (!output) return;

    const line = document.createElement('div');
    line.className = 'console-line';

    const time = document.createElement('span');
    time.className = 'console-line-time';
    const now = new Date();
    time.textContent = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
    line.appendChild(time);

    const msg = document.createElement('span');
    msg.className = `console-line-${level}`;
    msg.textContent = message;
    line.appendChild(msg);

    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  /**
   * Dispose the entire editor — clean up event listeners, renderer, etc.
   * Call when the editor is being unmounted or the page is unloaded.
   */
  dispose() {
    if (this.mode !== 'edit') {
      this._stop();
    }
    if (this.inputManager) {
      this.inputManager.dispose();
      this.inputManager = null;
    }
    if (this.sceneView) {
      this.sceneView.dispose();
    }
  }
}
