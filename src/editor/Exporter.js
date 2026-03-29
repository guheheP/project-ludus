import JSZip from 'jszip';
import { SceneSerializer } from './SceneSerializer.js';

export class Exporter {
  /**
   * @param {import('../engine/Scene.js').Scene} scene 
   * @param {import('../engine/AssetManager.js').AssetManager} assetManager 
   */
  constructor(scene, assetManager) {
    this.scene = scene;
    this.assetManager = assetManager;
  }

  async exportZip() {
    const zip = new JSZip();

    // 1. Serialize Scene
    const sceneData = SceneSerializer.serialize(this.scene);
    zip.file('data/scene.json', JSON.stringify(sceneData, null, 2));

    // 2. Export Assets
    for (const asset of this.assetManager.assets) {
      const blob = await this.assetManager.getAssetBlob(asset.id);
      if (blob) {
        zip.file('assets/' + asset.id + '_' + asset.name, blob);
      }
    }

    // 3. Generate Runtime HTML
    const html = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <title>' + this.scene.name + '</title>',
      '  <style>',
      '    body { margin: 0; padding: 0; overflow: hidden; background: #000; }',
      '    #game-container { width: 100vw; height: 100vh; position: relative; }',
      '    #loading { position: absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#fff; font-family:sans-serif; }',
      '    #ui-overlay { position: absolute; top:0; left:0; right:0; bottom:0; pointer-events:none; z-index:10; overflow:hidden; font-family:sans-serif; }',
      '  </style>',
      '  <script type="importmap">',
      '    {',
      '      "imports": {',
      '        "three": "https://unpkg.com/three@0.183.0/build/three.module.js",',
      '        "three/addons/": "https://unpkg.com/three@0.183.0/examples/jsm/",',
      '        "@dimforge/rapier3d-compat": "https://unpkg.com/@dimforge/rapier3d-compat@0.19.0/rapier.es.js",',
      '        "idb-keyval": "https://unpkg.com/idb-keyval@6.2.1/dist/index.js"',
      '      }',
      '    }',
      '  </script>',
      '</head>',
      '<body>',
      '  <div id="loading">Loading Game...</div>',
      '  <div id="game-container"></div>',
      '  <script type="module" src="main.js"></script>',
      '</body>',
      '</html>'
    ].join('\n');
    zip.file('index.html', html);

    // 4. Fetch Engine Files — complete list of all required source files
    const engineFiles = [
      // Engine core
      'src/engine/Component.js',
      'src/engine/Entity.js',
      'src/engine/Scene.js',
      'src/engine/AssetManager.js',
      // Components
      'src/engine/components/Transform.js',
      'src/engine/components/MeshRenderer.js',
      'src/engine/components/Light.js',
      'src/engine/components/Script.js',
      'src/engine/components/RigidBody.js',
      'src/engine/components/Collider.js',
      'src/engine/components/AudioListener.js',
      'src/engine/components/AudioSource.js',
      'src/engine/components/UICanvas.js',
      'src/engine/components/GLBModel.js',
      'src/engine/components/ParticleEmitter.js',
      'src/engine/components/Animator.js',
      // Systems
      'src/engine/systems/PhysicsWorld.js',
      'src/engine/systems/AudioSystem.js',
      'src/engine/systems/UISystem.js',
      'src/engine/systems/TweenManager.js',
      'src/engine/systems/PostProcessManager.js',
      // Modeling
      'src/modeling/Modifier.js',
      'src/modeling/ProceduralMesh.js',
      'src/modeling/modifiers/Twist.js',
      'src/modeling/modifiers/Bend.js',
      'src/modeling/modifiers/Taper.js',
      'src/modeling/modifiers/Noise.js',
      'src/modeling/modifiers/Subdivide.js',
      // Scripting
      'src/scripting/InputManager.js',
      'src/scripting/ScriptRuntime.js',
      // Editor (serializer only, needed for scene loading)
      'src/editor/SceneSerializer.js',
    ];

    for (const filePath of engineFiles) {
      try {
        const res = await fetch('/' + filePath);
        if (res.ok) {
          const text = await res.text();
          zip.file(filePath, text);
        } else {
          console.warn('Failed to fetch engine file for export:', filePath);
        }
      } catch (err) {
        console.warn('Network error fetching:', filePath, err);
      }
    }

