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
    /** @type {Function|null} */
    this.onLog = null;
  }

  _log(level, msg) {
    if (this.onLog) this.onLog(level, msg);
    else console.log(`[${level}]`, msg);
  }

  /**
   * Validate the scene before export
   * @returns {{ warnings: string[], errors: string[] }}
   */
  validate() {
    const warnings = [];
    const errors = [];

    this.scene.entityMap.forEach((entity) => {
      // Check for scripts with syntax issues
      if (entity.hasComponent('Script')) {
        const script = entity.getComponent('Script');
        if (script.code) {
          try {
            new Function(script.code);
          } catch (err) {
            errors.push(`Script error in "${entity.name}": ${err.message}`);
          }
        }
        if (!script.code || script.code.trim().length === 0) {
          warnings.push(`"${entity.name}" has an empty script`);
        }
      }

      // Check for GLB models without asset reference
      if (entity.hasComponent('GLBModel')) {
        const glb = entity.getComponent('GLBModel');
        if (!glb.assetId) {
          warnings.push(`"${entity.name}" has GLBModel but no asset assigned`);
        }
      }

      // Check for ProceduralMesh with missing texture references
      if (entity.hasComponent('ProceduralMesh')) {
        const pm = entity.getComponent('ProceduralMesh');
        const textureIds = [pm.diffuseMapId, pm.normalMapId, pm.roughnessMapId, pm.metalnessMapId, pm.emissiveMapId];
        for (const id of textureIds) {
          if (id && !this.assetManager.assets.find(a => a.id === id)) {
            warnings.push(`"${entity.name}" references missing texture asset: ${id}`);
          }
        }
      }

      // Check for AudioSource without asset
      if (entity.hasComponent('AudioSource')) {
        const as = entity.getComponent('AudioSource');
        if (!as.assetId) {
          warnings.push(`"${entity.name}" has AudioSource but no audio asset`);
        }
      }
    });

    return { warnings, errors };
  }

  async exportZip() {
    // 0. Pre-export validation
    this._log('info', '🔍 Running pre-export validation...');
    const { warnings, errors } = this.validate();
    
    for (const w of warnings) {
      this._log('warn', `⚠ ${w}`);
    }
    for (const e of errors) {
      this._log('error', `❌ ${e}`);
    }

    if (errors.length > 0) {
      const proceed = confirm(
        `${errors.length} error(s) found during validation.\n\n` +
        errors.join('\n') + '\n\n' +
        'Export anyway?'
      );
      if (!proceed) {
        this._log('info', 'Export cancelled by user.');
        return;
      }
    }

    this._log('info', '📦 Starting export...');
    const zip = new JSZip();

    // 1. Serialize Scene
    this._log('info', '  Serializing scene...');
    const sceneData = SceneSerializer.serialize(this.scene);
    zip.file('data/scene.json', JSON.stringify(sceneData, null, 2));

    // 2. Export Assets
    const assetCount = this.assetManager.assets.length;
    this._log('info', `  Packing ${assetCount} asset(s)...`);
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
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '  <title>' + this.scene.name + '</title>',
      '  <style>',
      '    * { margin: 0; padding: 0; box-sizing: border-box; }',
      '    body { overflow: hidden; background: #000; }',
      '    #game-container { width: 100vw; height: 100vh; position: relative; }',
      '    #loading { position: absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#fff; font-family:sans-serif; font-size:18px; }',
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

    // 4. Fetch Engine Files
    this._log('info', '  Fetching engine files...');
    const engineFiles = [
      'src/engine/Component.js',
      'src/engine/Entity.js',
      'src/engine/Scene.js',
      'src/engine/AssetManager.js',
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
      'src/engine/components/AnimationClip.js',
      'src/engine/components/AnimationPlayer.js',
      'src/engine/components/InstancedMeshRenderer.js',
      'src/engine/components/Camera.js',
      'src/engine/systems/PhysicsWorld.js',
      'src/engine/systems/AudioSystem.js',
      'src/engine/systems/UISystem.js',
      'src/engine/systems/TweenManager.js',
      'src/engine/systems/PostProcessManager.js',
      'src/engine/systems/EnvironmentSystem.js',
      'src/modeling/Modifier.js',
      'src/modeling/ProceduralMesh.js',
      'src/modeling/EditableMesh.js',
      'src/modeling/modifiers/Twist.js',
      'src/modeling/modifiers/Bend.js',
      'src/modeling/modifiers/Taper.js',
      'src/modeling/modifiers/Noise.js',
      'src/modeling/modifiers/Subdivide.js',
      'src/scripting/InputManager.js',
      'src/scripting/ScriptRuntime.js',
      'src/editor/SceneSerializer.js',
    ];

    let fetchedCount = 0;
    for (const filePath of engineFiles) {
      try {
        const res = await fetch('/' + filePath);
        if (res.ok) {
          const text = await res.text();
          zip.file(filePath, text);
          fetchedCount++;
        } else {
          this._log('warn', `  Missing engine file: ${filePath}`);
        }
      } catch (err) {
        this._log('warn', `  Network error: ${filePath}`);
      }
    }
    this._log('info', `  ${fetchedCount}/${engineFiles.length} engine files packed`);

    // 5. Generate Runtime main.js
    this._log('info', '  Generating runtime...');
    const mainJs = this._generateRuntimeScript();
    zip.file('main.js', mainJs);

    // 6. Generate Zip Blob with size report
    this._log('info', '  Compressing ZIP...');
    const content = await zip.generateAsync({ type: 'blob' });
    
    // Size report
    const sizeMB = (content.size / (1024 * 1024)).toFixed(2);
    const sizeKB = (content.size / 1024).toFixed(0);
    this._log('info', `📊 Build size: ${sizeMB} MB (${sizeKB} KB)`);

    if (warnings.length > 0) {
      this._log('warn', `⚠ Export completed with ${warnings.length} warning(s)`);
    }

    // Download
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    const safeName = this.scene.name.replace(/\s+/g, '_');
    a.download = safeName + '_Build.zip';
    a.click();
    URL.revokeObjectURL(a.href);
    
    this._log('info', `✅ Export complete: ${safeName}_Build.zip`);
  }

  /**
   * Generate the runtime main.js script content
   * @returns {string}
   */
  _generateRuntimeScript() {
    return [
      'import * as THREE from "three";',
      'import { Scene } from "./src/engine/Scene.js";',
      'import { SceneSerializer } from "./src/editor/SceneSerializer.js";',
      'import { PhysicsWorld } from "./src/engine/systems/PhysicsWorld.js";',
      'import { AudioSystem } from "./src/engine/systems/AudioSystem.js";',
      'import { UISystem } from "./src/engine/systems/UISystem.js";',
      'import { TweenManager } from "./src/engine/systems/TweenManager.js";',
      'import { PostProcessManager } from "./src/engine/systems/PostProcessManager.js";',
      'import { EnvironmentSystem } from "./src/engine/systems/EnvironmentSystem.js";',
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
      '      const cam = this.scriptRuntime?.activeCamera || this.camera;',
      '      if (cam.isPerspectiveCamera) {',
      '        cam.aspect = window.innerWidth / window.innerHeight;',
      '        cam.updateProjectionMatrix();',
      '      }',
      '      this.renderer.setSize(window.innerWidth, window.innerHeight);',
      '      if (this.postProcess) this.postProcess.resize(window.innerWidth, window.innerHeight);',
      '    });',
      '  }',
      '',
      '  async start() {',
      '    const res = await fetch("./data/scene.json");',
      '    const sceneData = await res.json();',
      '    this.scene = new Scene(sceneData.name || "Game");',
      '    SceneSerializer.deserialize(sceneData, this.scene);',
      '',
      '    this.physics = new PhysicsWorld();',
      '    await this.physics.init();',
      '    this.scene.entityMap.forEach((entity) => {',
      '      if (entity.hasComponent("RigidBody") && entity.hasComponent("Collider")) {',
      '        this.physics.addBody(entity);',
      '      }',
      '    });',
      '',
      '    this.assetManager = new AssetManager();',
      '    await this.assetManager.init();',
      '    this.audioSystem = new AudioSystem(this.scene, this.assetManager);',
      '    await this.audioSystem.init();',
      '',
      '    this.uiSystem = new UISystem();',
      '    this.uiSystem.init(this.container);',
      '    this.tweenManager = new TweenManager();',
      '',
      '    this.inputManager = new InputManager(this.container);',
      '    this.scriptRuntime = new ScriptRuntime(this.scene, this.inputManager, this.physics, this.audioSystem, this.uiSystem, this.tweenManager);',
      '    this.scriptRuntime.onLog = (level, msg) => console.log("[" + level + "]", msg);',
      '    this.scriptRuntime.onError = (msg) => console.error(msg);',
      '    this.scriptRuntime.start();',
      '',
      '    this.postProcess = new PostProcessManager();',
      '    const ppCamera = this.scriptRuntime.activeCamera || this.camera;',
      '    this.postProcess.init(this.renderer, this.scene.threeScene, ppCamera);',
      '    if (sceneData.postProcess) this.postProcess.deserialize(sceneData.postProcess);',
      '',
      '    this.environment = new EnvironmentSystem(this.scene.threeScene);',
      '    if (sceneData.environment) this.environment.deserialize(sceneData.environment);',
      '    else this.environment.apply();',
      '',
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
      '    this.loop();',
      '  }',
      '',
      '  loop() {',
      '    requestAnimationFrame(() => this.loop());',
      '    const now = performance.now();',
      '    const dt = Math.min((now - this.lastTime) / 1000, 0.05);',
      '    this.lastTime = now;',
      '    if (this.physics && this.physics.initialized) this.physics.step(dt);',
      '    this.scriptRuntime.update(dt);',
      '    this.scene.entityMap.forEach((entity) => {',
      '      if (entity.hasComponent("ParticleEmitter")) {',
      '        const pe = entity.getComponent("ParticleEmitter");',
      '        if (!pe._initialized) pe.init();',
      '        pe.update(dt);',
      '      }',
      '    });',
      '    this.scene.entityMap.forEach((entity) => {',
      '      if (entity.hasComponent("Animator")) entity.getComponent("Animator").update(dt);',
      '      if (entity.hasComponent("AnimationPlayer")) {',
      '        const ap = entity.getComponent("AnimationPlayer");',
      '        if (ap.autoPlay && !ap.playing && !ap._initialState) ap.play();',
      '        ap.update(dt);',
      '      }',
      '      if (entity.hasComponent("GLBModel")) entity.getComponent("GLBModel").updateAnimation(dt);',
      '    });',
      '    if (this.tweenManager) this.tweenManager.update(dt);',
      '    const activeCam = this.scriptRuntime.activeCamera || this.camera;',
      '    if (activeCam.isPerspectiveCamera) {',
      '      activeCam.aspect = this.container.clientWidth / this.container.clientHeight;',
      '      activeCam.updateProjectionMatrix();',
      '    }',
      '    if (this.postProcess && this.postProcess.enabled) {',
      '      if (this.postProcess._camera !== activeCam && this.postProcess.updateSceneCamera) {',
      '        this.postProcess.updateSceneCamera(this.scene.threeScene, activeCam);',
      '      }',
      '      this.postProcess.render();',
      '    } else {',
      '      this.renderer.render(this.scene.threeScene, activeCam);',
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
  }

  /**
   * Open an in-browser preview of the game in a new tab (Phase 18-2)
   * Generates a self-contained HTML blob and opens it
   */
  async preview() {
    this._log('info', '🔍 Running pre-preview validation...');
    const { warnings, errors } = this.validate();
    for (const w of warnings) this._log('warn', `⚠ ${w}`);
    for (const e of errors) this._log('error', `❌ ${e}`);

    if (errors.length > 0) {
      const proceed = confirm(
        `${errors.length} error(s) found.\n\n` +
        errors.join('\n') + '\n\nPreview anyway?'
      );
      if (!proceed) { this._log('info', 'Preview cancelled.'); return; }
    }

    this._log('info', '🚀 Generating preview...');

    // Serialize scene
    const sceneData = SceneSerializer.serialize(this.scene);

    // Collect assets as base64
    const assetsMap = {};
    for (const asset of this.assetManager.assets) {
      const blob = await this.assetManager.getAssetBlob(asset.id);
      if (blob) {
        const reader = new FileReader();
        const base64 = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        assetsMap[asset.id + '_' + asset.name] = base64;
      }
    }

    // Generate runtime HTML
    const runtimeJS = this._generateRuntimeScript();

    // Build self-contained HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.scene.name} — Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #000; }
    #game-container { width: 100vw; height: 100vh; position: relative; }
    #loading { position: absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#fff; font-family:sans-serif; font-size:18px; }
    #preview-bar {
      position: fixed; top: 0; left: 0; right: 0; height: 28px; z-index: 10000;
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 12px; font-family: sans-serif; font-size: 12px; color: #fff;
    }
    #preview-bar button { background: rgba(255,255,255,0.2); border: none; color: #fff; padding: 2px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; }
    #preview-bar button:hover { background: rgba(255,255,255,0.3); }
    #game-container { margin-top: 28px; height: calc(100vh - 28px); }
  </style>
</head>
<body>
  <div id="preview-bar">
    <span>🎮 ${this.scene.name} — Preview Mode</span>
    <div>
      <button onclick="location.reload()">↻ Restart</button>
      <button onclick="window.close()">✕ Close</button>
    </div>
  </div>
  <div id="game-container">
    <div id="loading">Loading...</div>
  </div>
  <script>
    window.__SCENE_DATA__ = ${JSON.stringify(sceneData)};
    window.__ASSETS_MAP__ = ${JSON.stringify(assetsMap)};
  </script>
  <script type="module">
${runtimeJS}
  </script>
</body>
</html>`;

    // Create blob and open
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const newTab = window.open(url, '_blank');
    if (newTab) {
      this._log('info', '✅ Preview opened in new tab');
      // Clean up blob after a delay
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      this._log('error', 'Popup blocked! Please allow popups for this site.');
    }
  }
}
