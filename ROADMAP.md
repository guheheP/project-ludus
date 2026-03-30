# Project Ludus — 実装ロードマップ

> 最終更新: 2026-03-30

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

### Phase 15B: スクリプト API 拡充 — 重要 🟠

> ゲームオブジェクトの制御性を大幅に向上させる。
> 15A と合わせて実装することで、アクション/RPG 等のジャンルに対応可能になる。

#### 15B-1. エンティティ有効/無効切り替え (setActive)
- [ ] **スクリプト API**:
  - `entity.setActive(bool)` — エンティティの有効/無効を切り替え
  - `entity.isActive` — 現在の有効状態を取得
- [ ] **エンジン対応**: `active = false` 時に以下をスキップ
  - 描画 (object3D.visible = false)
  - 物理シミュレーション
  - スクリプト update() 呼び出し
  - パーティクル更新
- [ ] **子エンティティ連動**: 親を無効化したら子も再帰的に無効化

#### 15B-2. タグによるエンティティ検索
- [ ] **スクリプト API**:
  - `scene.findByTag(tag)` — タグに一致する最初のエンティティを返す
  - `scene.findAllByTag(tag)` — タグに一致する全エンティティを返す
- [ ] **Inspector UI**: エンティティ名の下にタグ編集フィールドを追加
  - プリセットタグ候補: Player, Enemy, Item, Obstacle, Trigger, UI
- [ ] **シリアライズ**: 既に `Entity.tag` は存在しシリアライズ済み（UI と API の追加のみ）

#### 15B-3. マテリアル/見た目のランタイム変更
- [ ] **スクリプト API**: `renderer` オブジェクトをスクリプトコンテキストに追加
  - `renderer.setColor(hex)` — マテリアルカラーの動的変更
  - `renderer.setOpacity(value)` — 透明度の設定 (0.0〜1.0)
  - `renderer.setVisible(bool)` — メッシュの表示/非表示
  - `renderer.setEmissive(hex, intensity)` — 発光色設定
- [ ] **他エンティティ対応**: `_wrapEntity()` にも renderer プロキシを含める

#### 15B-4. Transform ヘルパーメソッド
- [ ] **スクリプト API**: 既存の `transform` オブジェクトを拡張
  - `transform.setRotation(x, y, z)` — 度数法での回転設定
  - `transform.setRotationDeg(x, y, z)` — 明示的な度数法エイリアス
  - `transform.lookAt(x, y, z)` — 指定座標への注視
  - `transform.forward` — 前方ベクトル (読み取り専用)
  - `transform.right` — 右方向ベクトル (読み取り専用)
  - `transform.up` — 上方向ベクトル (読み取り専用)
  - `transform.translate(x, y, z)` — ローカル座標での移動

#### 15B-5. ゲームステート管理 (グローバルストア)
- [ ] **`game` API**: 全スクリプトで共有されるキーバリューストア
  - `game.set(key, value)` — 値の設定
  - `game.get(key, defaultValue)` — 値の取得
  - `game.has(key)` — キーの存在確認
  - `game.delete(key)` — 値の削除
  - `game.clear()` — 全データクリア
- [ ] **用途例**: HP、スコア、ゲーム状態、フラグ管理
- [ ] **Play/Stop 連携**: Stop 時に自動クリア

---

### Phase 15C: 高度なゲームプレイ機能 — 推奨 🟡

> FPS/TPS 等のジャンルに対応し、ゲーム体験の品質を向上させる。

#### 15C-1. レイキャスト API
- [ ] **スクリプト API**: `physics` オブジェクトをスクリプトコンテキストに追加
  - `physics.raycast(origin, direction, maxDistance)` — 物理レイキャスト
    - 戻り値: `{ hit: bool, entity, point, normal, distance }`
  - `physics.raycastAll(origin, direction, maxDistance)` — 全ヒット結果
- [ ] **Rapier 統合**: `PhysicsWorld` に raycast メソッドを追加
- [ ] **用途例**: 射撃判定、地面検出、視線判定、インタラクション

#### 15C-2. マウスデルタ＆ポインターロック
- [ ] **InputManager 拡張**:
  - `input.mouseDelta` — `{dx, dy}` フレーム間のマウス移動量
  - `input.lockCursor()` — Pointer Lock API でカーソルをロック
  - `input.unlockCursor()` — ロック解除
  - `input.isCursorLocked` — ロック状態の確認
