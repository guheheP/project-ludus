# Project Ludus — Scripting API Reference

> This document is designed for AI coding assistants to understand the
> Project Ludus scripting system and generate correct game scripts.

## Architecture Overview

Project Ludus is a browser-based 3D game editor using:
- **Three.js r183** for 3D rendering
- **Rapier3D** for physics simulation
- **ECS (Entity-Component-System)** architecture

---

## Script Lifecycle

Scripts are attached to entities via the `Script` component. Each script can define:

```javascript
function start() {
  // Called once when Play mode begins
}

function update(dt) {
  // Called every frame. dt = delta time in seconds
}

function onCollision(other) {
  // Called when this entity's collider contacts another
  // other.entity = the other Entity reference (wrapped)
}
```

---

## Available APIs

All APIs are accessible via `this.*` inside script functions.
Variables like `entity`, `transform`, `scene`, `input`, `time`, `rigidbody`, `audio`, `particles`, `camera`, `renderer`, `game`, `physics`, `tween`, `ui`, `console`, `Math`, `THREE` are all pre-bound and can be used directly (without `this.`).

### `this.entity` — Current Entity
| Property/Method | Type | Description |
|----------|------|-------------|
| `name` | `string` | Entity name |
| `id` | `number` | Unique entity ID |
| `isActive` | `boolean` | Whether entity is active (read-only) |
| `tag` | `string` | Entity tag (read/write, for grouping) |
| `object3D` | `THREE.Object3D` | Three.js scene object |
| `setActive(bool)` | method | Enable/disable entity (hides from rendering & physics) |

### `this.transform` — Transform Component
| Property/Method | Type | Description |
|----------------|------|-------------|
| `position` | `{x, y, z}` | World position (read/write) |
| `rotation` | `{x, y, z}` | Euler rotation in radians (read/write) |
| `scale` | `{x, y, z}` | Scale (read/write) |
| `setPosition(x, y, z)` | method | Set position |
| `setScale(x, y, z)` | method | Set scale |
| `setRotation(x, y, z)` | method | Set rotation in degrees |
| `lookAt(x, y, z)` | method | Rotate to face a target point |
| `translate(x, y, z)` | method | Move in local space |
| `forward` | `THREE.Vector3` | Forward direction vector (read-only) |
| `right` | `THREE.Vector3` | Right direction vector (read-only) |
| `up` | `THREE.Vector3` | Up direction vector (read-only) |

### `this.scene` — Scene Access & Entity Management
| Method | Returns | Description |
|--------|---------|-------------|
| `find(name)` | entity/null | Find first entity by name |
| `findAll(name)` | array | Find all entities with given name |
| `findByTag(tag)` | entity/null | Find first entity by tag |
| `findAllByTag(tag)` | array | Find all entities with given tag |
| `instantiate(name, options?)` | entity | Create new entity at runtime |
| `instantiatePrefab(name, options?)` | entity | Spawn entity from a saved Prefab |
| `destroy(entityRef)` | void | Immediately remove entity from scene |
| `destroyDelayed(entityRef, seconds)` | void | Remove entity after delay |
| `loadScene(sceneName)` | void | Switch to another scene file |

**Instantiate options:**
```javascript
scene.instantiate('Bullet', {
  position: { x: 0, y: 1, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  shape: 'sphere',           // auto-creates ProceduralMesh
  shapeParams: { radius: 0.1 },
  color: '#ff0000',
  physics: {                  // auto-creates RigidBody + Collider
    type: 'dynamic',
    mass: 0.5,
    collider: 'sphere',
    radius: 0.1
  }
});
```

**Destroy examples:**
```javascript
// Destroy another entity immediately
const enemy = scene.find('Enemy');
if (enemy) scene.destroy(enemy);

// Destroy self after 2 seconds
scene.destroyDelayed(entity, 2);
```

