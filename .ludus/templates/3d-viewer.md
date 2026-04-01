# 3D モデルビューアー テンプレート

> GLB/GLTF モデルを表示するビューアーアプリのテンプレートです。

## セットアップ手順

### 1. シーン構成
1. **ViewerCamera** エンティティ
   - Camera コンポーネント（Primary）
   - Script コンポーネント → `OrbitCamera.js`
   - Position: (0, 2, 5)

2. **ModelDisplay** エンティティ
   - GLB モデルをインポート（Project パネルからドラッグ）
   - Script コンポーネント → `Turntable.js`（自動回転オプション）

3. **KeyLight** — Directional Light (Intensity: 2.0, Position: 5, 8, 5)
4. **FillLight** — Point Light (Intensity: 0.8, Position: -3, 2, 3)
5. **RimLight** — Point Light (Intensity: 0.5, Position: 0, 3, -5)
6. **Ground** — Plane (Color: #1a1a2e, Scale: 10x10)

### 2. スクリプト

#### OrbitCamera.js
```javascript
// マウスでカメラを回転させるスクリプト
let yaw = 0;
let pitch = 0.3;  // 少し見下ろす角度
let distance = 5;
let targetX = 0, targetY = 1, targetZ = 0;

function start() {
  input.lockCursor();
}

function update(dt) {
  // マウスドラッグで回転
  if (input.mouseLeft || input.isCursorLocked) {
    const delta = input.mouseDelta;
    yaw -= delta.dx * 0.003;
    pitch -= delta.dy * 0.003;
    pitch = Math.max(-1.2, Math.min(1.2, pitch)); // 上下制限
  }

  // スクロール（キーで代用）でズーム
  if (input.isKeyDown('q')) distance = Math.max(1, distance - dt * 3);
  if (input.isKeyDown('z')) distance = Math.min(20, distance + dt * 3);

  // カメラ位置計算（球面座標）
  const x = targetX + distance * Math.sin(yaw) * Math.cos(pitch);
  const y = targetY + distance * Math.sin(pitch);
  const z = targetZ + distance * Math.cos(yaw) * Math.cos(pitch);

  camera.setPosition(x, y, z);
  camera.lookAt(targetX, targetY, targetZ);

  // Escape でカーソルロック解除
  if (input.isKeyPressed('Escape')) {
    if (input.isCursorLocked) input.unlockCursor();
    else input.lockCursor();
  }
}
```

#### Turntable.js
```javascript
// モデルの自動回転（ターンテーブル）
let autoRotate = true;
let speed = 30; // 度/秒

function update(dt) {
  // Space でトグル
  if (input.isKeyPressed(' ')) {
    autoRotate = !autoRotate;
    console.log('Auto rotate: ' + (autoRotate ? 'ON' : 'OFF'));
  }

  // 速度調整
  if (input.isKeyPressed('ArrowUp')) speed = Math.min(180, speed + 10);
  if (input.isKeyPressed('ArrowDown')) speed = Math.max(0, speed - 10);

  if (autoRotate) {
    const rot = transform.rotation;
    transform.rotation = { x: rot.x, y: rot.y + speed * dt, z: rot.z };
  }
}
```

## 3ライト照明のセットアップ

```
        Key Light (強) ☀️
           ↘
    Fill (弱) 💡 ← [Model] → 💡 Rim (中)
           ↗
        Camera 🎥
```

| ライト | 役割 | 推奨設定 |
|--------|------|----------|
| Key Light | メインの光源 | Directional, Intensity 2.0 |
| Fill Light | 影を柔らかく | Point, Intensity 0.8 |
| Rim Light | エッジの輪郭 | Point, Intensity 0.5 |

## カスタマイズのヒント

- **背景色**: `EnvironmentSystem` でスカイカラーを変更
- **HDR 風ライティング**: Emissive を使って間接光を模擬
- **モデル切替**: 複数モデルを配置し `entity.setActive(false/true)` で切り替え
- **ポストプロセス**: Bloom をオンにしてハイライトを強調
