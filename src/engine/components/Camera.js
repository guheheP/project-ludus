import * as THREE from 'three';
import { Component } from '../Component.js';

/**
 * Camera — Defines a game camera that is used during Play mode and in exported games.
 * Attach to an entity to use as the active camera.  The Transform component
 * on the same entity controls the camera's position/rotation in the scene.
 */
export class Camera extends Component {
  static typeName = 'Camera';

  /** @type {'perspective'|'orthographic'} */
  projection = 'perspective';

  /** @type {number} Field of view in degrees (perspective only) */
  fov = 60;

  /** @type {number} Near clipping plane */
  near = 0.1;

  /** @type {number} Far clipping plane */
  far = 1000;

  /** @type {number} Orthographic size (half-height of the view, ortho only) */
  orthoSize = 5;

  /** @type {boolean} Whether this is the primary camera in the scene */
  primary = true;

  /** @type {THREE.PerspectiveCamera|THREE.OrthographicCamera|null} */
  _threeCamera = null;

  /** @type {THREE.CameraHelper|null} Editor-only wireframe visualisation */
  _helper = null;

  onAttach() {
    this._createCamera();
  }

  onDetach() {
    this._disposeHelper();
    this._threeCamera = null;
  }

  /**
   * Create or recreate the Three.js camera object
   */
  _createCamera() {
    if (this.projection === 'perspective') {
      this._threeCamera = new THREE.PerspectiveCamera(this.fov, 16 / 9, this.near, this.far);
    } else {
      const aspect = 16 / 9;
      this._threeCamera = new THREE.OrthographicCamera(
        -this.orthoSize * aspect, this.orthoSize * aspect,
        this.orthoSize, -this.orthoSize,
        this.near, this.far
      );
    }
  }

  /**
   * Get the Three.js camera, synced to entity transform
   * @param {number} [aspect] — override aspect ratio 
   * @returns {THREE.Camera}
   */
  getCamera(aspect) {
    if (!this._threeCamera) this._createCamera();

    if (this.projection === 'perspective') {
      /** @type {THREE.PerspectiveCamera} */
      const cam = this._threeCamera;
      cam.fov = this.fov;
      cam.near = this.near;
      cam.far = this.far;
      if (aspect !== undefined) cam.aspect = aspect;
      cam.updateProjectionMatrix();
    } else {
      /** @type {THREE.OrthographicCamera} */
      const cam = this._threeCamera;
      const a = aspect !== undefined ? aspect : 16 / 9;
      cam.left = -this.orthoSize * a;
      cam.right = this.orthoSize * a;
      cam.top = this.orthoSize;
      cam.bottom = -this.orthoSize;
      cam.near = this.near;
      cam.far = this.far;
      cam.updateProjectionMatrix();
    }

    // Sync camera world transform from entity
    if (this.entity && this.entity.object3D) {
      this.entity.object3D.updateWorldMatrix(true, false);
      this._threeCamera.position.setFromMatrixPosition(this.entity.object3D.matrixWorld);
      this._threeCamera.quaternion.setFromRotationMatrix(this.entity.object3D.matrixWorld);
    }

    return this._threeCamera;
  }

  /**
   * Show/hide the camera frustum helper (editor only)
   * @param {THREE.Scene} threeScene 
   * @param {boolean} visible 
   */
  showHelper(threeScene, visible) {
    if (visible) {
      if (!this._helper) {
        this.getCamera(); // ensure camera exists
        this._helper = new THREE.CameraHelper(this._threeCamera);
        threeScene.add(this._helper);
      }
      this._helper.update();
    } else {
      this._disposeHelper();
    }
  }

  _disposeHelper() {
    if (this._helper) {
      this._helper.removeFromParent();
      this._helper.dispose();
      this._helper = null;
    }
  }

  // =============================================
  // Serialization
  // =============================================

  serialize() {
    return {
      projection: this.projection,
      fov: this.fov,
      near: this.near,
      far: this.far,
      orthoSize: this.orthoSize,
      primary: this.primary,
    };
  }

  deserialize(data) {
    if (!data) return;
    if (data.projection !== undefined) this.projection = data.projection;
    if (data.fov !== undefined) this.fov = data.fov;
    if (data.near !== undefined) this.near = data.near;
    if (data.far !== undefined) this.far = data.far;
    if (data.orthoSize !== undefined) this.orthoSize = data.orthoSize;
    if (data.primary !== undefined) this.primary = data.primary;
    this._createCamera();
  }
}
