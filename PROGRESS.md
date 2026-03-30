# Project Ludus — 開発進捗レポート

> 最終更新: 2026-03-30

## 📋 プロジェクト概要

**Project Ludus** は、ブラウザベースの3Dゲームエディタです。  
Unity や Godot にインスパイアされた本格的なエディタUIを持ち、  
Three.js + Rapier 物理エンジンの上に構築されています。

**最大の特長は AI IDE (Antigravity 等) との共同開発ワークフロー** です。  
ユーザーはブラウザでビジュアル面を調整し、AI IDE がスクリプトやシーン定義を  
直接編集することで、スピード感のあるゲーム開発を実現します。

- **技術スタック**: Vite + Vanilla JS + Three.js r183 + Rapier3D + Monaco Editor
- **設計思想**: ECS (Entity-Component-System) パターン
- **ターゲット**: ブラウザ上で動作する軽量な3Dゲーム制作ツール
- **対応ブラウザ**: Chromium系 (Chrome, Edge, Arc 等)

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
  - Subdivide（再分割）
- **Inspector連携**: モディファイアスタックのリアルタイム編集UI

### Phase 3: スクリプティングシステム
- **ScriptRuntime**: サンドボックス化されたユーザースクリプト実行環境
- **スクリプトAPI**: `entity`, `transform`, `scene`, `input`, `time`, `console`
- **ScriptEditor (Monaco)**: シンタックスハイライト、IntelliSense 型定義付き
- **InputManager**: キーボード・マウス入力のリアルタイム取得
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
- **SceneSerializer**: シーンの JSON シリアライズ / デシリアライズ（親子関係復元対応）
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

### Phase 7: AI IDE 連携＆プロジェクト管理
- **ProjectManager**: File System Access API によるプロジェクトフォルダ直接読み書き
- **ファイルベースのプロジェクト構造**: `scenes/`, `scripts/`, `assets/` の自動管理
- **スクリプトの外部ファイル化**: `scripts/*.js` として個別ファイルに保存（AI IDE が直接編集可能）
- **自動保存**: 変更後2秒のデバウンスで自動保存
- **ホットリロード**: ポーリングによるファイル変更検知、AI IDE の編集が自動反映
- **AI IDE ドキュメント**: `.ludus/api-reference.md` (スクリプトAPI) + `.ludus/scene-schema.json` (JSONスキーマ)
- **プロジェクト状態インジケーター**: ツールバーに保存状態を表示

### Phase 8: エディタ品質向上
- **Undo/Redo**: コマンドパターンによる操作履歴管理（スタック上限5０）
  - 対応コマンド: AddEntity, DeleteEntity, Transform, Property, AddComponent, RemoveComponent, Reparent
  - ショートカット: Ctrl+Z (Undo), Ctrl+Y / Ctrl+Shift+Z (Redo)
  - ツールバーボタン: ↩ / ↪（disabled 状態制御付き）
- **コンポーネント削除**: Inspector の各コンポーネントヘッダーに ✕ ボタン（Transform は削除不可）
- **Hierarchy ドラッグ＆ドロップ**: エンティティの親子関係変更・同階層並び替え
  - ドロップインジケーター: 上 (above) / 中央 (into) / 下 (below)
  - 自己・子孫への移動防止

### Phase 8.5: GLB/GLTF モデル シーン内プレビュー
- **GLBModel コンポーネント**: Three.js GLTFLoader + DRACOLoader (CDN) でモデルロード
- **自動スケール調整**: バウンディングボックスから計算し、maxSize (デフォルト 2) に収まるよう自動フィット
- **モデル統計**: Inspector にメッシュ数、三角形数、頂点数、マテリアル数を表示
- **影設定**: castShadow / receiveShadow をコンポーネント単位で制御
- **シーン配置方法**: ProjectBrowser からダブルクリック or SceneView へドラッグ＆ドロップ
- **シリアライズ対応**: assetId でモデルを永続化、シーン再読み込み時に自動リロード
- **メモリ管理**: onDetach 時に全ジオメトリ/マテリアル/テクスチャを dispose

### Phase 9: パーティクルシステム
- **ParticleEmitter コンポーネント**: THREE.Points ベースの GPU パーティクルシステム
  - 固定サイズバッファ＋オブジェクトプール方式（GC フリー）
  - ワールド空間でパーティクル管理、エンティティ位置に追従して発射
- **パラメータ**: 発射レート、最大数、寿命(min/max)、速度(min/max)、方向、スプレッド(0→集中 / 1→全方位)、重力、サイズ(start/end)、色(start/end)、不透明度(start/end)
- **ブレンドモード**: Additive / Normal 切り替え
- **プリセット 5種**: Fire, Smoke, Sparkle, Explosion, Snow — ワンクリックで適用
- **Inspector UI**: 全パラメータのリアルタイム編集、再生/停止/バースト/リセット コントロール
- **スクリプト API**: `particles.emit()`, `particles.stop()`, `particles.burst(count)`, `particles.reset()`, `particles.set({...})`
- **エクスポート対応**: Exporter のファイルリスト・ゲームループに統合
- **シリアライズ対応**: シーン保存/読み込み/複製に対応
- **ツールバー**: ✨ ボタンでワンクリック追加
- **Hierarchy アイコン**: ✨

