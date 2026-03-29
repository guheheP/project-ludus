# 🎮 Project Ludus — Browser-Based 3D Game Editor

<div align="center">

**Unity-inspired 3D game editor running entirely in the browser**

Built with Three.js · Rapier3D Physics · Monaco Editor · Vite

</div>

---

## ✨ Features

### 🏗️ Game Engine (ECS Architecture)
- Entity-Component-System design pattern
- Transform, MeshRenderer, Light, RigidBody, Collider, Script, Audio, UICanvas components
- Scene graph with parent-child hierarchy

### 🎨 Procedural Modeling
- 7 primitive shapes: Box, Sphere, Cylinder, Cone, Torus, Plane, Capsule
- Non-destructive modifier stack: Twist, Bend, Taper, Noise
- Real-time parameter editing in Inspector

### 📝 Scripting System
- JavaScript scripting with sandboxed execution
- Monaco Editor with IntelliSense & type definitions
- Built-in APIs: `entity`, `transform`, `scene`, `input`, `time`, `rigidbody`, `audio`, `ui`
- Play / Pause / Stop mode with state restoration

### ⚛️ Physics Engine (Rapier3D)
- Dynamic, Static, Kinematic rigid bodies
- Box, Sphere, Capsule, Cylinder colliders
- Collision events with script callbacks
- Continuous Collision Detection (CCD)
- Debug wireframe visualization

### 🖼️ UI/Canvas System
- HTML overlay-based game UI (HUD, menus)
- Create text, buttons, progress bars, images from scripts
- Dynamic update & positioning API

### 📦 Asset Management & Export
- Drag & drop import (PNG, GLB, MP3)
- Project browser panel
- Export as playable standalone HTML (ZIP)
- Scene serialization (JSON)

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173/` in your browser.

---

## 🎯 Usage

1. **Add entities** from the toolbar (Box, Sphere, Cylinder, etc.)
2. **Select & edit** properties in the Inspector panel
3. **Add components** (Script, RigidBody, Collider, UICanvas, etc.)
4. **Write scripts** in the Script tab using the built-in Monaco editor
5. **Press Play ▶** to test your game in real-time
6. **Export** your game as a standalone HTML file

---

## 📖 Documentation

- [PROGRESS.md](./PROGRESS.md) — Detailed development progress report
- [ROADMAP.md](./ROADMAP.md) — Future implementation plans

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| [Vite](https://vitejs.dev/) | Build tool & dev server |
| [Three.js](https://threejs.org/) r183 | 3D rendering |
| [Rapier3D](https://rapier.rs/) | Physics engine (WASM) |
| [Monaco Editor](https://microsoft.github.io/monaco-editor/) | Code editor |
| Vanilla JS | No framework dependencies |

---

## 📄 License

MIT