### `this.input` — Input State
| Method/Property | Returns | Description |
|--------|---------|-------------|
| `isKeyDown(key)` | `boolean` | `true` if key is currently held |
| `isKeyPressed(key)` | `boolean` | `true` if key was pressed this frame |
| `isKeyReleased(key)` | `boolean` | `true` if key was released this frame |
| `mouse` | `{x, y}` | Normalized mouse position (-1 to 1) |
| `mouseLeft` | `boolean` | Left mouse button held |
| `mouseRight` | `boolean` | Right mouse button held |
| `mouseDelta` | `{dx, dy}` | Mouse movement delta (for FPS cameras) |
| `lockCursor()` | void | Lock cursor (pointer lock) |
| `unlockCursor()` | void | Unlock cursor |
| `isCursorLocked` | `boolean` | Whether cursor is currently locked |

**Common key names:** `'w'`, `'a'`, `'s'`, `'d'`, `' '` (space), `'Shift'`, `'ArrowUp'`, `'ArrowDown'`, `'ArrowLeft'`, `'ArrowRight'`, `'Space'`, `'Enter'`

### `this.time` — Time Info
| Property | Type | Description |
|----------|------|-------------|
| `dt` | `number` | Delta time in seconds |
| `elapsed` | `number` | Total elapsed time since Play |
| `frame` | `number` | Current frame count |

### `this.rigidbody` — Physics Body (if RigidBody + Collider exist)
| Method/Property | Description |
|--------|-------------|
| `addForce(x, y, z)` | Apply force (continuous, acceleration-like) |
| `addImpulse(x, y, z)` | Apply impulse (instant velocity change) |
| `setVelocity(x, y, z)` | Set linear velocity directly |
| `setAngularVelocity(x, y, z)` | Set angular velocity |
| `setTranslation(x, y, z)` | Teleport body to position |
| `setRotation(x, y, z, w)` | Set body rotation (quaternion) |
| `velocity` | Current velocity `{x, y, z}` (read-only) |
| `angularVelocity` | Current angular velocity `{x, y, z}` (read-only) |

### `this.audio` — Audio (if AudioSource exists)
| Method | Description |
|--------|-------------|
| `play()` | Play audio |
| `stop()` | Stop audio |
| `setVolume(v)` | Set volume (0.0 to 1.0) |

### `this.particles` — Particle Emitter (if ParticleEmitter exists)
| Method/Property | Description |
|--------|-------------|
| `play()` / `emit()` | Start emitting |
| `stop()` | Stop emitting |
| `burst(count)` | Emit a burst of particles |
| `reset()` | Reset particle system |
| `set(params)` | Update params: `{ rate, gravity, spread, startColor, endColor, startSize, endSize, startOpacity, endOpacity }` |
| `playing` | Whether currently emitting (read-only) |

### `this.camera` — Camera Control (if Camera entity exists in scene)
| Method/Property | Description |
|--------|-------------|
| `setPosition(x, y, z)` | Move the active camera |
| `lookAt(x, y, z)` | Point camera at target |
| `follow(entityRef, offset?)` | Follow entity with offset. Default: `{x:0, y:5, z:-10}` |
| `setFOV(degrees)` | Change field of view |
| `position` | Camera position (read-only) |
| `fov` | Current FOV in degrees (read-only) |

### `this.renderer` — Material / Visibility Control
| Method | Description |
|--------|-------------|
| `setColor(hex)` | Change mesh color (e.g. `'#ff0000'`) |
| `setOpacity(value)` | Set opacity (0.0 to 1.0, auto-enables transparency) |
| `setVisible(bool)` | Show/hide entity |
| `setEmissive(hex, intensity?)` | Set emissive glow color and intensity |

### `this.physics` — Physics World & Raycasting
| Method/Property | Returns | Description |
|--------|---------|-------------|
| `raycast(origin, dir, maxDist?)` | `{hit, point, normal, distance, entity}` | Cast ray, get first hit |
| `raycastAll(origin, dir, maxDist?)` | array | Cast ray, get all hits |
| `setGravity(x, y, z)` | void | Change world gravity |
| `gravity` | `{x, y, z}` | Current gravity (read-only) |

```javascript
// Raycast example
const hit = physics.raycast(transform.position, transform.forward, 50);
if (hit && hit.hit) {
  console.log('Hit:', hit.entity.name, 'at distance', hit.distance);
}
```