### Phase 10A: アニメーションシステム
- **TweenManager**: 軽量 Tween エンジン (`src/engine/systems/TweenManager.js`)
  - 11種イージング: linear, easeInQuad, easeOutQuad, easeInOutQuad, easeInCubic, easeOutCubic, easeInOutCubic, easeInBack, easeOutBack, easeOutElastic, easeOutBounce
  - delay, loop (yoyo), onComplete, onUpdate コールバック
- **Animator コンポーネント**: コードなし自動アニメーション (`src/engine/components/Animator.js`)
  - 4タイプ: Rotate(回転), Float(浮遊), Pulse(拡縮), Orbit(公転)
  - Speed, Amplitude, Axis パラメータ
  - 初期状態を自動キャプチャしてリセット可能
- **GLBModel アニメーション**: AnimationMixer 統合
  - クリップ一覧表示、名前/インデックスで再生
  - ループ/ワンショット切り替え
  - Inspector でクリップ選択 + 再生/停止ボタン
- **スクリプト API**: `tween.to(target, {y:5}, 1.0, 'easeOutBounce').delay(1).loop(true)`
- **Inspector UI**: Animator 全パラメータ編集 + ⏸/🔄 コントロール
- **シリアライズ対応**: Animator シーン保存/読み込み/複製
- **エクスポート対応**: Exporter にファイルリスト・ゲームループ統合
- **Hierarchy アイコン**: 🎬

### Phase 12A: ポストプロセス (レンダリング強化)
- **PostProcessManager**: EffectComposer ベースの統合ポストプロセスパイプライン (`src/engine/systems/PostProcessManager.js`)
  - RenderPass → SSAOPass → UnrealBloomPass → Vignette → ColorGrading → OutputPass
- **Bloom**: UnrealBloomPass (Strength, Radius, Threshold)
- **SSAO**: SSAOPass (Kernel Radius, Min/Max Distance)
- **Vignette**: カスタム GLSL シェーダー (Offset, Darkness)
- **Color Grading**: カスタム GLSL シェーダー (Brightness, Contrast, Saturation)
- **SceneView 統合**: render() を composer.render() に置き換え、resize 対応
- **Inspector UI**: エンティティ未選択時に「🎨 Post-Processing」パネルを表示
  - 4セクション (Bloom, SSAO, Vignette, Color Grading) それぞれ ON/OFF + パラメータ
- **シリアライズ対応**: SceneSerializer に postProcess 設定の保存/復元を追加
- **エクスポート対応**: Exporter ランタイムに PostProcessManager を統合

### Phase 11: シーン管理の拡張
- **マルチシーン対応**: `ProjectManager` に複数シーン管理 (listScenes/loadScene/saveScene/deleteScene)
- **ランタイムシーン遷移**: `scene.loadScene('level2')` でスクリプト/物理/UI/Tween を安全にリセットし新シーン読込
- **プレハブシステム**: エンティティをプレハブとして保存、ランタイムで `scene.instantiatePrefab()` でスポーン
- **プレハブレジストリ**: Play開始時にプロジェクトから全プレハブを自動ロード

### Phase 12B: レンダリング強化
- **テクスチャマッピング**: ディフューズ、ノーマル、ラフネス、メタルネス、エミッシブマップ対応
  - MeshRenderer / ProceduralMesh 両対応、Inspector にドラッグ&ドロップ対応UI
- **環境システム (EnvironmentSystem)**: 背景・フォグの統合管理
  - 3 モード: Solid / Gradient / Sky (カスタムGLSLシェーダー sky dome)
  - 4 プリセット: Day / Sunset / Night / Overcast
  - Fog: Linear / Exponential + カラー・距離設定
  - Scene ルート選択時に Inspector で編集可能

### Phase 15A-C: ゲームランタイム基盤
- **Camera コンポーネント**: FOV, near/far, perspective/orthographic
  - スクリプト API: `camera.setPosition()`, `camera.lookAt()`, `camera.follow()`, `camera.setFOV()`
- **エンティティ動的生成/削除**: `scene.instantiate()`, `scene.destroy()`, `scene.destroyDelayed()`
- **コンポーネントアクセス**: `entity.getComponent()` で他エンティティのコンポーネント取得
- **Transform ヘルパー**: `forward`, `right`, `up`, `lookAt`, `translate`
- **マテリアル API**: `renderer.setColor()`, `renderer.setOpacity()`, `renderer.setVisible()`
- **ゲームストア**: `game.set/get/has/delete/clear` — スクリプト間の値共有
- **レイキャスト API**: `physics.raycast()`, `physics.raycastAll()`, `physics.setGravity()`
- **マウスデルタ & ポインターロック**: FPS/TPS 視点操作対応
- **タグ検索**: `scene.findByTag()`, `scene.findAllByTag()`
- **エンティティ有効/無効**: `entity.setActive()` — 子の個別状態を尊重

