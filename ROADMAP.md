# Project Ludus — 実装ロードマップ

> 最終更新: 2026-04-01

## 完了済みフェーズ

| Phase | 名称 | 状態 |
|-------|------|------|
| 1 | コアエンジン＆エディタ基盤 | ✅ 完了 |
| 2 | プロシージャルモデリング＆モディファイア | ✅ 完了 |
| 3 | スクリプティングシステム | ✅ 完了 |
| 4 | 物理エンジン (Rapier3D) | ✅ 完了 |
| 5 | アセット管理＆エクスポート | ✅ 完了 |
| 6 | UI/Canvas システム | ✅ 完了 |
| 7 | AI IDE 連携＆プロジェクト管理 | ✅ 完了 |
| 8 | エディタ品質向上 (Undo/Redo, コンポーネント削除, Hierarchy D&D) | ✅ 完了 |
| 8.5 | GLB/GLTF モデル シーン内プレビュー | ✅ 完了 |
| 9 | パーティクルシステム | ✅ 完了 |
| 10A | アニメーションシステム (Tween, Animator, GLBアニメ) | ✅ 完了 |
| 12A | ポストプロセス (Bloom, SSAO, Vignette, Color Grading) | ✅ 完了 |

---

## 今後の実装計画

> **実装方針**: Phase 15A → 15B → 15C を最優先で実装し、「実際にゲームが動く」状態を最短で達成する。
> その後、既存の将来フェーズ (10B, 11, 12B...) に進む。

### Phase 15A: ゲームランタイム基盤 — ✅ 完了

> カメラ制御、エンティティの動的生成/削除、他エンティティへのアクセスを実装完了。

#### 15A-1. Camera コンポーネント＆スクリプト API ✅
- [x] **Camera コンポーネント** (`src/engine/components/Camera.js`)
  - FOV、near/far クリッピング、projection タイプ (perspective / orthographic)
- [x] **スクリプト API**: `camera` オブジェクトをスクリプトコンテキストに追加
  - `camera.setPosition(x, y, z)` / `camera.lookAt(x, y, z)` / `camera.follow(entity, offset)` / `camera.setFOV(deg)`
- [x] **エディタ統合**: Inspector UI, ツールバーボタン, コンテキストメニュー, Add Component
- [x] **Play モード対応**: Camera エンティティを実行カメラに使用
- [x] **エクスポート対応**: Runtime で Camera エンティティの設定を適用
- [x] **シリアライズ対応**: シーン保存/読み込みに統合

#### 15A-2. エンティティの動的生成/削除 (Instantiate / Destroy) ✅
- [x] `scene.instantiate(name, options)` — プリミティブ生成 + Transform + 物理
- [x] `scene.destroy(entity)` / `scene.destroyDelayed(entity, delay)`
- [x] **物理連携**: 動的生成エンティティの RigidBody/Collider 自動登録/削除
- [ ] **スクリプト連携**: 生成エンティティにスクリプトの動的アタッチ (15B で検討)
- [ ] **パフォーマンス**: オブジェクトプーリングの検討（将来的に Phase 11 のプレハブと連携）

#### 15A-3. 他エンティティのコンポーネントアクセス ✅
- [x] **`_wrapEntity()` の拡張**: `getComponent(typeName)` メソッド追加
- [x] **コンポーネント API プロキシ**: rigidbody, particles, animator, audio, renderer
- [x] **安全性**: 存在しないコンポーネントへのアクセスは `null` を返す

#### 追加実装 (先行)
- [x] Transform ヘルパー (forward, right, up, lookAt, translate)
- [x] Renderer/Material API (setColor, setOpacity, setEmissive, setVisible)
- [x] Game グローバルストア (game.set/get/has/delete)
- [x] InputManager: mouseDelta + Pointer Lock API

---

### Phase 15B: スクリプト API 拡充 — ✅ 完了

> ゲームオブジェクトの制御性を大幅に向上。

#### 15B-1. エンティティ有効/無効切り替え (setActive) ✅
- [x] `entity.setActive(bool)` — 再帰的に子エンティティも無効化
- [x] `entity.isActive` / `entity.tag` — 状態・タグの読み書き
- [x] inactive 時に描画・物理・スクリプト update をスキップ