### `this.game` — Global State Store (shared across all scripts)
| Method | Description |
|--------|-------------|
| `set(key, value)` | Store a value |
| `get(key, default?)` | Get a value (with optional default) |
| `has(key)` | Check if key exists |
| `delete(key)` | Remove a key |
| `clear()` | Clear all stored data |

```javascript
// In any script: Set and read shared data
game.set('score', 100);
game.set('playerHP', 75);
const score = game.get('score', 0); // returns 100
```

### `this.ui` — UI System (if UICanvas component exists)
| Method | Returns | Description |
|--------|---------|-------------|
| `createText(text, options?)` | `string` (id) | Create HUD text |
| `createButton(label, onClick, options?)` | `string` | Create clickable button |
| `createProgressBar(value, options?)` | `string` | Create progress bar (0-1) |
| `createImage(src, options?)` | `string` | Create image element |
| `updateText(id, newText)` | void | Update text content |
| `updateProgressBar(id, value)` | void | Update progress bar |
| `setPosition(id, x, y)` | void | Move UI element |
| `setVisible(id, visible)` | void | Show/hide element |
| `removeElement(id)` | void | Remove element |
| `clearAll()` | void | Remove all UI elements |

**UI Element Options:**
```javascript
// Text
{ x: 10, y: 10, fontSize: 24, color: '#ffffff', fontWeight: 'bold', id: 'my-text' }
// Button
{ x: 10, y: 10, width: 150, height: 40, bgColor: '#4444ff', color: '#fff', id: 'my-btn' }
// ProgressBar
{ x: 10, y: 10, width: 200, height: 20, fillColor: '#00ff88', id: 'my-bar' }
```

### `this.tween` — Animation Tweens
| Method | Returns | Description |
|--------|---------|-------------|
| `to(target, props, duration, easing?)` | id | Animate properties over time |
| `killAll()` | void | Cancel all tweens |
| `killTweensOf(target)` | void | Cancel tweens on a specific object |
| `count` | `number` | Number of active tweens (read-only) |

```javascript
tween.to(transform.position, { x: 5, y: 2, z: 0 }, 1.5, 'easeOutCubic');
```

### `console` — Logging (redirected to editor console)
| Method | Description |
|--------|-------------|
| `console.log(...)` | Info message (shown in blue) |
| `console.warn(...)` | Warning message (shown in yellow) |
| `console.error(...)` | Error message (shown in red) |

### Built-in Libraries
- `Math` — Standard JavaScript Math object
- `THREE` — Full Three.js library (Vector3, Color, Quaternion, etc.)

---

## Wrapped Entity (returned by scene.find / scene.findAll / etc.)

When you find another entity via `scene.find()`, you get a wrapped reference:

```javascript
const enemy = scene.find('Enemy');
enemy.name              // string
enemy.id                // number
enemy.isActive          // boolean
enemy.tag               // string (read/write)
enemy.object3D          // THREE.Object3D
enemy.setActive(false)  // disable entity
enemy.transform         // { position, rotation, scale, setPosition, lookAt, forward, ... }
enemy.getComponent('RigidBody')  // returns API proxy for component
enemy.rigidbody         // shorthand for RigidBody API
enemy.particles         // shorthand for ParticleEmitter API
enemy.animator          // shorthand for Animator API
enemy.audio             // shorthand for AudioSource API
enemy.renderer          // shorthand for Renderer/Material API
```

---

## All Components Reference

