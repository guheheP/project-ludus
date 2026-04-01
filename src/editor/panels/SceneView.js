import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { PostProcessManager } from '../../engine/systems/PostProcessManager.js';

/**
 * SceneView — 3D Viewport with camera controls and transform gizmo
 */
export class SceneView {
  /** @type {THREE.WebGLRenderer} */
  renderer;

  /** @type {THREE.PerspectiveCamera} */
  camera;

  /** @type {THREE.Camera|null} Override camera used during Play mode */
  _gameCamera = null;

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
  /** @type {Function|null} Called when transform changes (during drag) */
  onTransformChange = null;

  /** @type {Function|null} Called when gizmo drag starts */
  onTransformStart = null;

  /** @type {Function|null} Called when gizmo drag ends */
  onTransformEnd = null;

  /** @type {boolean} */
  snapEnabled = false;

  /** @type {number} */
  snapTranslate = 1;

  /** @type {number} */
  snapRotate = 15;

  /** @type {number} */
  snapScale = 0.25;

  /** @type {boolean} */
  vertexEditMode = false;

  /** @type {import('../../engine/Entity.js').Entity|null} */
  _selectedEntity = null;

  /** @type {THREE.Points|null} */
  _vertexPoints = null;

  /** @type {THREE.Object3D} */
  _vertexDummy = new THREE.Object3D();

  /** @type {number[]} */
  _selectedVertexIndices = [];

  /** @type {Array<THREE.Vector3>|null} */
  _vertexDragStarts = null;

  /** @type {Map<number, {startPos: THREE.Vector3, scaleX: number, scaleY: number, scaleZ: number}>} */
  _vertexDragMap = null;

  /** @type {THREE.Vector3|null} */
  _dummyDragStart = null;

  /** @type {{x:boolean, y:boolean, z:boolean}} */
  symmetry = { x: false, y: false, z: false };

  /** @type {PostProcessManager} */
  postProcess;