- [ ] **Play モード連携**: Stop 時にポインターロックを自動解除
- [ ] **用途例**: FPS/TPS の視点操作、エディタ内での回転操作

---

### Phase 10B: タイムラインエディタ
- **AnimationClip + AnimationPlayer**: キーフレームベースの完全なアニメーション
- **タイムラインエディタ**: GUI でキーフレームを打つパネル
- **アニメーションブレンド**

### Phase 11: シーン管理の拡張
- **複数シーン**: シーン切り替え機能
- **プレハブシステム**: エンティティテンプレートの保存・再利用
  - 15A-2 (Instantiate) と連携: `scene.instantiatePrefab(name)` で瞬時にスポーン

### ~~Phase 12: レンダリング強化~~ ✅ 完了 (12A ポストプロセス)

### Phase 12B: レンダリング強化
- **シャドウ改善**: カスケードシャドウマップ
- **環境マップ**: HDRI スカイボックス / 反射プローブ
- **テクスチャマッピング**: ディフューズ、ノーマル、ラフネスマップ
- **GPUインスタンシング**: 大量オブジェクトの効率的レンダリング

### Phase 13: 2Dゲームサポート
- **2D モード**: Orthographic カメラ、2Dビュー切り替え
- **SpriteRenderer**: 2D スプライト描画コンポーネント
- **スプライトシート**: アニメーションスプライトのサポート
- **2D物理**: Rapier の 2D コリジョン対応
- **タイルマップ**: グリッドベースのレベルエディタ

### Phase 14: ネットワーキング＆マルチプレイヤー
- **WebSocket / WebRTC**: リアルタイム通信基盤
- **ネットワーク同期**: エンティティの位置同期
- **ロビーシステム**: ルーム作成・参加
- **スクリプトAPI**: `network.send()`, `network.onMessage()` など

---

## 実装優先度サマリー

> Phase 15A → 15B → 15C の順に実装し、完了後に従来のフェーズ (10B〜) に進む。

| 順序 | Phase | 内容 | 効果 |
|------|-------|------|------|
| 🔴 1 | **15A-1** | Camera コンポーネント | 全ジャンルのカメラ制御 |
| 🔴 2 | **15A-2** | Instantiate / Destroy | 弾、敵、エフェクトの動的生成 |
| 🔴 3 | **15A-3** | 他エンティティのコンポーネントアクセス | エンティティ間の相互作用 |
| 🟠 4 | **15B-1** | setActive (有効/無効) | オブジェクトの出現/消失 |
| 🟠 5 | **15B-2** | タグ検索 | エンティティのグループ操作 |
| 🟠 6 | **15B-3** | マテリアル変更 API | 見た目の動的変更 |
| 🟠 7 | **15B-4** | Transform ヘルパー | キャラクター制御の簡易化 |
| 🟠 8 | **15B-5** | グローバルストア | スクリプト間の値共有 |
| 🟡 9 | **15C-1** | レイキャスト API | 射撃判定、地面検出 |
| 🟡 10 | **15C-2** | マウスデルタ＆ポインターロック | FPS/TPS 視点操作 |
| ⬜ 11 | **10B** | タイムラインエディタ | キーフレームアニメーション |
| ⬜ 12 | **11** | シーン管理＆プレハブ | 複数シーン、テンプレート |
| ⬜ 13 | **12B** | レンダリング強化 | シャドウ、HDRI、テクスチャ |
| ⬜ 14 | **13** | 2Dゲームサポート | スプライト、タイルマップ |
| ⬜ 15 | **14** | ネットワーキング | マルチプレイヤー |

---

## 改善タスク

### 完了
- [x] Inspector での数値ドラッグ操作の精度改善

### 中期
- [ ] マテリアルエディタの拡充（テクスチャスロット追加）
- [ ] AI IDE ドキュメント (.ludus/) の拡充 — 15A/15B で追加した API の反映
- [ ] Inspector.js / Editor.js のリファクタリング（巨大ファイルの分割）

### 長期
- [ ] プラグインシステム
- [ ] コラボレーション（複数人同時編集）
- [ ] モバイルプレビュー
- [ ] ビジュアルスクリプティング（ノードベースエディタ）

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
