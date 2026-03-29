import * as THREE from 'three';

/**
 * AudioSystem — Manages playback of AudioSources via Three.js Audio API
 */
export class AudioSystem {
  /**
   * @param {import('../Scene.js').Scene} scene
   * @param {import('../AssetManager.js').AssetManager} assetManager
   */
  constructor(scene, assetManager) {
    this.scene = scene;
    this.assetManager = assetManager;
    
    /** @type {THREE.AudioListener|null} */
    this.threeListener = null;

    this.audioLoader = new THREE.AudioLoader();

    /** @type {boolean} Flag to prevent dangling audio after dispose */
    this._disposed = false;
  }

  /**
   * Called when entering play mode
   */
  async init() {
    this._disposed = false;

    // Find AudioListener in scene
    let listenerEntity = null;
    this.scene.entityMap.forEach(e => {
      if (e.hasComponent('AudioListener')) {
        listenerEntity = e;
      }
    });

    if (listenerEntity && listenerEntity.object3D) {
      if (!this.threeListener) {
        this.threeListener = new THREE.AudioListener();
      }
      listenerEntity.object3D.add(this.threeListener);
    } else {
      // Default fallback listener if none found
      this.threeListener = new THREE.AudioListener();
    }

    // Init Audio Sources concurrently
    const promises = [];
    for (const [id, entity] of this.scene.entityMap.entries()) {
      if (entity.hasComponent('AudioSource')) {
        const component = entity.getComponent('AudioSource');
        promises.push(this._initSource(entity, component));
      }
    }
    
    await Promise.allSettled(promises);
  }

  async _initSource(entity, component) {
    if (!component.assetId) return;

    const url = await this.assetManager.getAssetUrl(component.assetId);
    if (!url) return;

    // Race condition guard: system may have been disposed while awaiting URL
    if (this._disposed) return;

    if (!this.threeListener) return; // Cannot play without listener initialized

    const threeAudio = component.spatial 
      ? new THREE.PositionalAudio(this.threeListener)
      : new THREE.Audio(this.threeListener);

    if (component.spatial) {
      threeAudio.setRefDistance(1); // Standard falloff
    }

    entity.object3D.add(threeAudio);
    component.threeAudio = threeAudio;

    return new Promise((resolve, reject) => {
      this.audioLoader.load(url, (buffer) => {
        // Race condition guard: check if component was disposed during async load
        if (this._disposed || !component.threeAudio) {
          // Clean up the orphaned audio object
          if (threeAudio.parent) threeAudio.parent.remove(threeAudio);
          return resolve();
        }

        threeAudio.setBuffer(buffer);
        threeAudio.setLoop(component.loop);
        threeAudio.setVolume(component.volume);
        
        if (component.autoplay) {
          threeAudio.play();
        }
        resolve();
      }, undefined, (err) => reject(err));
    });
  }

  /**
   * Called to completely teardown audio when stopping play mode
   */
  dispose() {
    this._disposed = true;

    this.scene.entityMap.forEach(entity => {
      if (entity.hasComponent('AudioSource')) {
        const comp = entity.getComponent('AudioSource');
        if (comp.threeAudio) {
          if (comp.threeAudio.isPlaying) {
            comp.threeAudio.stop();
          }
          // Release buffer reference to allow GC
          if (comp.threeAudio.buffer) {
            comp.threeAudio.setBuffer(null);
          }
          if (comp.threeAudio.parent) {
             comp.threeAudio.parent.remove(comp.threeAudio);
          }
          comp.threeAudio = null;
        }
      }
      if (entity.hasComponent('AudioListener') && this.threeListener) {
        if (this.threeListener.parent) {
          this.threeListener.parent.remove(this.threeListener);
        }
      }
    });
    this.threeListener = null;
  }
}