  constructor(container) {
    this.container = container;
    this.raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();

    this._initRenderer();
    this._initCamera();
    this._initControls();
    this._initGrid();
    this._initLighting();
    this._initPostProcess();
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

    // Collect all gizmo materials to soften hover highlights each frame
    this._gizmoMaterials = [];
    this.transformControls.getHelper().traverse((child) => {
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) {
          m.toneMapped = false;
          if (!this._gizmoMaterials.includes(m)) this._gizmoMaterials.push(m);
        }
      }
    });

    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.orbitControls.enabled = !event.value;
      
      // Record starting positions for vertex drag
      if (event.value && this.vertexEditMode && this._selectedVertexIndices.length > 0 && this._selectedEntity) {
        const em = this._selectedEntity.getComponent('EditableMesh');
        if (em && em.mesh) {
          this._vertexDragMap = new Map();
          
          for (const uIdx of this._selectedVertexIndices) {
            const pos = new THREE.Vector3(
              em.uniquePositions[uIdx * 3],
              em.uniquePositions[uIdx * 3 + 1],
              em.uniquePositions[uIdx * 3 + 2]
            );
            
            // Add primary vertex
            if (!this._vertexDragMap.has(uIdx)) {
              this._vertexDragMap.set(uIdx, { startPos: pos.clone(), scaleX: 1, scaleY: 1, scaleZ: 1 });
            }
            
            // Add symmetrical vertices if toggled
            if (this.symmetry.x || this.symmetry.y || this.symmetry.z) {
              const syms = em.getSymmetricalUniqueIndices(uIdx, this.symmetry);
              for (const sym of syms) {
                if (!this._vertexDragMap.has(sym.index)) {
                  const symPos = new THREE.Vector3(
                    em.uniquePositions[sym.index * 3],
                    em.uniquePositions[sym.index * 3 + 1],
                    em.uniquePositions[sym.index * 3 + 2]
                  );
                  this._vertexDragMap.set(sym.index, { 
                    startPos: symPos, 
                    scaleX: sym.scaleX, scaleY: sym.scaleY, scaleZ: sym.scaleZ 
                  });
                }
              }
            }
          }
          this._dummyDragStart = this._vertexDummy.position.clone();
        }
      } else if (event.value && this.onTransformStart && this._selectedEntity && this.transformControls.object === this._selectedEntity.object3D) {
        // Normal entity transform start — capture state for undo
        this.onTransformStart(this._selectedEntity);
      }
      
      // Handle transform end for normal entities & vertices
      if (!event.value) {
        if (this.vertexEditMode) {
           if (this.onVertexTransformEnd && this._selectedEntity && this._selectedVertexIndices.length > 0 && this._vertexDragMap) {
             const em = this._selectedEntity.getComponent('EditableMesh');
             if (em) {
               const affectedIndices = Array.from(this._vertexDragMap.keys());
               const starts = [];
               const ends = [];
               let changed = false;
               
               for (const uIdx of affectedIndices) {
                 const start = this._vertexDragMap.get(uIdx).startPos;
                 starts.push(start);
                 
                 const end = new THREE.Vector3(
                   em.uniquePositions[uIdx * 3],
                   em.uniquePositions[uIdx * 3 + 1],
                   em.uniquePositions[uIdx * 3 + 2]
                 );
                 ends.push(end);
                 
                 if (!changed && end.distanceToSquared(start) > 0.0001) {
                   changed = true;
                 }
               }
               
               if(changed) {
                 this.onVertexTransformEnd(this._selectedEntity, affectedIndices, starts, ends);
               }
             }
           }
           this._vertexDragMap = null;
           this._dummyDragStart = null;
        } else if (this.onTransformEnd && this._selectedEntity && this.transformControls.object === this._selectedEntity.object3D) {
          this.onTransformEnd(this._selectedEntity);
        }
      }
    });

    this.transformControls.addEventListener('objectChange', () => {
      if (this.onTransformChange) {
        if (this.vertexEditMode && this._selectedVertexIndices.length > 0 && this._selectedEntity && this._vertexDragMap && this._dummyDragStart) {
          const em = this._selectedEntity.getComponent('EditableMesh');
          if (em && em.mesh) {
            // Calculate dummy movement in local space
            const dummyStartLocal = this._dummyDragStart.clone();
            em.mesh.worldToLocal(dummyStartLocal);
            const dummyEndLocal = this._vertexDummy.position.clone();
            em.mesh.worldToLocal(dummyEndLocal);
            const localDelta = dummyEndLocal.clone().sub(dummyStartLocal);
            
            // Apply transformed deltas to all participating vertices
            window.requestAnimationFrame(() => {
              for (const [uIdx, data] of this._vertexDragMap.entries()) {
                const mirroredLocalDelta = localDelta.clone();
                mirroredLocalDelta.x *= data.scaleX;
                mirroredLocalDelta.y *= data.scaleY;
                mirroredLocalDelta.z *= data.scaleZ;
                
                const newLocalPos = data.startPos.clone().add(mirroredLocalDelta);
                em.setUniqueVertexPosition(uIdx, newLocalPos.x, newLocalPos.y, newLocalPos.z);
              }
              this._updateVertexPoints();
            });
          }
        }
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
    scene.threeScene.add(this._vertexDummy);

    // Initialize post-processing with the scene
    this._setupPostProcess();
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
    this._selectedEntity = entity;
    
    if (this.vertexEditMode) {
      if (entity && entity.hasComponent('EditableMesh')) {
        this._selectedVertexIndices = [];
        this._updateVertexPoints();
        this.transformControls.detach();
      } else if (entity && entity.hasComponent('ProceduralMesh') && !entity.hasComponent('EditableMesh')) {
        // Hint: user needs to convert to EditableMesh first
        this._removeVertexPoints();
        this.transformControls.detach();
        this._showVertexEditHint();
      } else {
        this._removeVertexPoints();
        this.transformControls.detach();
      }
    } else {
      this._removeVertexPoints();
      if (entity && entity.object3D) {
        this.transformControls.attach(entity.object3D);
      } else {
        this.transformControls.detach();
      }
    }
  }

  setVertexEditMode(enabled) {
    this.vertexEditMode = enabled;
    this.selectEntity(this._selectedEntity);
  }

  setSymmetry(axis, enabled) {
    if (this.symmetry[axis] !== undefined) {
      this.symmetry[axis] = enabled;
    }
  }

  _updateVertexPoints() {
    this._removeVertexPoints();
    if (!this._selectedEntity) return;
    const em = this._selectedEntity.getComponent('EditableMesh');
    if (!em || !em.mesh || em.uniquePositions.length === 0) return;

    // Create a geometry purely for rendering the unique vertices
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(em.uniquePositions), 3));
    
    // Set colors for selection
    const colors = new Float32Array(em.uniquePositions.length);
    for (let i = 0; i < em.uniquePositions.length / 3; i++) {
      if (this._selectedVertexIndices.includes(i)) {
        colors[i*3] = 1; colors[i*3+1] = 1; colors[i*3+2] = 0; // Yellow (selected)
      } else {
        colors[i*3] = 1; colors[i*3+1] = 0; colors[i*3+2] = 0; // Red (unselected)
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.2,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
      vertexColors: true
    });
    
    this._vertexPoints = new THREE.Points(geometry, material);
    this._vertexPoints.renderOrder = 999;
    
    // Directly add as a child to the mesh so local coordinate space binds properly and avoids offset bugs
    em.mesh.add(this._vertexPoints);
  }

  _removeVertexPoints() {
    if (this._vertexPoints) {
      if (this._vertexPoints.parent) {
        this._vertexPoints.parent.remove(this._vertexPoints);
      }
      this._vertexPoints.geometry.dispose(); // We created this one manually, so dispose it
      this._vertexPoints.material.dispose();
      this._vertexPoints = null;
    }
  }

  _updateVertexDummyPos() {
    if (this._selectedVertexIndices.length === 0) {
      this.transformControls.detach();
      return;
    }
    
    const em = this._selectedEntity.getComponent('EditableMesh');
    const centroid = new THREE.Vector3();
    
    for (const uIdx of this._selectedVertexIndices) {
      const pos = new THREE.Vector3(
        em.uniquePositions[uIdx * 3],
        em.uniquePositions[uIdx * 3 + 1],
        em.uniquePositions[uIdx * 3 + 2]
      );
      pos.applyMatrix4(em.mesh.matrixWorld);
      centroid.add(pos);
    }
    centroid.divideScalar(this._selectedVertexIndices.length);
    
    this._vertexDummy.position.copy(centroid);
    this._vertexDummy.rotation.copy(em.mesh.rotation);
    this.transformControls.attach(this._vertexDummy);
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

    if (this.vertexEditMode && this._vertexPoints && this._selectedEntity) {
      this.raycaster.params.Points.threshold = 0.5;
      const intersects = this.raycaster.intersectObject(this._vertexPoints, false);
      if (intersects.length > 0) {
        const hitIdx = intersects[0].index;
        
        if (event.shiftKey) {
          const arrIdx = this._selectedVertexIndices.indexOf(hitIdx);
          if (arrIdx === -1) {
            this._selectedVertexIndices.push(hitIdx); // Add
          } else {
            this._selectedVertexIndices.splice(arrIdx, 1); // Remove
          }
        } else {
          this._selectedVertexIndices = [hitIdx]; // Replace
        }
      } else if (!event.shiftKey) {
        this._selectedVertexIndices = []; // Clear
      }
      
      this._updateVertexPoints(); // Re-render colors
      this._updateVertexDummyPos(); // Move gizmo to centroid
      return;
    }

    // Get all meshes in scene
    const meshes = [];
    this.scene.threeScene.traverse((obj) => {
      if (obj.isMesh && obj.userData.entityId !== undefined) {
        meshes.push(obj);
      }
    });

    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      // Find first non-locked entity
      let hitEntity = null;
      for (const hit of intersects) {
        const entityId = hit.object.userData.entityId;
        // Skip locked entities (check via lockedIds callback)
        if (this._isEntityLocked && this._isEntityLocked(entityId)) continue;
        hitEntity = this.scene.getEntityById(entityId);
        if (hitEntity) break;
      }
      if (hitEntity && this.onSelectEntity) {
        this.onSelectEntity(hitEntity);
      } else if (!hitEntity && this.onSelectEntity) {
        this.onSelectEntity(null);
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
    if (this.postProcess) {
      this.postProcess.resize(rect.width, rect.height);
    }
  }

  /**
   * Get the camera currently used for rendering.
   * Returns the game camera during Play, or the editor camera otherwise.
   * @returns {THREE.Camera}
   */
  get _activeCamera() {
    return this._gameCamera || this.camera;
  }

  /**
   * Render one frame.
   * Uses a 2-pass approach to prevent Bloom from making the gizmo glow:
   *  Pass 1: main scene with post-processing (gizmo hidden)
   *  Pass 2: gizmo only, rendered on top without post-processing
   */
  render() {
    if (!this.scene) return;
    // Only update orbit controls when NOT using a game camera
    // (prevents editor camera drift during Play mode)
    if (!this._gameCamera) {
      this.orbitControls.update();
    }

    const cam = this._activeCamera;
    const gizmoHelper = this.transformControls.getHelper();

    // If using game camera, sync its aspect ratio
    if (this._gameCamera) {
      const rect = this.container.getBoundingClientRect();
      if (this._gameCamera.isPerspectiveCamera) {
        this._gameCamera.aspect = rect.width / rect.height;
        this._gameCamera.updateProjectionMatrix();
      }
    }

    if (this.postProcess && this.postProcess.enabled) {
      // Update post-process camera reference when game camera switches
      if (this._gameCamera) {
        this.postProcess.updateSceneCamera(this.scene.threeScene, cam);
      }

      // Pass 1: render scene WITH post-processing, gizmo hidden
      gizmoHelper.visible = false;
      this.postProcess.render();

      // Pass 2: render ONLY the gizmo on top (no Bloom / no post-processing)
      // Hide everything except the gizmo
      const hiddenChildren = [];
      for (const child of this.scene.threeScene.children) {
        if (child !== gizmoHelper && child.visible) {
          child.visible = false;
          hiddenChildren.push(child);
        }
      }
      gizmoHelper.visible = true;

      // Must null the background so it doesn't overwrite the post-processed image,
      // and clear depth so the gizmo isn't occluded by the OutputPass quad.
      const savedBg = this.scene.threeScene.background;
      this.scene.threeScene.background = null;
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.scene.threeScene, cam);
      this.renderer.autoClear = true;
      this.scene.threeScene.background = savedBg;

      // Restore visibility
      for (const child of hiddenChildren) {
        child.visible = true;
      }
    } else {
      this.renderer.render(this.scene.threeScene, cam);
    }
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

  /**
   * Show a temporary hint toast in the viewport
   */
  _showVertexEditHint() {
    // Remove existing hint if any
    if (this._hintToast) {
      this._hintToast.remove();
      this._hintToast = null;
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
      position: absolute; bottom: 60px; left: 50%; transform: translateX(-50%);
      background: rgba(100, 80, 255, 0.9); color: #fff; padding: 8px 16px;
      border-radius: 6px; font-size: 12px; font-weight: 600;
      z-index: 1000; pointer-events: none;
      animation: fadeInUp 0.3s ease;
    `;
    toast.textContent = '💡 Use "Convert to Editable Mesh" in Inspector first';
    this.container.style.position = 'relative';
    this.container.appendChild(toast);
    this._hintToast = toast;

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => toast.remove(), 500);
      }
      if (this._hintToast === toast) this._hintToast = null;
    }, 3000);
  }

  dispose() {
    this._resizeObserver.disconnect();
    this.orbitControls.dispose();
    this.transformControls.dispose();
    if (this.postProcess) this.postProcess.dispose();
    this.renderer.dispose();
  }

  /**
   * Initialize post-processing pipeline
   */
  _initPostProcess() {
    this.postProcess = new PostProcessManager();
    // Will be fully initialized when scene is set
  }

  /**
   * Initialize post-processing with current scene
   */
  _setupPostProcess() {
    if (!this.scene || !this.postProcess) return;
    this.postProcess.init(this.renderer, this.scene.threeScene, this.camera);
  }
}
