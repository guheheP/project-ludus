# Project Ludus — Scripting API Reference

> このドキュメントはスクリプトエディタで使用可能な全 API のリファレンスです。
> スクリプトでは `start()` と `update(dt)` 関数を定義すると自動的に呼び出されます。

## 基本構造

```js
function start() {
  // 初期化（1回だけ呼ばれる）
}

function update(dt) {
  // 毎フレーム呼ばれる（dt = 秒単位のデルタタイム）
}

function onCollision(event) {
  // 衝突時に呼ばれる（RigidBody + Collider が必要）
  // event.entity — 衝突相手のエンティティ
}
```

---

## entity — 自分自身

| プロパティ/メソッド | 型 | 説明 |
|---|---|---|
| `entity.name` | `string` | エンティティ名 |
| `entity.id` | `number` | 一意の ID |
| `entity.tag` | `string` | タグ（get/set） |
| `entity.isActive` | `boolean` | アクティブ状態 |
| `entity.object3D` | `THREE.Object3D` | Three.js オブジェクト |
| `entity.setActive(bool)` | `void` | アクティブ状態を設定 |

---

## transform — 位置・回転・スケール

| プロパティ | 型 | 説明 |
|---|---|---|
| `transform.position` | `{x, y, z}` | ワールド位置（get/set） |
| `transform.rotation` | `{x, y, z}` | 回転（度数, get/set） |
| `transform.scale` | `{x, y, z}` | スケール（get/set） |
| `transform.forward` | `{x, y, z}` | 前方ベクトル（読み取り専用） |

### 使用例
```js
function update(dt) {
  const pos = transform.position;
  transform.position = { x: pos.x + dt, y: pos.y, z: pos.z };
}
```

---

## scene — シーン操作

| メソッド | 戻り値 | 説明 |
|---|---|---|
| `scene.find(name)` | `entity\|null` | 名前でエンティティを検索 |
| `scene.findAll(name)` | `entity[]` | 同名のエンティティをすべて検索 |
| `scene.findByTag(tag)` | `entity\|null` | タグで検索（最初の1件） |
| `scene.findAllByTag(tag)` | `entity[]` | タグで全件検索 |
| `scene.instantiate(name, options)` | `entity` | エンティティを複製生成 |
| `scene.destroy(entity)` | `void` | エンティティを即座に削除 |
| `scene.destroyDelayed(entity, sec)` | `void` | 指定秒後に削除 |
| `scene.loadScene(name)` | `void` | 別のシーンをロード |
| `scene.instantiatePrefab(name, opts)` | `entity` | プレハブから生成 |

### instantiate options
```js
const bullet = scene.instantiate("Bullet", {
  position: { x: 0, y: 1, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  parent: null // 親エンティティ（省略可）
});
```

---

## input — 入力

| メソッド/プロパティ | 型 | 説明 |
|---|---|---|
| `input.isKeyDown(key)` | `boolean` | キーが押されている |
| `input.isKeyPressed(key)` | `boolean` | キーが押された瞬間 |
| `input.isKeyReleased(key)` | `boolean` | キーが離された瞬間 |
| `input.mouse` | `{x, y}` | マウス座標 |
| `input.mouseLeft` | `boolean` | 左クリック |
| `input.mouseRight` | `boolean` | 右クリック |
| `input.mouseDelta` | `{dx, dy}` | マウス移動量 |
| `input.lockCursor()` | `void` | カーソルロック |
| `input.unlockCursor()` | `void` | カーソルロック解除 |
| `input.isCursorLocked` | `boolean` | ロック状態 |

### キー名の例
`'a'`〜`'z'`, `'0'`〜`'9'`, `'ArrowUp'`, `'ArrowDown'`, `'ArrowLeft'`, `'ArrowRight'`, `' '`(スペース), `'Shift'`, `'Control'`

---

## time — 時間情報

| プロパティ | 型 | 説明 |
|---|---|---|
| `time.dt` | `number` | フレーム間の経過秒数 |
| `time.elapsed` | `number` | 開始からの累計秒数 |
| `time.frame` | `number` | 経過フレーム数 |

---

## game — グローバルストア

スクリプト間で共有できるキーバリューストア。

| メソッド | 説明 |
|---|---|
| `game.set(key, value)` | 値を保存 |
| `game.get(key, defaultValue)` | 値を取得（未設定時にデフォルト値を返す） |
| `game.has(key)` | キーが存在するか |
| `game.delete(key)` | 削除 |
| `game.clear()` | 全消去 |

### 使用例（スコア管理）
```js
// スコア加算スクリプト
function start() {
  game.set('score', 0);
}
function update(dt) {
  if (input.isKeyPressed(' ')) {
    game.set('score', game.get('score', 0) + 10);
    console.log('Score: ' + game.get('score'));
  }
}
```

---

## ui — UI 操作

| メソッド | 説明 |
|---|---|
| `ui.createText(text, options)` | テキスト要素を作成（返値: id） |
| `ui.createButton(label, onClick, options)` | ボタンを作成（返値: id） |
| `ui.createProgressBar(value, options)` | プログレスバーを作成（返値: id） |
| `ui.createImage(src, options)` | 画像要素を作成（返値: id） |
| `ui.updateText(id, newText)` | テキストを更新 |
| `ui.updateProgressBar(id, value)` | バーの値を更新（0〜1） |
| `ui.setPosition(id, x, y)` | 要素位置を設定 |
| `ui.setVisible(id, visible)` | 表示/非表示 |
| `ui.removeElement(id)` | 要素を削除 |
| `ui.clearAll()` | 全UI要素を削除 |

