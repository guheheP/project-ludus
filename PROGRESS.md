# Project Ludus — 開発進捗レポート

> 最終更新: 2026-03-29

## 📋 プロジェクト概要

**Project Ludus** は、ブラウザベースの3Dゲームエディタです。  
Unity や Godot にインスパイアされた本格的なエディタUIを持ち、  
Three.js + Rapier 物理エンジンの上に構築されています。

- **技術スタック**: Vite + Vanilla JS + Three.js r183 + Rapier3D + Monaco Editor
- **設計思想**: ECS (Entity-Component-System) パターン
- **ターゲット**: ブラウザ上で動作する軽量な3Dゲーム制作ツール

---

## ✅ 実装済みフェーズ

### Phase 1: コアエンジン＆エディタ基盤
- **ECSアーキテクチャ**: Entity / Component / Scene の基本構造
- **Transform コンポーネント**: position, rotation, scale の管理
- **MeshRenderer**: Three.js メッシュの生成・マテリアル管理
- **Light コンポーネント**: Directional, Ambient, Point, Spot ライト対応
- **エディタUI**: Hierarchy パネル、Inspector パネル、Toolbar、SceneView
- **カメラ操作**: OrbitControls による3Dビューポート操作
- **コンテキストメニュー**: エンティティの追加・削除・複製

### Phase 2: プロシージャルモデリング＆モディファイアスタック
- **ProceduralMesh**: Box, Sphere, Cylinder, Cone, Torus, Plane, Capsule のプリミティブ生成
- **モディファイアシステム**: 非破壊的なメッシュ加工パイプライン
  - Twist（ねじり）
  - Bend（曲げ）
  - Taper（テーパー）
  - Noise（ノイズ変形）
- **Inspector連携**: モディファイアスタックのリアルタイム編集UI

### Phase 3: スクリプティングシステム
- **ScriptRuntime**: サンドボックス化されたユーザースクリプト実行環境
- **スクリプトAPI**: `entity`, `transform`, `scene`, `input`, `time`, `console`
- **ScriptEditor (Monaco)**: シンタックスハイライト、IntelliSense 型定義付き
- **InputManager**: キーボード入力のリアルタイム取得
- **Play/Pause/Stop モード**: エディタとランタイムの切り替え

### Phase 4: 物理エンジン（Rapier3D）
- **PhysicsWorld**: Rapier WASM ベースの物理シミュレーション
- **RigidBody コンポーネント**: Dynamic / Static / Kinematic ボディ
- **Collider コンポーネント**: Box / Sphere / Capsule / Cylinder シェイプ
- **固定タイムステップ**: 1/60s 周期のアキュムレータパターン
- **CCD (Continuous Collision Detection)**: トンネリング防止
- **衝突イベント**: `onCollision` コールバックでスクリプトに通知
- **デバッグ描画**: ワイヤーフレームでコライダー可視化
- **autoFit**: ProceduralMesh に合わせた自動コライダーサイズ設定

### Phase 5: アセット管理＆エクスポート
- **AssetManager**: ドラッグ＆ドロップでのアセットインポート (PNG, GLB, MP3)
- **ProjectBrowser パネル**: インポート済みアセットの一覧表示
- **AudioSystem**: AudioListener / AudioSource コンポーネント（3Dスペーシャルオーディオ対応）
- **SceneSerializer**: シーンの JSON シリアライズ / デシリアライズ
- **Exporter**: プレイ可能な HTML ファイルとしてのゲームエクスポート（ZIP出力）

### Phase 6: UI/Canvas システム
- **UICanvas コンポーネント**: エンティティにアタッチしてUI機能を有効化
- **UISystem**: Play 時に HTML オーバーレイを生成・管理
- **スクリプトAPI**:
  - `ui.createText(text, options)` — テキスト表示
  - `ui.createButton(label, onClick, options)` — ボタン
  - `ui.createProgressBar(value, options)` — プログレスバー（HPバーなど）
  - `ui.createImage(src, options)` — 画像表示
  - `ui.updateText(id, newText)` / `ui.updateProgressBar(id, value)` — 動的更新
  - `ui.removeElement(id)` / `ui.clearAll()` — 要素の削除
- **IntelliSense**: ScriptEditor に UIAPI 型定義を追加

---

## 🏗️ プロジェクト構造

```
GameEditor/
├── index.html                    # エントリーポイント (エディタレイアウト)
├── package.json
├── vite.config.js
└── src/
    ├── main.js                   # アプリケーション起動
    ├── styles/
    │   └── main.css              # エディタUI スタイル
    ├── engine/                   # ゲームエンジンコア
    │   ├── Component.js          # コンポーネント基底クラス
    │   ├── Entity.js             # エンティティ (コンポーネントコンテナ)
    │   ├── Scene.js              # シーングラフ管理
    │   ├── AssetManager.js       # アセット管理
    │   ├── components/
    │   │   ├── Transform.js      # 位置・回転・スケール
    │   │   ├── MeshRenderer.js   # メッシュ描画
    │   │   ├── Light.js          # ライティング
    │   │   ├── Script.js         # スクリプト
    │   │   ├── RigidBody.js      # 物理ボディ
    │   │   ├── Collider.js       # 衝突形状
    │   │   ├── AudioListener.js  # オーディオリスナー
    │   │   ├── AudioSource.js    # オーディオソース
    │   │   └── UICanvas.js       # UIキャンバス
    │   └── systems/
    │       ├── PhysicsWorld.js   # Rapier 物理ワールド
    │       ├── AudioSystem.js    # オーディオ管理
    │       └── UISystem.js       # UI オーバーレイ管理
    ├── editor/                   # エディタ機能
    │   ├── Editor.js             # メインエディタコントローラ
    │   ├── ContextMenu.js        # 右クリックメニュー
    │   ├── Exporter.js           # ゲームエクスポーター
    │   ├── SceneSerializer.js    # シーン保存・読み込み
    │   └── panels/
    │       ├── Hierarchy.js      # エンティティツリー
    │       ├── Inspector.js      # プロパティエディタ
    │       ├── SceneView.js      # 3Dビューポート
    │       ├── ScriptEditor.js   # Monaco コードエディタ
    │       ├── Toolbar.js        # ツールバー
    │       ├── ProjectBrowser.js # アセットブラウザ
    │       └── PanelManager.js   # パネルレイアウト管理
    ├── modeling/                  # プロシージャルモデリング
    │   ├── ProceduralMesh.js     # メッシュ生成エンジン
    │   ├── Modifier.js           # モディファイア基底クラス
    │   └── modifiers/
    │       ├── Twist.js
    │       ├── Bend.js
    │       ├── Taper.js
    │       └── Noise.js
    └── scripting/                # スクリプトランタイム
        ├── ScriptRuntime.js      # スクリプト実行サンドボックス
        └── InputManager.js       # キーボード入力
```

---

## 🔧 既知の課題・改善点

1. **Exporter.js**: テンプレートリテラルの問題を回避するため文字列結合を使用中（Viteのバンドルでエスケープが壊れる場合あり）
2. **Ground の物理**: Plane ジオメトリの回転(-90° X)と Collider サイズの整合性に要注意
3. **AudioSystem**: 実際のオーディオ再生はブラウザの autoplay policy による制限あり
4. **シーン永続化**: localStorage への自動保存は未実装（デフォルトシーンは毎回再生成）