---

## 🔧 バグ修正 (2026-03-30)

| # | 優先度 | ファイル | 修正内容 |
|---|--------|---------|----------|
| 1 | 🔴 高 | ScriptRuntime.js | `_createPhysicsAPI` の `this.physicsWorld` → `this.physics` (Raycast API が常に null を返す) |
| 2 | 🔴 高 | SceneSerializer.js (×3箇所) | MeshRenderer テクスチャシリアライズの統一 (`mr.serialize()`/`mr.deserialize()` に変更) |
| 3 | 🟡 中 | ScriptRuntime.js | `stop()` で `_onCollisionFn` のリセット漏れ修正 |
| 4 | 🟡 中 | Entity.js | `setActive(true)` 時に子エンティティの個別 active 状態を尊重するよう変更 |
| 5 | 🟢 低 | SceneView.js | `PCFSoftShadowMap` → `PCFShadowMap` (Three.js r183 非推奨警告解消) |
| 6 | 🟢 低 | Exporter.js | エクスポートランタイムの同様のシャドウマップ修正 |

---

## 🏗️ プロジェクト構造

```
project-ludus/
├── index.html                    # エントリーポイント (エディタレイアウト)
├── package.json
├── vite.config.js
├── .ludus/                       # AI IDE 向けドキュメント
│   ├── api-reference.md          # スクリプトAPIリファレンス
│   └── scene-schema.json         # シーンJSONスキーマ
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
    │   │   ├── Script.js         # スクリプト (filePath 外部ファイル対応)
    │   │   ├── RigidBody.js      # 物理ボディ
    │   │   ├── Collider.js       # 衝突形状
    │   │   ├── AudioListener.js  # オーディオリスナー
    │   │   ├── AudioSource.js    # オーディオソース
    │   │   ├── UICanvas.js       # UIキャンバス
    │   │   ├── GLBModel.js       # GLB/GLTFモデル
    │   │   ├── ParticleEmitter.js # パーティクル
    │   │   ├── Animator.js       # コードなしアニメーション
    │   │   └── Camera.js         # カメラ
    │   └── systems/
    │       ├── PhysicsWorld.js    # Rapier 物理ワールド
    │       ├── AudioSystem.js    # オーディオ管理
    │       ├── UISystem.js       # UI オーバーレイ管理
    │       ├── TweenManager.js   # Tween アニメーション
    │       ├── PostProcessManager.js # ポストプロセス
    │       └── EnvironmentSystem.js  # 環境 (Sky, Fog)
    ├── editor/                   # エディタ機能
    │   ├── Editor.js             # メインエディタコントローラ
    │   ├── ContextMenu.js        # 右クリックメニュー
    │   ├── Exporter.js           # ゲームエクスポーター (ZIP)
    │   ├── ProjectManager.js     # プロジェクトフォルダ管理 (File System Access API)
    │   ├── SceneSerializer.js    # シーン保存・読み込み
    │   ├── UndoManager.js        # Undo/Redo スタック管理
    │   ├── commands/             # コマンドパターン
    │   │   ├── Command.js        # 基底クラス
    │   │   ├── EntityCommands.js # Add/Delete エンティティ
    │   │   ├── TransformCommand.js
    │   │   ├── PropertyCommand.js
    │   │   ├── ComponentCommands.js
    │   │   └── ReparentCommand.js
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
    │       ├── Noise.js
    │       └── Subdivide.js
    └── scripting/                # スクリプトランタイム
        ├── ScriptRuntime.js      # スクリプト実行サンドボックス
        └── InputManager.js       # キーボード・マウス入力
```

---

## 🔧 既知の課題・改善点

### 解決済み (2026-03-30)
- ~~Physics Raycast API が常に null を返す~~ → `this.physicsWorld` → `this.physics` に修正
- ~~MeshRenderer テクスチャがシーン保存時に失われる~~ → `mr.serialize()` に統一
- ~~setActive(true) が子エンティティの個別状態を無視~~ → 子の active フラグを尊重
- ~~PCFSoftShadowMap 非推奨警告~~ → `PCFShadowMap` に修正

### 残存
1. **Ground の物理**: Plane ジオメトリの回転(-90° X)と Collider サイズの整合性に要注意
2. **AudioSystem**: 実際のオーディオ再生はブラウザの autoplay policy による制限あり
3. **Prefab インスタンス化**: `scene.instantiatePrefab()` が実エンティティ参照を返さない（非同期問題）
4. **ファイルサイズ**: Editor.js (1,740行) / Inspector.js (74.7KB) の将来的なリファクタリング推奨
5. **AI IDE ドキュメント**: `.ludus/api-reference.md` に Phase 15 API の反映が未完了
