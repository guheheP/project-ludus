# Project Ludus — Scripting API Reference

> This document is designed for AI IDEs (Antigravity, Cursor, etc.) to understand the
> Project Ludus scripting system and generate correct game scripts.

## Architecture Overview

Project Ludus is a browser-based 3D game editor using:
- **Three.js** for 3D rendering
- **Rapier3D** for physics simulation
- **ECS (Entity-Component-System)** architecture

### Project Structure

```
my-game/
├── project.ludus.json         ← Project metadata
├── scenes/
│   └── main.ludus.json        ← Scene definition (entities + components)
├── scripts/
│   ├── player_controller.js   ← Script source files
│   └── game_manager.js
├── assets/
│   ├── textures/
│   ├── models/
│   └── audio/
└── .ludus/
    ├── api-reference.md       ← This file
    └── scene-schema.json      ← Scene JSON schema
```

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
  // other.entity = the other Entity reference
}
```

---

## Available APIs

All APIs are accessible via `this.*` inside script functions.

### `this.entity` — Current Entity
| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Entity name |
| `id` | `number` | Unique entity ID |
| `object3D` | `THREE.Object3D` | Three.js scene object |

### `this.transform` — Transform Component
| Property/Method | Type | Description |
|----------------|------|-------------|
| `position` | `{x, y, z}` | World position (read/write) |
| `rotation` | `{x, y, z}` | Euler rotation in radians (read/write) |
| `scale` | `{x, y, z}` | Scale (read/write) |
| `setPosition(x, y, z)` | method | Set position |
| `setScale(x, y, z)` | method | Set scale |

### `this.scene` — Scene Access
| Property/Method | Type | Description |
|----------------|------|-------------|
| `name` | `string` | Scene name |
| `find(name)` | method | Find entity by name. Returns entity or `null` |

### `this.input` — Input State
| Property/Method | Type | Description |
|----------------|------|-------------|
| `isKeyDown(key)` | method | `true` if key is currently held |
| `isKeyPressed(key)` | method | `true` if key was pressed this frame |
| `isKeyReleased(key)` | method | `true` if key was released this frame |
| `mouse` | `{x, y}` | Normalized mouse position (-1 to 1) |
| `mouseLeft` | `boolean` | Left mouse button held |
| `mouseRight` | `boolean` | Right mouse button held |

**Common key names:** `'w'`, `'a'`, `'s'`, `'d'`, `' '` (space), `'Shift'`, `'ArrowUp'`, `'ArrowDown'`, `'ArrowLeft'`, `'ArrowRight'`

### `this.time` — Time Info
| Property | Type | Description |
|----------|------|-------------|
| `dt` | `number` | Delta time in seconds |
| `elapsed` | `number` | Total elapsed time since Play |
| `frame` | `number` | Current frame count |

### `this.rigidbody` — Physics (if RigidBody component exists)
| Method | Description |
|--------|-------------|
| `addForce(x, y, z)` | Apply force (continuous) |
| `addImpulse(x, y, z)` | Apply impulse (instant) |
| `setVelocity(x, y, z)` | Set linear velocity |
| `setAngularVelocity(x, y, z)` | Set angular velocity |
| `velocity` | Current velocity `{x, y, z}` (read-only) |

### `this.audio` — Audio (if AudioSource component exists)
| Method | Description |
|--------|-------------|
| `play()` | Play audio |
| `stop()` | Stop audio |
| `setVolume(v)` | Set volume (0.0 to 1.0) |

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
// Text options
{ x: 10, y: 10, fontSize: 24, color: '#ffffff', fontWeight: 'bold', id: 'my-text' }

// Button options
{ x: 10, y: 10, width: 150, height: 40, bgColor: '#4444ff', color: '#fff', id: 'my-btn' }

// ProgressBar options
{ x: 10, y: 10, width: 200, height: 20, fillColor: '#00ff88', id: 'my-bar' }
```

---

## Script Examples

### Basic Movement (WASD + Physics)
```javascript
function start() {
  this.speed = 5;
  this.jumpForce = 8;
}

function update(dt) {
  const speed = this.speed;
  const rb = this.rigidbody;
  if (!rb) return;

  let vx = 0, vz = 0;
  if (this.input.isKeyDown('w')) vz -= speed;
  if (this.input.isKeyDown('s')) vz += speed;
  if (this.input.isKeyDown('a')) vx -= speed;
  if (this.input.isKeyDown('d')) vx += speed;

  rb.setVelocity(vx, rb.velocity.y, vz);

  if (this.input.isKeyPressed(' ') && Math.abs(rb.velocity.y) < 0.1) {
    rb.addImpulse(0, this.jumpForce, 0);
  }
}
```

