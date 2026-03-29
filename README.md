# 🎮 Project Ludus — Browser-Based 3D Game Editor

<div align="center">

**Unity-inspired 3D game editor running entirely in the browser**  
**Designed for AI IDE co-creation (Antigravity, Cursor, etc.)**

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
- Non-destructive modifier stack: Twist, Bend, Taper, Noise, Subdivide
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

### 🤖 AI IDE Integration
- **File System Access API** for direct project folder read/write
- Scripts saved as individual `.js` files — AI IDE can edit directly
- **Auto-save** with debounced persistence (2s)
- **Hot reload** — external changes auto-detected and applied
- `.ludus/api-reference.md` — comprehensive API docs for AI context
- `.ludus/scene-schema.json` — JSON Schema for scene validation

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

### AI IDE Workflow

1. **Clone** this repository for each new game project
2. Run `npm install && npm run dev`
3. In the browser editor, click 🗂️ **Open Project** and select your game folder
4. Open the **same folder** in your AI IDE (Antigravity, etc.)
5. The AI reads `.ludus/api-reference.md` for API context
6. Edit `scripts/*.js` or `scenes/*.ludus.json` from the IDE — changes auto-reload in the browser

---

## 📖 Documentation

- [PROGRESS.md](./PROGRESS.md) — Detailed development progress report
- [ROADMAP.md](./ROADMAP.md) — Future implementation plans
- [.ludus/api-reference.md](./.ludus/api-reference.md) — Scripting API reference (for AI IDEs)
- [.ludus/scene-schema.json](./.ludus/scene-schema.json) — Scene JSON schema

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
