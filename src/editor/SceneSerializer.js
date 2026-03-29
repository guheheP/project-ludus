import { Scene } from '../engine/Scene.js';
import { Transform } from '../engine/components/Transform.js';
import { MeshRenderer } from '../engine/components/MeshRenderer.js';
import { Light } from '../engine/components/Light.js';
import { ScriptComponent } from '../engine/components/Script.js';
import { RigidBody } from '../engine/components/RigidBody.js';
import { Collider } from '../engine/components/Collider.js';
import { AudioListener } from '../engine/components/AudioListener.js';
import { AudioSource } from '../engine/components/AudioSource.js';
import { UICanvas } from '../engine/components/UICanvas.js';
import { ProceduralMesh, MODIFIER_TYPES } from '../modeling/ProceduralMesh.js';

/**
 * SceneSerializer — Save & load scenes as JSON
 */
export class SceneSerializer {

  /**
   * Serialize a scene to a JSON-compatible object
   * @param {Scene} scene
   * @returns {object}
   */
  static serialize(scene) {
    const data = {
      version: '1.0.0',
      name: scene.name,
      createdAt: new Date().toISOString(),
      entities: [],
    };

    // Traverse all entities (skip root)
    const traverse = (entity) => {
      if (entity === scene.root) {
        for (const child of entity.children) {
          traverse(child);
        }
        return;
      }

      const entityData = {
        id: entity.id,
        name: entity.name,
        parentId: entity.parent ? entity.parent.id : null,
        components: {},
      };

      // Serialize Transform
      if (entity.hasComponent('Transform')) {
        const t = entity.getComponent('Transform');
        entityData.components.Transform = {
          position: { x: t.position.x, y: t.position.y, z: t.position.z },
          rotation: { x: t.rotation.x, y: t.rotation.y, z: t.rotation.z },
          scale: { x: t.scale.x, y: t.scale.y, z: t.scale.z },
        };
      }

      // Serialize ProceduralMesh
      if (entity.hasComponent('ProceduralMesh')) {
        const pm = entity.getComponent('ProceduralMesh');
        entityData.components.ProceduralMesh = pm.serialize();
      }

      // Serialize MeshRenderer (legacy)
      if (entity.hasComponent('MeshRenderer')) {
        const mr = entity.getComponent('MeshRenderer');
        entityData.components.MeshRenderer = {
          geometryType: mr.geometryType,
          geometryParams: { ...mr.geometryParams },
          color: mr.color,
          metalness: mr.metalness,
          roughness: mr.roughness,
          wireframe: mr.wireframe,
        };
      }

      // Serialize Light
      if (entity.hasComponent('Light')) {
        const l = entity.getComponent('Light');
        entityData.components.Light = {
          lightType: l.lightType,
          color: l.color,
          intensity: l.intensity,
          castShadow: l.castShadow,
        };
      }

      // Serialize Script
      if (entity.hasComponent('Script')) {
        const s = entity.getComponent('Script');
        entityData.components.Script = {
          code: s.code,
          fileName: s.fileName,
          enabled: s.enabled,
        };
      }

      // Serialize RigidBody
      if (entity.hasComponent('RigidBody')) {
        const rb = entity.getComponent('RigidBody');
        entityData.components.RigidBody = rb.serialize();
      }

      // Serialize Collider
      if (entity.hasComponent('Collider')) {
        const col = entity.getComponent('Collider');
        entityData.components.Collider = col.serialize();
      }

      // Serialize Audio
      if (entity.hasComponent('AudioListener')) {
        entityData.components.AudioListener = entity.getComponent('AudioListener').serialize();
      }
      if (entity.hasComponent('AudioSource')) {
        entityData.components.AudioSource = entity.getComponent('AudioSource').serialize();
      }
      if (entity.hasComponent('UICanvas')) {
        entityData.components.UICanvas = entity.getComponent('UICanvas').serialize();
      }

      data.entities.push(entityData);

      for (const child of entity.children) {
        traverse(child);
      }
    };

    traverse(scene.root);
    return data;
  }

