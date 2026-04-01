# Project Ludus — AI コーディングアシスタント向けガイド

## プロジェクト概要

Project Ludus は **ブラウザベースの 3D ゲームエディタ** です。
アイドル / カジュアルゲームの開発に特化しており、スクリプト・物理・UI・パーティクル等を
内蔵しているため外部ツールなしでゲームを作成・テスト・エクスポートできます。

## 技術スタック

| 項目 | 技術 |
|------|------|
| レンダリング | Three.js r183 |
| 物理エンジン | Rapier3D (WASM) |
| ビルドツール | Vite |
| 永続化 | IndexedDB (idb-keyval) |
| エクスポート | JSZip (スタンドアロン ZIP) |

## ディレクトリ構造

```
project-ludus/
├── index.html              # エディタ HTML
├── src/
│   ├── engine/             # エンジンコア (ECS)
│   │   ├── Entity.js       # エンティティ
│   │   ├── Component.js    # コンポーネント基底
│   │   ├── Scene.js        # シーン管理
│   │   ├── AssetManager.js # アセット管理 (IndexedDB)
│   │   ├── components/     # 全コンポーネント
│   │   │   ├── Transform.js
│   │   │   ├── Light.js
│   │   │   ├── Camera.js
│   │   │   ├── Script.js
│   │   │   ├── RigidBody.js
│   │   │   ├── Collider.js
│   │   │   ├── ParticleEmitter.js
│   │   │   ├── Animator.js
│   │   │   ├── GLBModel.js
│   │   │   ├── UICanvas.js
│   │   │   ├── AudioSource.js
│   │   │   └── InstancedMeshRenderer.js
│   │   └── systems/        # エンジンシステム
│   │       ├── PhysicsWorld.js
│   │       ├── AudioSystem.js
│   │       ├── UISystem.js
│   │       ├── TweenManager.js
│   │       ├── PostProcessManager.js
│   │       └── EnvironmentSystem.js
│   ├── editor/             # エディタ UI
│   │   ├── Editor.js       # メインエディタクラス
│   │   ├── Exporter.js     # ZIP エクスポート
│   │   ├── SceneSerializer.js  # シーン保存/読込
│   │   ├── UndoManager.js  # Undo/Redo
│   │   ├── commands/       # コマンドパターン
│   │   └── panels/         # UI パネル
│   │       ├── Hierarchy.js    # エンティティツリー
│   │       ├── Inspector.js    # プロパティエディタ
│   │       ├── SceneView.js    # 3D ビューポート
│   │       └── Toolbar.js      # ツールバー
│   ├── modeling/           # プロシージャルモデリング
│   │   ├── ProceduralMesh.js
│   │   ├── EditableMesh.js
│   │   └── modifiers/      # Twist, Bend, Taper, Noise, Subdivide
│   ├── scripting/          # スクリプティング
│   │   ├── ScriptRuntime.js    # スクリプト実行エンジン
│   │   └── InputManager.js     # 入力管理
│   └── styles/
│       └── main.css        # 全スタイル
├── .ludus/
│   ├── README.md           # このファイル
│   └── API.md              # スクリプト API リファレンス
└── ROADMAP.md              # 開発ロードマップ
```

## スクリプトの書き方

エディタ内の **Script タブ** でスクリプトを記述します。
利用可能な全 API は `.ludus/API.md` を参照してください。

### 基本パターン

```js
function start() {
  // 初期化処理
  game.set('score', 0);
  ui.createText('Score: 0', { x: 20, y: 20, fontSize: 24, color: '#fff' });
}

function update(dt) {
  // 毎フレーム処理
  if (input.isKeyPressed(' ')) {
    game.set('score', game.get('score', 0) + 1);
    ui.updateText('score', 'Score: ' + game.get('score'));
  }
}
```

### アイドルゲームパターン

```js
// 自動資源生成
let timer = 0;
function update(dt) {
  timer += dt;
  if (timer >= 1.0) {
    timer = 0;
    const gold = game.get('gold', 0) + game.get('goldPerSec', 1);
    game.set('gold', gold);
    ui.updateText('goldText', 'Gold: ' + gold);
  }
}
```

## エディタの操作

| ショートカット | 機能 |
|---|---|
| W / E / R | 移動 / 回転 / スケール |
| G | スナップトグル |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+C / Ctrl+V | コピー / ペースト |
| Ctrl+D | 複製 |
| Delete | エンティティ削除 |
| Ctrl+S | プロジェクト保存 |
| ▶ / ⏸ / ⏹ | Play / Pause / Stop |

## 開発サーバー起動

```bash
npm install      # 初回のみ
npx vite --host --port 5173
```

## ゲームのエクスポート

ツールバーの 📦 ボタンでスタンドアロン ZIP をダウンロードできます。
ZIP を解凍して `index.html` をローカルサーバーで配信すると動作します。