| Component | Description | Key Properties |
|-----------|-------------|----------------|
| `Transform` | Position, rotation, scale | `position`, `rotation`, `scale` |
| `ProceduralMesh` | Parametric 3D shape with modifiers | `shapeType`, `shapeParams`, `color`, `metalness`, `roughness`, `wireframe`, `modifiers` |
| `EditableMesh` | Vertex-editable mesh (baked from ProceduralMesh) | `positions`, `indices`, `color`, `metalness`, `roughness` |
| `MeshRenderer` | Legacy mesh renderer | `geometryType`, `geometryParams`, `color` |
| `Light` | Scene lighting | `lightType` (directional/point/spot/ambient), `color`, `intensity`, `castShadow` |
| `Script` | Per-entity game logic | `fileName`, `filePath`, `code`, `enabled` |
| `RigidBody` | Physics body | `bodyType` (dynamic/static/kinematic), `mass`, `gravityScale`, `linearDamping`, `angularDamping`, `lockRotation` |
| `Collider` | Physics collision shape | `shape` (box/sphere/capsule/cylinder/mesh/convex), `size`, `radius`, `height`, `restitution`, `friction`, `isTrigger`, `autoFit` |
| `Camera` | Game camera (overrides editor camera in Play mode) | `fov`, `near`, `far`, `primary` |
| `AudioListener` | Audio listener (one per scene) | — |
| `AudioSource` | Audio playback | `assetId`, `autoplay`, `loop`, `volume`, `spatial` |
| `UICanvas` | HUD overlay container | `overlay` |
| `GLBModel` | 3D model import (GLB/GLTF) | `assetId`, `fileName` |
| `ParticleEmitter` | Particle system | `maxParticles`, `emitRate`, `lifetime`, `speed`, `size`, `color`, preset: fire/smoke/sparkle/snow/rain |
| `Animator` | Keyframe animation controller | `states` (array of animation states) |
| `AnimationPlayer` | Property animation playback | `keyframes`, `duration`, `loop`, `autoPlay` |
| `InstancedMeshRenderer` | GPU-instanced rendering | `geometryType`, `count`, `instances` |

### ProceduralMesh Shapes
| Shape | Parameters |
|-------|-----------|
| `box` | `width`, `height`, `depth` |
| `sphere` | `radius` |
| `cylinder` | `radiusTop`, `radiusBottom`, `height` |
| `cone` | `radius`, `height` |
| `torus` | `radius`, `tube` |
| `plane` | `width`, `height` |
| `capsule` | `radius`, `length` |

### Modifiers (apply to ProceduralMesh)
| Type | Parameters |
|------|-----------|
| `Twist` | `angle` (-720 to 720), `axis` (x/y/z) |
| `Bend` | `angle` (-180 to 180), `axis` (x/y/z), `direction` (x/y/z) |
| `Taper` | `amount` (-2 to 2), `axis` (x/y/z), `curve` (linear/smooth/sqrt) |
| `Noise` | `strength` (0-2), `frequency` (0.1-10), `seed` (0-9999) |
| `Subdivide` | `iterations` (0-4) |

---

## Script Examples

### Basic WASD Movement with Physics
```javascript
function start() {
  this.speed = 5;
  this.jumpForce = 8;
}

function update(dt) {
  const rb = this.rigidbody;
  if (!rb) return;

  let vx = 0, vz = 0;
  if (input.isKeyDown('w')) vz -= this.speed;
  if (input.isKeyDown('s')) vz += this.speed;
  if (input.isKeyDown('a')) vx -= this.speed;
  if (input.isKeyDown('d')) vx += this.speed;

  rb.setVelocity(vx, rb.velocity.y, vz);

  if (input.isKeyPressed('Space') && Math.abs(rb.velocity.y) < 0.1) {
    rb.addImpulse(0, this.jumpForce, 0);
  }
}
```

### Destroy on Collision
```javascript
function onCollision(other) {
  if (other.entity.name === 'Bullet') {
    // Destroy the bullet
    scene.destroy(other.entity);
    // Destroy self after 0.5s
    scene.destroyDelayed(entity, 0.5);
    console.log('Hit!');
  }
}
```

### Spawn Entities at Runtime
```javascript
function update(dt) {
  if (input.isKeyPressed('Space')) {
    const bullet = scene.instantiate('Bullet', {
      position: { x: transform.position.x, y: transform.position.y + 1, z: transform.position.z },
      shape: 'sphere',
      shapeParams: { radius: 0.1 },
      color: '#ffaa00',
      physics: { type: 'dynamic', mass: 0.1, collider: 'sphere', radius: 0.1 }
    });
    // Apply forward velocity
    const dir = transform.forward;
    const speed = 20;
    bullet.rigidbody.setVelocity(dir.x * speed, dir.y * speed, dir.z * speed);
    // Auto-destroy after 3 seconds
    scene.destroyDelayed(bullet, 3);
  }
}
```