  /**
   * Deserialize a JSON object into a scene
   * @param {object} data
   * @param {Scene} scene - existing scene to populate (will be cleared)
   * @returns {Scene}
   */
  static deserialize(data, scene) {
    // Clear existing entities
    const entitiesToRemove = [...scene.root.children];
    for (const entity of entitiesToRemove) {
      scene.removeEntity(entity);
    }

    scene.name = data.name || 'Untitled';

    // First pass: create all entities
    const entityMap = new Map();
    for (const entityData of data.entities) {
      const entity = scene.createEntity(entityData.name);
      entityMap.set(entityData.id, entity);
    }

    // Second pass: restore components
    for (const entityData of data.entities) {
      const entity = entityMap.get(entityData.id);
      if (!entity) continue;

      const comps = entityData.components;

      // Transform
      if (comps.Transform) {
        const t = new Transform();
        entity.addComponent(t);
        const td = comps.Transform;
        t.setPosition(td.position.x, td.position.y, td.position.z);
        entity.object3D.rotation.set(td.rotation.x, td.rotation.y, td.rotation.z);
        t.setScale(td.scale.x, td.scale.y, td.scale.z);
      }

      // ProceduralMesh
      if (comps.ProceduralMesh) {
        const pm = new ProceduralMesh();
        entity.addComponent(pm);
        pm.deserialize(comps.ProceduralMesh);
      }

      // MeshRenderer (legacy)
      if (comps.MeshRenderer && !comps.ProceduralMesh) {
        const mr = new MeshRenderer();
        entity.addComponent(mr);
        const mrd = comps.MeshRenderer;
        mr.configure(mrd.geometryType, mrd.geometryParams, {
          color: mrd.color,
          metalness: mrd.metalness,
          roughness: mrd.roughness,
          wireframe: mrd.wireframe,
        });
      }

      // Light
      if (comps.Light) {
        const l = new Light();
        entity.addComponent(l);
        const ld = comps.Light;
        l.configure(ld.lightType, {
          color: ld.color,
          intensity: ld.intensity,
          castShadow: ld.castShadow,
        });
      }

      // Script
      if (comps.Script) {
        const s = new ScriptComponent();
        s.code = comps.Script.code;
        s.fileName = comps.Script.fileName || 'script.js';
        s.enabled = comps.Script.enabled !== false;
        entity.addComponent(s);
      }

      // RigidBody
      if (comps.RigidBody) {
        const rb = new RigidBody();
        rb.deserialize(comps.RigidBody);
        entity.addComponent(rb);
      }

      // Collider
      if (comps.Collider) {
        const col = new Collider();
        col.deserialize(comps.Collider);
        entity.addComponent(col);
      }

      // Audio
      if (comps.AudioListener) {
        const al = new AudioListener();
        al.deserialize(comps.AudioListener);
        entity.addComponent(al);
      }
      if (comps.AudioSource) {
        const as = new AudioSource();
        as.deserialize(comps.AudioSource);
        entity.addComponent(as);
      }

      // UICanvas
      if (comps.UICanvas) {
        const uc = new UICanvas();
        uc.deserialize(comps.UICanvas);
        entity.addComponent(uc);
      }
    }

    return scene;
  }

  /**
   * Download scene as JSON file
   * @param {Scene} scene
   */
  static downloadSceneJSON(scene) {
    const data = this.serialize(scene);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${scene.name.replace(/\s+/g, '_').toLowerCase()}.ludus.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Load scene from a JSON file (file dialog)
   * @param {Scene} scene
   * @returns {Promise<Scene>}
   */
  static loadSceneJSON(scene) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.ludus.json';

      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = JSON.parse(evt.target.result);
            this.deserialize(data, scene);
            resolve(scene);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });

      input.click();
    });
  }
}
