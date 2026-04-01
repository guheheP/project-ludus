# 放置シミュレーション テンプレート

> 時間経過で自動的に資源が生成される放置（アイドル）ゲームのテンプレートです。

## セットアップ手順

### 1. シーン構成
1. **GameManager** エンティティ（空オブジェクト）を作成
   - Script コンポーネントを追加
   - 下記の `IdleManager.js` をペースト

2. **Generator** エンティティ（Cube）を作成
   - 見た目の資源生成機（工場や鉱山など）
   - Script コンポーネントを追加
   - 下記の `Generator.js` をペースト
   - ParticleEmitter を追加（生成エフェクト用）

3. **Camera** エンティティを追加
   - Primary にチェック
   - Position: (0, 5, 10)

### 2. スクリプト

#### IdleManager.js
```javascript
// 放置ゲーム管理
let goldText, rateText, upgradeInfo;

function start() {
  game.set('gold', 0);
  game.set('goldPerSec', 1);
  game.set('generatorLevel', 1);
  game.set('upgradeCost', 50);

  // UI
  goldText = ui.createText('💰 Gold: 0', {
    x: 20, y: 20, fontSize: 28, color: '#ffd700', fontWeight: 'bold'
  });

  rateText = ui.createText('⚡ 1 gold/sec', {
    x: 20, y: 55, fontSize: 16, color: '#aaaaaa'
  });

  upgradeInfo = ui.createText('Lv.1', {
    x: 20, y: 85, fontSize: 14, color: '#888888'
  });

  // アップグレードボタン
  ui.createButton('⬆ Upgrade Generator', () => {
    const gold = game.get('gold', 0);
    const cost = game.get('upgradeCost', 50);
    if (gold >= cost) {
      game.set('gold', gold - cost);
      const level = game.get('generatorLevel', 1) + 1;
      game.set('generatorLevel', level);
      game.set('goldPerSec', Math.floor(level * 1.5));
      game.set('upgradeCost', Math.floor(cost * 1.8));
      console.log('Generator upgraded to Lv.' + level);
    } else {
      console.log('Not enough gold! Need ' + cost);
    }
  }, { x: 20, y: 130, fontSize: 16 });

  // プレステージボタン
  ui.createButton('🔄 Prestige (1000g)', () => {
    const gold = game.get('gold', 0);
    if (gold >= 1000) {
      const prestige = game.get('prestigeLevel', 0) + 1;
      game.set('prestigeLevel', prestige);
      game.set('gold', 0);
      game.set('generatorLevel', 1);
      game.set('goldPerSec', Math.floor(1 * (1 + prestige * 0.5)));
      game.set('upgradeCost', 50);
      console.log('Prestige! Level ' + prestige + ' — bonus: x' + (1 + prestige * 0.5).toFixed(1));
    }
  }, { x: 20, y: 170, fontSize: 16 });
}

function update(dt) {
  // 自動資源生成
  const rate = game.get('goldPerSec', 1);
  const gold = game.get('gold', 0) + rate * dt;
  game.set('gold', gold);

  // UI更新
  ui.updateText(goldText, '💰 Gold: ' + Math.floor(gold));
  ui.updateText(rateText, '⚡ ' + rate + ' gold/sec');

  const level = game.get('generatorLevel', 1);
  const cost = game.get('upgradeCost', 50);
  const prestige = game.get('prestigeLevel', 0);
  ui.updateText(upgradeInfo,
    'Lv.' + level + ' | Next: ' + cost + 'g' +
    (prestige > 0 ? ' | ★ Prestige ' + prestige : '')
  );
}
```

#### Generator.js
```javascript
// 資源生成機の演出スクリプト
let pulseTimer = 0;
let spawnTimer = 0;

function start() {
  // 発光設定
  renderer.setEmissive('#ffd700', 0.3);
}

function update(dt) {
  // パルスアニメーション（呼吸するような発光）
  pulseTimer += dt;
  const intensity = 0.2 + Math.sin(pulseTimer * 2) * 0.15;
  renderer.setEmissive('#ffd700', intensity);

  // 一定間隔でパーティクル放出
  const rate = game.get('goldPerSec', 1);
  const interval = Math.max(0.2, 2.0 / rate); // 生成速度に応じて頻度アップ
  spawnTimer += dt;
  if (spawnTimer >= interval) {
    spawnTimer = 0;
    if (particles) {
      particles.burst(Math.min(rate, 30));
    }
  }

  // レベルに応じてスケール変化
  const level = game.get('generatorLevel', 1);
  const s = 1 + Math.log(level) * 0.2;
  transform.scale = { x: s, y: s, z: s };

  // レベルに応じて色変化
  if (level >= 10) {
    renderer.setColor('#ff6b6b'); // 赤
  } else if (level >= 5) {
    renderer.setColor('#ffd93d'); // 黄
  }
}
```

## カスタマイズのヒント

- **複数ジェネレーター**: Generator を複製して別々のリソース（木材、石、鉄）を生産
- **オフライン進行**: `time.elapsed` を使って「離席時間分のボーナス資源」を計算
- **Tween 演出**: アップグレード時に `tween.to(transform.scale, { x: 1.5, y: 1.5, z: 1.5 }, 0.3, 'easeOutBounce')` でフィードバック
- **プレステージ**: ゲームリセット＋永続ボーナスのメタ進行
- **サウンド**: 資源獲得時に `audio.play()` で効果音を追加
