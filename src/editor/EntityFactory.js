// @ts-check
/**
 * EntityFactory — Centralized entity creation logic
 * Extracted from Editor.js for maintainability (Phase 20-1)
 */
import { Transform } from '../engine/components/Transform.js';
import { Light } from '../engine/components/Light.js';
import { Camera } from '../engine/components/Camera.js';
import { ParticleEmitter } from '../engine/components/ParticleEmitter.js';
import { ProceduralMesh } from '../modeling/ProceduralMesh.js';

/** Friendly name mapping for primitive shapes */
const SHAPE_NAMES = {
  box: 'Cube', sphere: 'Sphere', cylinder: 'Cylinder',
  cone: 'Cone', torus: 'Torus', plane: 'Plane', capsule: 'Capsule',
};

/** Light type display names */
const LIGHT_NAMES = {
  directional: 'Directional Light',
  point: 'Point Light',
};

export class EntityFactory {
  /**
   * @param {import('../engine/Scene.js').Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Create a primitive mesh entity
   * @param {string} shape - 'box', 'sphere', 'cylinder', etc.
   * @param {string} [color] - Optional hex color
   * @returns {import('../engine/Entity.js').Entity}
   */
  createPrimitive(shape, color) {
    const name = SHAPE_NAMES[shape] || shape;
    const entity = this.scene.createEntity(name);
    entity.addComponent(new Transform());
    const pm = new ProceduralMesh();
    entity.addComponent(pm);
    pm.configure(shape, {}, { color: color || this._randomPastelColor() });
    return entity;
  }

  /**
   * Create a light entity
   * @param {'directional'|'point'} lightType
   * @param {object} [options]
   * @returns {import('../engine/Entity.js').Entity}
   */
  createLight(lightType, options = {}) {
    const name = LIGHT_NAMES[lightType] || 'Light';
    const entity = this.scene.createEntity(name);
    entity.addComponent(new Transform());
    const light = new Light();
    entity.addComponent(light);
    light.configure(lightType, { intensity: options.intensity ?? 1.5 });
    /** @type {Transform} */
    const transform = /** @type {*} */ (entity.getComponent('Transform'));
    if (lightType === 'directional') {
      transform.setPosition(5, 8, 5);
    } else {
      transform.setPosition(0, 3, 0);
    }
    return entity;
  }

  /**
   * Create a camera entity
   * @returns {import('../engine/Entity.js').Entity}
   */
  createCamera() {
    const entity = this.scene.createEntity('Camera');
    entity.addComponent(new Transform());
    /** @type {Transform} */
    const t = /** @type {*} */ (entity.getComponent('Transform'));
    t.setPosition(0, 5, 10);
    entity.addComponent(new Camera());
    return entity;
  }

  /**
   * Create a particle emitter entity
   * @param {string} [preset='fire']
   * @returns {import('../engine/Entity.js').Entity}
   */
  createParticleEmitter(preset = 'fire') {
    const entity = this.scene.createEntity('Particle Emitter');
    entity.addComponent(new Transform());
    const pe = new ParticleEmitter();
    pe.applyPreset(preset);
    entity.addComponent(pe);
    pe.init();
    return entity;
  }

  /**
   * Create an entity by type string (used by context menu)
   * @param {string} type - 'box', 'sphere', 'directional-light', 'camera', 'particle', etc.
   * @returns {import('../engine/Entity.js').Entity}
   */
  create(type) {
    if (type === 'camera') return this.createCamera();
    if (type === 'particle') return this.createParticleEmitter();
    if (type.includes('light')) {
      const lightType = type.replace('-light', '');
      return this.createLight(/** @type {'directional'|'point'} */ (lightType));
    }
    return this.createPrimitive(type);
  }

  /**
   * Generate a random pastel color for new entities
   * @returns {string} hex color
   */
  _randomPastelColor() {
    const hue = Math.random() * 360;
    const sat = 40 + Math.random() * 30;
    const light = 50 + Math.random() * 20;
    const c = (1 - Math.abs(2 * light / 100 - 1)) * sat / 100;
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = light / 100 - c / 2;
    let r, g, b;
    if (hue < 60) { r = c; g = x; b = 0; }
    else if (hue < 120) { r = x; g = c; b = 0; }
    else if (hue < 180) { r = 0; g = c; b = x; }
    else if (hue < 240) { r = 0; g = x; b = c; }
    else if (hue < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }
}
