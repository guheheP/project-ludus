import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

/**
 * SceneView — 3D Viewport with camera controls and transform gizmo
 */
export class SceneView {
  /** @type {THREE.WebGLRenderer} */
  renderer;

  /** @type {THREE.PerspectiveCamera} */
  camera;

  /** @type {OrbitControls} */
  orbitControls;

  /** @type {TransformControls} */
  transformControls;

  /** @type {HTMLElement} */
  container;

  /** @type {THREE.GridHelper} */
  gridHelper;

  /** @type {import('../engine/Scene.js').Scene} */
  scene;

  /** @type {THREE.Raycaster} */
  raycaster;

  /** @type {string} */
  transformMode = 'translate';

  /** @type {Function|null} */
  onSelectEntity = null;

  /** @type {Function|null} */
  onTransformChange = null;

  /** @type {boolean} */
  snapEnabled = false;

  /** @type {number} */
  snapTranslate = 1;

  /** @type {number} */
  snapRotate = 15;

  /** @type {number} */
  snapScale = 0.25;

  constructor(container) {
    this.container = container;
    this.raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();

    this._initRenderer();
    this._initCamera();
    this._initControls();
    this._initGrid();
    this._initLighting();
    this._bindEvents();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);
  }

  _initCamera() {
    const rect = this.container.getBoundingClientRect();
    this.camera = new THREE.PerspectiveCamera(
      50, rect.width / rect.height, 0.1, 1000
    );
    this.camera.position.set(8, 6, 8);
    this.camera.lookAt(0, 0, 0);
  }

  _initControls() {
    // Orbit controls
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.minDistance = 1;
    this.orbitControls.maxDistance = 100;
    this.orbitControls.target.set(0, 0, 0);

    // Transform controls (gizmo)
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.setSize(0.8);

    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.orbitControls.enabled = !event.value;
    });

    this.transformControls.addEventListener('objectChange', () => {
      if (this.onTransformChange) {
        this.onTransformChange();
      }
    });
  }

  _initGrid() {
    // Main grid
    this.gridHelper = new THREE.GridHelper(40, 40, 0x3a3a60, 0x252550);
    this.gridHelper.material.opacity = 0.6;
    this.gridHelper.material.transparent = true;

    // Axis helper at origin
    const axisHelper = new THREE.AxesHelper(1);
    axisHelper.position.set(0, 0.001, 0);
    this.gridHelper.add(axisHelper);
  }

  _initLighting() {
    // Editor-only ambient light (always visible in editor)
    this._editorAmbient = new THREE.AmbientLight(0x404060, 0.4);
    this._editorHemi = new THREE.HemisphereLight(0x8888cc, 0x443333, 0.3);
  }

  /**
   * Set the scene to render
   * @param {import('../engine/Scene.js').Scene} scene
   */
  setScene(scene) {
    this.scene = scene;
    scene.threeScene.add(this.gridHelper);
    scene.threeScene.add(this.transformControls.getHelper());
    scene.threeScene.add(this._editorAmbient);
    scene.threeScene.add(this._editorHemi);
  }

  /**
   * Set transform mode
   * @param {'translate'|'rotate'|'scale'} mode
   */
  setTransformMode(mode) {
    this.transformMode = mode;
    this.transformControls.setMode(mode);
  }

  /**
   * Attach gizmo to an entity's object3D
   * @param {import('../engine/Entity.js').Entity|null} entity
   */
  selectEntity(entity) {
    if (entity && entity.object3D) {
      this.transformControls.attach(entity.object3D);
    } else {
      this.transformControls.detach();
    }
  }

  /**
   * Toggle snapping
   * @param {boolean} enabled
   */
  setSnap(enabled) {
    this.snapEnabled = enabled;
    this._applySnap();
  }

  _applySnap() {
    if (this.snapEnabled) {
      this.transformControls.setTranslationSnap(this.snapTranslate);
      this.transformControls.setRotationSnap(THREE.MathUtils.degToRad(this.snapRotate));
      this.transformControls.setScaleSnap(this.snapScale);
    } else {
      this.transformControls.setTranslationSnap(null);
      this.transformControls.setRotationSnap(null);
      this.transformControls.setScaleSnap(null);
    }
  }

  _bindEvents() {
    // Click to select
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return; // Left click only
      // Don't select if interacting with gizmo
      if (this.transformControls.dragging) return;

      this._pendingSelect = { x: e.clientX, y: e.clientY };
    });

    this.renderer.domElement.addEventListener('pointerup', (e) => {
      if (!this._pendingSelect) return;
      const dx = e.clientX - this._pendingSelect.x;
      const dy = e.clientY - this._pendingSelect.y;
      // Only select on click (not drag)
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        this._handleClick(e);
      }
      this._pendingSelect = null;
    });

    // Resize
    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(this.container);
  }

  _handleClick(event) {
    if (!this.scene) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this._mouse, this.camera);

    // Get all meshes in scene
    const meshes = [];
    this.scene.threeScene.traverse((obj) => {
      if (obj.isMesh && obj.userData.entityId !== undefined) {
        meshes.push(obj);
      }
    });

    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const entityId = intersects[0].object.userData.entityId;
      const entity = this.scene.getEntityById(entityId);
      if (entity && this.onSelectEntity) {
        this.onSelectEntity(entity);
      }
    } else {
      if (this.onSelectEntity) {
        this.onSelectEntity(null);
      }
    }
  }

  /**
   * Resize renderer to container size
   */
  resize() {
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height);
  }

  /**
   * Render one frame
   */
  render() {
    if (!this.scene) return;
    this.orbitControls.update();
    this.renderer.render(this.scene.threeScene, this.camera);
  }

  /**
   * Focus camera on entity
   * @param {import('../engine/Entity.js').Entity} entity
   */
  focusOn(entity) {
    if (!entity) return;

    const pos = new THREE.Vector3();
    entity.object3D.getWorldPosition(pos);

    // Animate orbit target to entity position
    const target = this.orbitControls.target;
    const startTarget = target.clone();
    const startTime = performance.now();
    const duration = 300;

    const animate = () => {
      const t = Math.min((performance.now() - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      target.lerpVectors(startTarget, pos, ease);
      if (t < 1) requestAnimationFrame(animate);
    };
    animate();
  }

  dispose() {
    this._resizeObserver.disconnect();
    this.orbitControls.dispose();
    this.transformControls.dispose();
    this.renderer.dispose();
  }
}