#### 15B-2. タグによるエンティティ検索 ✅
- [x] `scene.findByTag(tag)` / `scene.findAllByTag(tag)`
- [x] Inspector UI: エンティティ名の下にタグ編集フィールド (プリセット候補付き)
- [x] SceneSerializer: tag と active の保存/読み込み (全4メソッド対応)

#### 15B-3. マテリアル/見た目のランタイム変更 ✅ (15A で先行実装)
- [x] `renderer.setColor/setOpacity/setVisible/setEmissive`
- [x] `_wrapEntity()` にも renderer プロキシ含む

#### 15B-4. Transform ヘルパーメソッド ✅ (15A で先行実装)
- [x] `setRotation/setRotationDeg/lookAt/translate/forward/right/up`

#### 15B-5. ゲームステート管理 ✅ (15A で先行実装)
- [x] `game.set/get/has/delete/clear` — Play/Stop 時自動クリア

---

### Phase 15C: 高度なゲームプレイ機能 — ✅ 完了

> FPS/TPS 等のジャンルに対応する高度な API。

#### 15C-1. レイキャスト API ✅
- [x] `physics.raycast(origin, direction, maxDistance)` → `{ hit, entity, point, normal, distance }`
- [x] `physics.raycastAll(origin, direction, maxDistance)` → 全ヒット結果
- [x] `physics.setGravity(x, y, z)` / `physics.gravity`
- [x] Rapier 統合: PhysicsWorld に raycast/raycastAll/intersectionsWithRay

#### 15C-2. マウスデルタ＆ポインターロック ✅ (15A で先行実装)
- [x] `input.mouseDelta` / `input.lockCursor()` / `input.unlockCursor()` / `input.isCursorLocked`
- [x] dispose 時にポインターロック自動解除

---

### Phase 10B: タイムラインエディタ — ✅ 完了
- [x] **AnimationClip データモデル**: Keyframe (time, value, easing) + AnimationTrack (property path) + AnimationClip
- [x] **AnimationPlayer コンポーネント**: クリップ再生エンジン (play/stop/pause, speed, loop)
- [x] **タイムラインエディタ**: GUIでキーフレームを打つパネル (ルーラー、ダイヤモンド、プレイヘッド)
- [x] **13種のアニメーション可能プロパティ**: Transform(9) + Material(2) + Light(1) + Camera(1)
- [x] **全エディタ統合**: Inspector, Hierarchy, Serializer, Exporter 対応

### Phase 11: シーン管理の拡張 — ✅ 完了
- [x] **複数シーン**: `ProjectManager.listScenes/loadScene(name)/saveScene(data, name)/deleteScene(name)`
- [x] **シーン遷移 (ランタイム)**: `scene.loadScene('level2')` でプレイ中にシーン切替
  - スクリプト/物理/UI/Tween を停止 → 新シーン読込 → 再起動
- [x] **プレハブシステム**:
  - `ProjectManager.savePrefab/loadPrefab/listPrefabs/deletePrefab`
  - コンテキストメニューに「Save as Prefab 📦」(要プロジェクト)
  - `scene.instantiatePrefab(name, { position, rotation, scale })` でランタイムスポーン
  - Play開始時にプロジェクトから全プレハブをレジストリにロード

### ~~Phase 12: レンダリング強化~~ ✅ 完了 (12A ポストプロセス)

### Phase 12B: レンダリング強化 — ✅ 完了
- [x] **テクスチャマッピング** ✅ 完了: ディフューズ、ノーマル、ラフネス、メタルネス、エミッシブマップ
  - MeshRenderer / ProceduralMesh 両対応、UV Repeat、Normal Scale
  - Inspector にドラッグ&ドロップ対応テクスチャスロット UI
  - AssetManager 連携、シリアライズ対応
- [x] **環境マップ / スカイボックス** ✅ 完了: EnvironmentSystem
  - 3 モード: Solid / Gradient / Sky (シェーダーベース sky dome)
  - 4 プリセット: Day / Sunset / Night / Overcast
  - Fog: Linear / Exponential + カラー・距離設定
  - Scene ルートエンティティ選択時に Inspector で編集, シリアライズ対応
