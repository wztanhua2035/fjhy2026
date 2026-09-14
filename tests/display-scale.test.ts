import test from 'node:test';
import assert from 'node:assert/strict';
import { actorVisualScale, playerNameTopY, PLAYER_NAME_GAP_PX, PLAYER_NAME_STYLE, OUTDOOR_CAMERA_ZOOM, OUTDOOR_ACTOR_SCALE, INDOOR_ACTOR_SCALE_MULTIPLIER, formatCyclingQuestTracker, baishiV2ArtAssets, worldActorDepth, WORLD_BASE, WORLD_DEPTH_SCALE, ACTOR_BIAS } from '../packages/client-runtime/index.js';

test('室外镜头和室内外人物比例集中配置，脚底锚点及世界深度不变', () => {
  assert.equal(OUTDOOR_CAMERA_ZOOM, 1.08);
  assert.equal(OUTDOOR_ACTOR_SCALE, 1.09);
  assert.equal(INDOOR_ACTOR_SCALE_MULTIPLIER, 1.43);
  assert.equal(actorVisualScale('INTERIOR_B_CLOTH') / actorVisualScale('STREET_BAISHI_01'), 1.43);
  assert.equal(baishiV2ArtAssets.playerMale.footAnchorX, 32);
  assert.equal(baishiV2ArtAssets.playerMale.footAnchorY, 59);
  assert.equal(baishiV2ArtAssets.playerFemale.footAnchorY, 59);
  assert.equal(worldActorDepth(36), WORLD_BASE + 36 * WORLD_DEPTH_SCALE + ACTOR_BIAS);
});

test('玩家名牌始终位于实际缩放后头顶上方，室内外使用同一计算', () => {
  for (const asset of [baishiV2ArtAssets.playerMale, baishiV2ArtAssets.playerFemale]) {
    for (const sceneId of ['STREET_BAISHI_01', 'INTERIOR_B_INN']) {
      const footY = 250, frameOffsetY = 2;
      const spriteTop = footY + frameOffsetY - asset.footAnchorY * asset.renderScale * actorVisualScale(sceneId);
      assert.equal(playerNameTopY(footY, asset.footAnchorY, asset.renderScale, sceneId, frameOffsetY), spriteTop - PLAYER_NAME_GAP_PX);
    }
  }
  assert.ok(PLAYER_NAME_STYLE.backgroundColor);
  assert.notEqual(PLAYER_NAME_STYLE.color, '#445749');
});

test('微信任务切换提示显示真实换行并保持单任务正文', () => {
  assert.equal(formatCyclingQuestTracker('第一桶金', 0, 2), '1/2 · 点击切换任务\n第一桶金');
  assert.equal(formatCyclingQuestTracker('雨前送样', 0, 1), '雨前送样');
});