### options の例
```js
const scoreText = ui.createText('Score: 0', {
  x: 20, y: 20,
  fontSize: 24,
  color: '#ffffff',
  fontWeight: 'bold'
});
```

---

## rigidbody — 物理（RigidBody コンポーネント必要）

| メソッド/プロパティ | 型 | 説明 |
|---|---|---|
| `rigidbody.addForce(x, y, z)` | `void` | 力を加える |
| `rigidbody.addImpulse(x, y, z)` | `void` | 瞬間的な力を加える |
| `rigidbody.setVelocity(x, y, z)` | `void` | 速度を設定 |
| `rigidbody.setAngularVelocity(x, y, z)` | `void` | 角速度を設定 |
| `rigidbody.setTranslation(x, y, z)` | `void` | 位置を直接設定 |
| `rigidbody.setRotation(x, y, z, w)` | `void` | 回転を設定（クォータニオン） |
| `rigidbody.velocity` | `{x,y,z}` | 現在の速度 |
| `rigidbody.angularVelocity` | `{x,y,z}` | 現在の角速度 |

---

## physics — 物理ワールド

| メソッド/プロパティ | 説明 |
|---|---|
| `physics.raycast(origin, dir, maxDist)` | レイキャスト（最初のヒット） |
| `physics.raycastAll(origin, dir, maxDist)` | レイキャスト（全ヒット） |
| `physics.setGravity(x, y, z)` | 重力設定 |
| `physics.gravity` | 現在の重力 `{x, y, z}` |

### レイキャスト結果
```js
const hit = physics.raycast(
  { x: 0, y: 5, z: 0 },  // 原点
  { x: 0, y: -1, z: 0 }, // 方向
  100                      // 最大距離
);
if (hit && hit.hit) {
  console.log('Hit: ' + hit.entity.name);
  console.log('Point: ' + JSON.stringify(hit.point));
}
```

---

## camera — カメラ制御

| メソッド | 説明 |
|---|---|
| `camera.setPosition(x, y, z)` | カメラ位置 |
| `camera.lookAt(x, y, z)` | カメラの向きを指定 |
| `camera.setFOV(degrees)` | 画角設定 |
| `camera.setNearFar(near, far)` | クリップ面設定 |
| `camera.getPosition()` | 現在位置を取得 |

---

## audio — オーディオ（AudioSource コンポーネント必要）

| メソッド | 説明 |
|---|---|
| `audio.play()` | 再生 |
| `audio.stop()` | 停止 |
| `audio.setVolume(v)` | 音量設定（0〜1） |

---

## particles — パーティクル（ParticleEmitter コンポーネント必要）

| メソッド/プロパティ | 説明 |
|---|---|
| `particles.play()` | 再生開始 |
| `particles.stop()` | 停止 |
| `particles.emit()` | 1回放出 |
| `particles.burst(count)` | 指定数のパーティクルを一度に放出 |
| `particles.reset()` | リセット |
| `particles.set(params)` | パラメータ一括設定 |
| `particles.playing` | 再生中か |

### set params
```js
particles.set({
  rate: 100,
  gravity: -5,
  spread: 0.3,
  startColor: '#ff0000',
  endColor: '#ffff00',
  startSize: 0.5,
  endSize: 0.02
});
```

---

## tween — アニメーション補間

| メソッド/プロパティ | 説明 |
|---|---|
| `tween.to(target, props, duration, easing)` | Tween 開始 |
| `tween.killAll()` | 全 Tween 停止 |
| `tween.killTweensOf(target)` | 対象の Tween 停止 |
| `tween.count` | アクティブな Tween 数 |

### 使用例
```js
const pos = transform.position;
tween.to(pos, { y: 5 }, 1.0, 'easeOutBounce');
```

### Easing 一覧
`linear`, `easeInQuad`, `easeOutQuad`, `easeInOutQuad`, `easeInCubic`, `easeOutCubic`, `easeOutBounce`

---

## renderer — マテリアル操作

| メソッド | 説明 |
|---|---|
| `renderer.setColor(hex)` | メッシュの色を変更 |
| `renderer.setOpacity(value)` | 不透明度（0〜1） |
| `renderer.setVisible(bool)` | 表示/非表示 |
| `renderer.setEmissive(hex, intensity)` | 発光色と強度 |

---

## console — デバッグ出力

```js
console.log('メッセージ');   // Info レベル
console.warn('警告');        // Warn レベル
console.error('エラー');     // Error レベル
```

---

## THREE / Math — ユーティリティ

- `THREE` — Three.js ライブラリ全体（`THREE.Vector3`, `THREE.Color` 等）
- `Math` — JavaScript 標準の Math オブジェクト

---

## エディタ ショートカット

| キー | アクション |
|------|-----------|
| `W` | 移動モード |
| `E` | 回転モード |
| `R` | スケールモード |
| `G` | スナップ切り替え |
| `V` | 頂点編集モード |
| `F` | 選択エンティティにフォーカス |
| `Delete` / `Backspace` | 選択エンティティを削除 |
| `Ctrl+D` | 複製 |
| `Ctrl+C` / `Ctrl+V` | エンティティのコピー＆ペースト |
| `Ctrl+Z` | 元に戻す |
| `Ctrl+Y` / `Ctrl+Shift+Z` | やり直す |
| `Ctrl+S` | シーンを保存 |
| `Ctrl+O` | シーンを読み込み |
| `F5` | プレイ / ストップ |
| `F6` | ポーズ |
| `F8` | 🚀 プレビュー（新タブでゲーム実行） |
| `Escape` | プレイ停止 / 選択解除 |