- [x] **シャドウ改善** ✅ 完了: PCFSoftShadowMap、シャドウbias/normalBias/radius/mapSize/frustum制御
- [x] **GPUインスタンシング** ✅ 完了: InstancedMeshRenderer (6形状, 4パターン, シードPRNG)

### Phase 16: エディタ品質基盤 ✅ (16-1〜3 完了)

> **目的**: ゲーム制作の基本ループ（編集→テスト→デバッグ）を安定・快適にする。

#### 16-1. コンソールパネル改善 ✅
- [x] テキスト選択＆コピー対応（`user-select: text`）
- [x] ログレベルフィルタ（Info / Warn / Error のトグルボタン）
- [x] クリアボタン ＆ ログ件数表示
- [x] 自動スクロール制御（末尾近くにいる場合のみ追従）

#### 16-2. エンティティ複製＆コピーペースト ✅
- [x] `Ctrl+D`: エンティティ複製（既存実装を確認・維持）
- [x] `Ctrl+C` / `Ctrl+V`: コピー＆ペースト（SerializeEntity/DeserializeEntity 使用）
- [x] `Delete`: エンティティ削除のショートカット（既存実装を確認・維持）
- [x] ペースト時は名前に "(Copy)" 付与

#### 16-3. オートセーブ＆復旧 ✅
- [x] IndexedDB への定期オートセーブ（60秒間隔, idb-keyval 使用）
- [x] 起動時の復元ダイアログ（日本語、シーン名・保存日時表示）
- [x] プロジェクト未使用時でもローカルセッションとして保持
- [x] 7日以上古いスナップショットは自動削除
- [x] Play中はオートセーブ抑制、dispose時にタイマークリア

#### 16-4. コンポーネントプロパティ Undo/Redo 拡張 → Phase 20 に統合
- [x] `PropertyCommand` は実装済み（commands/PropertyCommand.js）
- [ ] Inspector の `_emitChange` 50箇所以上との統合 → Inspector.js リファクタリング (Phase 20-2) と併行実施

---

### Phase 17: エディタ操作効率 ⬜

> **目的**: シーン構築のイテレーション速度を上げる。

#### 17-1. 選択ロック＆表示トグル ✅
- [x] Hierarchy 各行に 👁（表示/非表示）と 🔒（選択ロック）アイコン
- [x] ロック中エンティティはシーンビューのクリックで選択不可
- [x] 非表示エンティティは object3D.visible = false
- [x] 状態はセッション中維持（シリアライズ対象外）

#### 17-2. スナップ移動＆グリッド設定 ✅ (既存実装確認)
- [x] Toolbar にスナップトグルボタン (G キー)
- [x] 移動スナップ: 1m、回転スナップ: 15°、スケールスナップ: 0.25
- [ ] スナップ値の UI 変更（将来的に Inspector or ポップアップ）
- [ ] グリッドサイズ設定 UI

#### 17-3. 複数エンティティ選択
- [ ] `Ctrl+Click`: 追加選択、`Shift+Click`: 範囲選択
- [ ] 複数選択時の一括移動（Gizmo）、一括削除
- [ ] Inspector は非表示 or 共通プロパティのみ表示

#### 17-4. Inspector UX 改善 (部分完了)
- [x] コンポーネント折りたたみ状態の記憶（エンティティ切替時も維持）
- [ ] プロパティのリセットボタン（デフォルト値復元）
- [x] 数値入力の上下キーステップ増減（↑↓ + Shift=10x, Alt=0.1x）
- [x] Vec3 入力にも矢印キーステップ対応
- [ ] 色チャンネルの RGB スライダー表示

---

### Phase 18: エクスポート＆配布 ⬜

> **目的**: 作ったゲームを人に見せる・配布する手段を確立する。
> **対象ジャンル**: アイドルゲーム、カジュアルゲーム等（ブラウザ＆デスクトップ特化）

#### 18-1. エクスポートパイプライン強化 ✅
- [x] エクスポート前バリデーション（Script構文チェック、Missing Asset/Texture 警告）
- [x] テクスチャ / GLB アセットのエクスポート時パス解決の検証＆修正
- [x] ビルドサイズ表示（MB / KB）
- [x] 進捗ログ表示（各ステップの状態をコンソールに出力）
- [x] エラー時は確認ダイアログ after バリデーション
- [ ] itch.io 向け HTML5 ビルド最適化