### Score Counter with UI
```javascript
function start() {
  this.score = 0;
  this.scoreText = ui.createText('Score: 0', {
    x: 20, y: 20, fontSize: 28, color: '#ffcc00', fontWeight: 'bold'
  });
}

function update(dt) {
  ui.updateText(this.scoreText, 'Score: ' + this.score);
}

function onCollision(other) {
  if (other.entity.tag === 'coin') {
    this.score += 10;
    scene.destroy(other.entity);
  }
}
```

### Camera Follow
```javascript
function start() {
  this.target = scene.find('Player');
  this.offset = { x: 0, y: 8, z: 12 };
  this.smoothing = 5;
}

function update(dt) {
  if (!this.target) return;
  const tp = this.target.transform.position;
  const p = transform.position;
  const s = this.smoothing * dt;
  p.x += (tp.x + this.offset.x - p.x) * s;
  p.y += (tp.y + this.offset.y - p.y) * s;
  p.z += (tp.z + this.offset.z - p.z) * s;
  entity.object3D.lookAt(tp.x, tp.y, tp.z);
}
```

### FPS Camera with Pointer Lock
```javascript
function start() {
  this.sensitivity = 0.002;
  this.yaw = 0;
  this.pitch = 0;
}

function update(dt) {
  if (input.isKeyPressed('Enter')) {
    input.lockCursor();
  }
  if (input.isCursorLocked) {
    this.yaw -= input.mouseDelta.dx * this.sensitivity;
    this.pitch -= input.mouseDelta.dy * this.sensitivity;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
    transform.rotation.y = this.yaw;
    transform.rotation.x = this.pitch;
  }
}
```

### Physics Raycast (Shooting)
```javascript
function update(dt) {
  if (input.isKeyPressed('Space')) {
    const hit = physics.raycast(transform.position, transform.forward, 100);
    if (hit && hit.hit) {
      console.log('Hit:', hit.entity.name, 'dist:', hit.distance.toFixed(1));
      hit.entity.renderer.setColor('#ff0000');
      scene.destroyDelayed(hit.entity, 1);
    }
  }
}
```

### Global Game State
```javascript
// player.js
function onCollision(other) {
  if (other.entity.tag === 'coin') {
    game.set('score', game.get('score', 0) + 10);
    scene.destroy(other.entity);
  }
}

// hud.js (separate entity with UICanvas)
function start() {
  this.text = ui.createText('Score: 0', { x: 20, y: 20, fontSize: 24, color: '#fff' });
}
function update(dt) {
  ui.updateText(this.text, 'Score: ' + game.get('score', 0));
}
```

### Scene Switching
```javascript
function update(dt) {
  if (input.isKeyPressed('Enter')) {
    scene.loadScene('level2');
  }
}
```

---

## Scene JSON Format

Scene files (`scenes/main.ludus.json`) define all entities and their components.
See `.ludus/scene-schema.json` for the full JSON Schema.

### Post-Processing Settings (scene-level)
```json
{
  "postProcess": {
    "enabled": true,
    "bloom": { "enabled": true, "strength": 0.8, "threshold": 0.6, "radius": 0.4 },
    "ssao": { "enabled": true, "radius": 0.5, "intensity": 1.0 },
    "vignette": { "enabled": true, "offset": 0.5, "darkness": 1.2 },
    "colorGrading": { "enabled": true, "brightness": 0, "contrast": 0.1, "saturation": 0.1 }
  }
}
```

### Environment Settings (scene-level)
```json
{
  "environment": {
    "backgroundType": "sky",
    "skyPreset": "day",
    "backgroundColor": "#0f0f23",
    "gradientTop": "#1a1a3e",
    "gradientBottom": "#0f0f23",
    "fogEnabled": true,
    "fogType": "linear",
    "fogColor": "#0f0f23",
    "fogNear": 10,
    "fogFar": 100
  }
}
```