    // 5. Generate Runtime main.js
    const mainJs = [
      'import * as THREE from "three";',
      'import { Scene } from "./src/engine/Scene.js";',
      'import { SceneSerializer } from "./src/editor/SceneSerializer.js";',
      'import { PhysicsWorld } from "./src/engine/systems/PhysicsWorld.js";',
      'import { AudioSystem } from "./src/engine/systems/AudioSystem.js";',
      'import { UISystem } from "./src/engine/systems/UISystem.js";',
      'import { TweenManager } from "./src/engine/systems/TweenManager.js";',
      'import { PostProcessManager } from "./src/engine/systems/PostProcessManager.js";',
      'import { AssetManager } from "./src/engine/AssetManager.js";',
      'import { InputManager } from "./src/scripting/InputManager.js";',
      'import { ScriptRuntime } from "./src/scripting/ScriptRuntime.js";',
      '',
      'class Runtime {',
      '  constructor() {',
      '    this.container = document.getElementById("game-container");',
      '    this.renderer = new THREE.WebGLRenderer({ antialias: true });',
      '    this.renderer.setSize(window.innerWidth, window.innerHeight);',
      '    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));',
      '    this.renderer.shadowMap.enabled = true;',
      '    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;',
      '    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;',
      '    this.renderer.toneMappingExposure = 1.2;',
      '    this.container.appendChild(this.renderer.domElement);',
      '    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);',
      '    this.camera.position.set(0, 5, 10);',
      '    this.camera.lookAt(0,0,0);',
      '    this.lastTime = performance.now();',
      '    window.addEventListener("resize", () => {',
      '      this.camera.aspect = window.innerWidth / window.innerHeight;',
      '      this.camera.updateProjectionMatrix();',
      '      this.renderer.setSize(window.innerWidth, window.innerHeight);',
      '    });',
      '  }',
      '',
      '  async start() {',
      '    // Load scene data',
      '    const res = await fetch("./data/scene.json");',
      '    const sceneData = await res.json();',
      '',
      '    // Create scene and deserialize',
      '    this.scene = new Scene(sceneData.name || "Game");',
      '    SceneSerializer.deserialize(sceneData, this.scene);',
      '',
      '    // Initialize physics',
      '    this.physics = new PhysicsWorld();',
      '    await this.physics.init();',
      '',
      '    // Register physics bodies',
      '    this.scene.entityMap.forEach((entity) => {',
      '      if (entity.hasComponent("RigidBody") && entity.hasComponent("Collider")) {',
      '        this.physics.addBody(entity);',
      '      }',
      '    });',
      '',
      '    // Initialize audio',
      '    this.assetManager = new AssetManager();',
      '    await this.assetManager.init();',
      '    this.audioSystem = new AudioSystem(this.scene, this.assetManager);',
      '    await this.audioSystem.init();',
      '',
      '    // Initialize UI',
      '    this.uiSystem = new UISystem();',
      '    this.uiSystem.init(this.container);',
      '',
      '    // Initialize tween manager',
      '    this.tweenManager = new TweenManager();',
      '',
      '    // Initialize input and scripts',
      '    this.inputManager = new InputManager(this.container);',
      '    this.scriptRuntime = new ScriptRuntime(this.scene, this.inputManager, this.physics, this.audioSystem, this.uiSystem, this.tweenManager);',
      '    this.scriptRuntime.onLog = (level, msg) => console.log("[" + level + "]", msg);',
      '    this.scriptRuntime.onError = (msg) => console.error(msg);',
      '    this.scriptRuntime.start();',
      '',
      '    // Initialize post-processing (init first, then apply saved settings)',
      '    this.postProcess = new PostProcessManager();',
      '    this.postProcess.init(this.renderer, this.scene.threeScene, this.camera);',
      '    if (sceneData.postProcess) this.postProcess.deserialize(sceneData.postProcess);',
      '',
      '    // Load GLB models',
      '    for (const [, entity] of this.scene.entityMap) {',
      '      if (entity.hasComponent("GLBModel")) {',
      '        const glb = entity.getComponent("GLBModel");',
      '        if (glb.assetId) {',
      '          try { await glb.loadFromAssetManager(this.assetManager); } catch(e) { console.warn("GLB load failed:", e); }',
      '        }',
      '      }',
      '    }',
      '',
      '    document.getElementById("loading").style.display = "none";',
      '',
      '    // Handle window resize',
      '    window.addEventListener("resize", () => {',
      '      const w = this.container.clientWidth;',
      '      const h = this.container.clientHeight;',
      '      this.camera.aspect = w / h;',
      '      this.camera.updateProjectionMatrix();',
      '      this.renderer.setSize(w, h);',
      '      if (this.postProcess) this.postProcess.resize(w, h);',
      '    });',
      '',
      '    this.loop();',
      '  }',
      '',
      '  loop() {',
      '    requestAnimationFrame(() => this.loop());',
      '    const now = performance.now();',
      '    const dt = Math.min((now - this.lastTime) / 1000, 0.05);',
      '    this.lastTime = now;',
      '    if (this.physics && this.physics.initialized) {',
      '      this.physics.step(dt);',
      '    }',
      '    this.scriptRuntime.update(dt);',
      '    // Update particle emitters',
      '    this.scene.entityMap.forEach((entity) => {',
      '      if (entity.hasComponent("ParticleEmitter")) {',
      '        const pe = entity.getComponent("ParticleEmitter");',
      '        if (!pe._initialized) pe.init();',
      '        pe.update(dt);',
      '      }',
      '    });',
      '    // Update animators',
      '    this.scene.entityMap.forEach((entity) => {',
      '      if (entity.hasComponent("Animator")) entity.getComponent("Animator").update(dt);',
      '      if (entity.hasComponent("GLBModel")) entity.getComponent("GLBModel").updateAnimation(dt);',
      '    });',
      '    // Update tweens',
      '    if (this.tweenManager) this.tweenManager.update(dt);',
      '    if (this.postProcess && this.postProcess.enabled) {',
      '      this.postProcess.render();',
      '    } else {',
      '      this.renderer.render(this.scene.threeScene, this.camera);',
      '    }',
      '  }',
      '}',
      '',
      'const runtime = new Runtime();',
      'runtime.start().catch(err => {',
      '  console.error("Runtime start failed:", err);',
      '  document.getElementById("loading").textContent = "Error: " + err.message;',
      '});',
    ].join('\n');

    zip.file('main.js', mainJs);

    // Generate Zip Blob
    const content = await zip.generateAsync({ type: 'blob' });

    // Download
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    const safeName = this.scene.name.replace(/\s+/g, '_');
    a.download = safeName + '_Build.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
