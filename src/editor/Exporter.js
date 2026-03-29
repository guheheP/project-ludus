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
      '    #game-container { width: 100vw; height: 100vh; }',
      '    #loading { position: absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#fff; font-family:sans-serif; }',
      '  </style>',
      '  <script type="importmap">',
      '    {',
      '      "imports": {',
      '        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",',
      '        "@dimforge/rapier3d-compat": "https://unpkg.com/@dimforge/rapier3d-compat@0.12.0/rapier.es.js",',
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
      'src/engine/systems/PhysicsWorld.js',
      'src/engine/systems/AudioSystem.js',
      'src/modeling/ProceduralMesh.js',
      'src/modeling/modifiers/Twist.js',
      'src/modeling/modifiers/Taper.js',
      'src/modeling/modifiers/Noise.js',
      'src/scripting/InputManager.js',
      'src/scripting/ScriptRuntime.js',
      'src/editor/SceneSerializer.js'
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
      'import { SceneSerializer } from "./src/editor/SceneSerializer.js";',
      'import { PhysicsWorld } from "./src/engine/systems/PhysicsWorld.js";',
      'import { AudioSystem } from "./src/engine/systems/AudioSystem.js";',
      'import { InputManager } from "./src/scripting/InputManager.js";',
      'import { ScriptRuntime } from "./src/scripting/ScriptRuntime.js";',
      '',
      'class Runtime {',
      '  constructor() {',
      '    this.container = document.getElementById("game-container");',
      '    this.renderer = new THREE.WebGLRenderer({ antialias: true });',
      '    this.renderer.setSize(window.innerWidth, window.innerHeight);',
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
      '    const res = await fetch("./data/scene.json");',
      '    const sceneData = await res.json();',
      '    this.scene = SceneSerializer.deserialize(sceneData);',
      '    this.physics = new PhysicsWorld();',
      '    await this.physics.init();',
      '    this.inputManager = new InputManager(this.container);',
      '    this.scriptRuntime = new ScriptRuntime(this.scene, this.inputManager, this.physics);',
      '    this.scriptRuntime.start();',
      '    for (const child of this.scene.root.children) {',
      '      this.scene.threeScene.add(child.object3D);',
      '    }',
      '    document.getElementById("loading").style.display = "none";',
      '    this.loop();',
      '  }',
      '',
      '  loop() {',
      '    requestAnimationFrame(() => this.loop());',
      '    const now = performance.now();',
      '    const dt = Math.min((now - this.lastTime) / 1000, 0.1);',
      '    this.lastTime = now;',
      '    this.physics.step();',
      '    this.physics.syncTransforms();',
      '    this.scriptRuntime.update(dt);',
      '    this.renderer.render(this.scene.threeScene, this.camera);',
      '  }',
      '}',
      '',
      'const runtime = new Runtime();',
      'runtime.start();'
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
