# クリッカーゲーム テンプレート

> このテンプレートは Project Ludus で「クリッカー/タップゲーム」を作る際のスターターキットです。

## セットアップ手順

### 1. シーン構成
1. **ClickTarget** エンティティ（Sphere または Cube）を作成
   - Script コンポーネントを追加
   - 下記の `ClickTarget.js` をペースト

2. **GameManager** エンティティ（空のオブジェクト）を作成
   - Script コンポーネントを追加
   - 下記の `GameManager.js` をペースト

3. **Camera** エンティティを追加
   - Primary にチェック
   - Position: (0, 3, 8)

### 2. スクリプト

#### GameManager.js
```javascript
// ゲーム管理スクリプト
let scoreText;
let cpsText; // Clicks Per Second
let clickCount = 0;
let totalClicks = 0;
let cpsTimer = 0;

function start() {
  game.set('score', 0);
  game.set('multiplier', 1);
  game.set('autoClickRate', 0);

  // UI 表示
  scoreText = ui.createText('Score: 0', {
    x: 20, y: 20, fontSize: 32, color: '#ffffff', fontWeight: 'bold'
  });

  cpsText = ui.createText('CPS: 0', {
    x: 20, y: 60, fontSize: 18, color: '#aaaaaa'
  });

  // アップグレードボタン
  ui.createButton('x2 Multiplier (100)', () => {
    const score = game.get('score', 0);
    if (score >= 100) {
      game.set('score', score - 100);
      game.set('multiplier', game.get('multiplier', 1) * 2);
      console.log('Multiplier upgraded to x' + game.get('multiplier'));
    }
  }, { x: 20, y: 120, fontSize: 16 });

  ui.createButton('Auto Click (500)', () => {
    const score = game.get('score', 0);
    if (score >= 500) {
      game.set('score', score - 500);
      game.set('autoClickRate', game.get('autoClickRate', 0) + 1);
      console.log('Auto click rate: ' + game.get('autoClickRate') + '/sec');
    }
  }, { x: 20, y: 160, fontSize: 16 });
}

function update(dt) {
  // CPS 計算
  cpsTimer += dt;
  if (cpsTimer >= 1.0) {
    ui.updateText(cpsText, 'CPS: ' + clickCount);
    clickCount = 0;
    cpsTimer = 0;
  }

  // オートクリック
  const autoRate = game.get('autoClickRate', 0);
  if (autoRate > 0) {
    const autoPoints = autoRate * game.get('multiplier', 1) * dt;
    game.set('score', game.get('score', 0) + autoPoints);
  }

  // スコア表示更新
  ui.updateText(scoreText, 'Score: ' + Math.floor(game.get('score', 0)));
}
```

#### ClickTarget.js
```javascript
// クリック対象スクリプト
let bounceTimer = 0;
const originalY = 0;

function start() {
  // 初期位置を記憶
}

function update(dt) {
  // バウンスアニメーション
  if (bounceTimer > 0) {
    bounceTimer -= dt * 5;
    const scale = 1 + Math.sin(bounceTimer * Math.PI) * 0.2;
    transform.scale = { x: scale, y: scale, z: scale };
  }

  // クリック検出
  if (input.mouseLeft) {
    const hit = physics.raycast(
      camera.getPosition(),
      // カメラからマウス方向へのレイは簡易実装
      { x: 0, y: 0, z: -1 },
      100
    );

    // 簡易版: スペースキーでもクリック可能
  }

  if (input.isKeyPressed(' ')) {
    _onClick();
  }
}

function _onClick() {
  const multiplier = game.get('multiplier', 1);
  const score = game.get('score', 0) + multiplier;
  game.set('score', score);

  // バウンスエフェクト
  bounceTimer = 1;

  // 色変更エフェクト
  const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bb5'];
  renderer.setColor(colors[Math.floor(Math.random() * colors.length)]);

  // エミッシブフラッシュ
  renderer.setEmissive('#ffffff', 0.5);
  // 0.2秒後にリセット（簡易）
  setTimeout(() => renderer.setEmissive('#000000', 0), 200);

  console.log('+' + multiplier + ' (Total: ' + score + ')');
}
```

## カスタマイズのヒント

- **パーティクル追加**: ClickTarget にパーティクルを追加し、クリック時に `particles.burst(20)` で演出
- **サウンド追加**: AudioSource を追加し、クリック時に `audio.play()` で効果音
- **Tween 演出**: `tween.to(transform.position, { y: 2 }, 0.3, 'easeOutBounce')` でバウンス
- **スコア保存**: `game.set()` / `game.get()` でセッション中のデータ管理