#### 18-2. プレビューサーバー (部分完了)
- [x] ワンクリックでブラウザ内プレビュー（Blob URL + 新タブで自己完結型 HTML 生成）
- [x] ツールバー🚀ボタン + F8 ショートカット
- [x] プレビューバー（Restart / Close）付き
- [ ] QRコード生成 — スマホからの動作確認
- [ ] ホットリロード対応

#### 18-3. デスクトップアプリ化 (Electron)
- [ ] Electron ラッパーの雛形生成（`npm init electron-app` 相当）
- [ ] エクスポート時に `electron-builder` 向け構成を同梱
- [ ] Windows / macOS の `.exe` / `.app` ビルド手順のドキュメント化
- [ ] ゲームウィンドウサイズ・タイトル設定

---

### Phase 19: テンプレート＆スターターキット ⬜

> **目的**: AI IDE との連携を軸に、プロジェクトの初期立ち上げを高速化する。
> テンプレートは **コード変更不要** — プロジェクトフォルダ構成 (scenes/scripts/.ludus/) の配布のみ。

#### 19-1. テンプレートプロジェクト作成 ✅
- [x] **クリッカーゲーム**: UIテキスト＋ボタン＋プログレスバー＋game.set/get による進捗管理 (`.ludus/templates/clicker-game.md`)
- [x] **放置シミュレーション**: 時間経過による自動資源生成＋アップグレード店＋パーティクルエフェクト (`.ludus/templates/idle-simulation.md`)
- [x] **3D ビューアー**: GLBモデル表示＋OrbitCamera＋ライティング設定 (`.ludus/templates/3d-viewer.md`)
- [x] `.ludus/README.md` (AI向けプロジェクト概要) 作成済み
- [x] `.ludus/API.md` (スクリプト API リファレンス) 作成済み

#### 19-2. テンプレート選択UI ✅
- [x] エディタ起動時の「スタート画面」（New / Open / Template）— グラスモーフィズムダイアログ
- [x] テンプレートのアイコン・説明・ジャンル表示（3カード: Clicker, Idle, Viewer）
- [x] 選択 → シーンへの自動エンティティ生成（Script付き）

---

### Phase 20: コードベース保守性 ⬜ (並行実施)

> **目的**: 機能追加の速度と安定性を維持するため、適宜リファクタリングを行う。
> このフェーズは独立実施ではなく、他フェーズと並行して段階的に進める。

#### 20-1. Editor.js 分割 (部分完了)
- [ ] Play/Stop ロジック → `PlayModeManager.js`
- [x] エンティティ作成・テンプレート → `EntityFactory.js` (抽出完了、create/createPrimitive/createLight/createCamera/createParticleEmitter)
- [x] キーボードショートカット → `ShortcutManager.js` (抽出完了、登録ベースのAPI)

#### 20-2. Inspector.js 分割 (部分完了)
- [x] `COMPONENT_REGISTRY` パターン導入 — `_addComponentByType()` を87行→30行に圧縮
- [ ] 各コンポーネントレンダラーを個別ファイルへ抽出
  - `TransformInspector.js`, `MeshInspector.js`, `PhysicsInspector.js` ...
- [ ] ヘルパーメソッドの共有モジュール化（`_createSection`, `_createNumberRow` 等）

#### 20-3. 型安全性の向上 (部分完了)
- [x] `tsconfig.json` 作成（checkJs=true、段階的対象ファイル指定）
- [x] `// @ts-check` + JSDoc 型注釈（ShortcutManager, EntityFactory）
- [ ] JSDoc の `@typedef` 整備（主要インターフェースの型定義）
- [ ] CI禁止は不要だが、エディタ上の型チェックサポート

---

### 将来フェーズ（保留）

| Phase | 名称 | 状態 | 備考 |
|-------|------|------|------|
| 13 | 2D ゲームサポート | 🔵 保留 | SpriteRenderer のみ先行検討。タイルマップ・2D物理は当面見送り |
| 14 | ネットワーキング | 🔵 保留 | リーダーボード等の軽量オンライン要素から検討 |
| — | ビジュアルスクリプティング | 🔵 保留 | AI IDE との連携を優先するため当面見送り |
| — | プラグインシステム | 🔵 保留 | |
| — | コラボレーション | 🔵 保留 | |