### Rotation Animation
```javascript
function update(dt) {
  this.transform.rotation.y += 1.0 * dt;
}
```

### Score Counter with UI
```javascript
function start() {
  this.score = 0;
  this.scoreText = this.ui.createText('Score: 0', {
    x: 20, y: 20, fontSize: 28, color: '#ffcc00', fontWeight: 'bold'
  });
}

function update(dt) {
  // Update score display
  this.ui.updateText(this.scoreText, 'Score: ' + this.score);
}

function onCollision(other) {
  if (other.entity.name === 'Coin') {
    this.score += 10;
  }
}
```

### Health Bar
```javascript
function start() {
  this.maxHP = 100;
  this.hp = this.maxHP;
  this.hpBar = this.ui.createProgressBar(1.0, {
    x: 20, y: 60, width: 200, height: 16, fillColor: '#ff4444'
  });
}

function update(dt) {
  this.ui.updateProgressBar(this.hpBar, this.hp / this.maxHP);
}
```

### Object Spawning (Find & Modify)
```javascript
function start() {
  this.target = this.scene.find('Target');
}

function update(dt) {
  if (this.target) {
    // Make target bob up and down
    this.target.object3D.position.y = 2 + Math.sin(this.time.elapsed * 2) * 0.5;
  }
}
```

---

## Scene JSON Format

Scene files (`scenes/main.ludus.json`) define all entities and their components:

```json
{
  "version": "1.0.0",
  "name": "My Scene",
  "entities": [
    {
      "id": 1,
      "name": "Player",
      "parentId": null,
      "components": {
        "Transform": {
          "position": { "x": 0, "y": 1, "z": 0 },
          "rotation": { "x": 0, "y": 0, "z": 0 },
          "scale": { "x": 1, "y": 1, "z": 1 }
        },
        "ProceduralMesh": {
          "shapeType": "box",
          "shapeParams": { "width": 1, "height": 1, "depth": 1 },
          "color": "#5a7dd4",
          "metalness": 0.1,
          "roughness": 0.6,
          "wireframe": false,
          "modifiers": []
        },
        "Script": {
          "fileName": "player.js",
          "filePath": "player.js",
          "enabled": true
        },
        "RigidBody": {
          "bodyType": "dynamic",
          "mass": 1,
          "gravityScale": 1,
          "linearDamping": 0.1,
          "angularDamping": 0.05,
          "lockRotation": { "x": false, "y": false, "z": false }
        },
        "Collider": {
          "shape": "box",
          "size": { "x": 1, "y": 1, "z": 1 },
          "radius": 0.5,
          "height": 1,
          "restitution": 0,
          "friction": 0.5,
          "isTrigger": false
        }
      }
    }
  ]
}
```

### Available Components

| Component | Key Fields |
|-----------|-----------|
| `Transform` | `position`, `rotation`, `scale` |
| `ProceduralMesh` | `shapeType` (box/sphere/cylinder/cone/torus/plane/capsule), `shapeParams`, `color`, `metalness`, `roughness`, `wireframe`, `modifiers` |
| `Light` | `lightType` (directional/point/spot/ambient), `color`, `intensity`, `castShadow` |
| `Script` | `fileName`, `filePath`, `enabled`, `code` (embedded mode only) |
| `RigidBody` | `bodyType` (dynamic/static/kinematic), `mass`, `gravityScale`, `linearDamping`, `angularDamping`, `lockRotation` |
| `Collider` | `shape` (box/sphere/capsule/cylinder), `size`, `radius`, `height`, `restitution`, `friction`, `isTrigger` |
| `AudioSource` | `assetId`, `autoplay`, `loop`, `volume`, `spatial` |
| `AudioListener` | (no params) |
| `UICanvas` | `overlay` |

### Available Shape Types (ProceduralMesh)
- `box` — params: `width`, `height`, `depth`
- `sphere` — params: `radius`
- `cylinder` — params: `radiusTop`, `radiusBottom`, `height`
- `cone` — params: `radius`, `height`
- `torus` — params: `radius`, `tube`
- `plane` — params: `width`, `height`
- `capsule` — params: `radius`, `length`

### Available Modifiers
| Type | Parameters |
|------|-----------|
| `Twist` | `angle` (-720 to 720), `axis` (x/y/z) |
| `Bend` | `angle` (-180 to 180), `axis` (x/y/z), `direction` (x/y/z) |
| `Taper` | `amount` (-2 to 2), `axis` (x/y/z), `curve` (linear/smooth/sqrt) |
| `Noise` | `strength` (0-2), `frequency` (0.1-10), `seed` (0-9999) |
| `Subdivide` | `iterations` (0-4) |