---

## 実装優先度サマリー

> Phase 16〜20 を優先的に実装し、「ゲームが作れて配布できる」状態を最短で達成する。
> Phase 20 (リファクタリング) は他フェーズと並行して段階的に実施する。

| 順序 | Phase | 内容 | 効果 |
|------|-------|------|------|
| ✅ 1〜13 | 1〜15C | コアエンジン＆エディタ＆ランタイム API | ✅ 全完了 |
| ✅ 14 | **16** | エディタ品質基盤 (コンソール, コピペ, オートセーブ) | ✅ 完了 |
| 🟡 15 | **17** | エディタ操作効率 (表示/ロック, 折りたたみ, 矢印キー) | 🟡 17-3 保留 |
| 🟡 16 | **18** | エクスポート＆配布 (バリデーション, プレビュー) | 🟡 18-3 保留 |
| ✅ 17 | **19** | テンプレート＆スターター (API Doc, UI, 3テンプレート) | ✅ 完了 |
| 🟡 — | **20** | コードベース保守性 (ShortcutMgr, EntityFactory, Registry, tsconfig) | 🟡 20-2残 |

---

## 改善タスク

### 完了
- [x] Inspector での数値ドラッグ操作の精度改善
- [x] Inspector 数値フィールドの直接入力対応 (2026-03-31)
- [x] 🔴 Physics Raycast API の `this.physicsWorld` → `this.physics` 修正 (2026-03-30)
- [x] 🔴 MeshRenderer テクスチャシリアライズの統一 (2026-03-30)
- [x] 🟡 `_onCollisionFn` リセット漏れ修正 (2026-03-30)
- [x] 🟡 `setActive(true)` 子エンティティ状態尊重 (2026-03-30)
- [x] 🟢 PCFSoftShadowMap 非推奨警告解消 (2026-03-30)
- [x] 🟡 ScriptRuntime 非同期エラーハンドリング追加 (2026-04-01)
- [x] 🟡 ProjectManager ポーリング多重起動防止 (2026-04-01)
- [x] 🟡 Inspector イベントリスナーリーク修正 (2026-04-01)

### 中期 (Phase 16〜17 に統合)
- [ ] AI IDE ドキュメント (.ludus/) の拡充 — 全 API の反映

---

## AI IDE 連携ワークフロー

Project Ludus の最大の特長は **AI IDE との共同開発** です。

### セットアップ

```bash
# 1. プロジェクトをクローン
git clone <repository-url> my-game
cd my-game

# 2. 依存関係のインストール
npm install

# 3. 開発サーバー起動
npm run dev
```

### ゲーム開発の流れ

```
┌─────────────────────────────────────────────────┐
│  ブラウザ (Project Ludus Editor)                  │
│  ・🗂️ Open Project でゲームフォルダを開く          │
│  ・3Dビューでオブジェクト配置・ビジュアル調整       │
│  ・F5 で Play テスト                              │
└─────────────┬───────────────────────────────────┘
              │  ファイルシステム (ゲームフォルダ)
              │  ├── scenes/main.ludus.json
              │  ├── scripts/*.js
              │  └── assets/
┌─────────────┴───────────────────────────────────┐
│  AI IDE (Antigravity 等)                          │
│  ・.ludus/api-reference.md を読んでAPI理解         │
│  ・scripts/ のスクリプトを直接編集                  │
│  ・scenes/ のシーン JSON を編集                    │
│  ・変更は自動的にブラウザに反映（ホットリロード）    │
└─────────────────────────────────────────────────┘
```

### プロジェクトフォルダ構造

```
my-game/
├── project.ludus.json         ← プロジェクトメタデータ
├── scenes/
│   └── main.ludus.json        ← シーン定義 (エンティティ + コンポーネント)
├── scripts/
│   ├── player_controller.js   ← スクリプトファイル（AI IDE で直接編集可能）
│   └── game_manager.js
├── assets/                    ← テクスチャ/モデル/音声
└── .ludus/
    ├── api-reference.md       ← AI IDE 向けスクリプトAPIリファレンス
    └── scene-schema.json      ← シーンJSON スキーマ
```

---

## 開発環境セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build
```

ブラウザで `http://localhost:5173/` を開くとエディタが起動します。
