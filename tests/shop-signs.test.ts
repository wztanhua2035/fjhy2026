import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { initialWorld } from '../packages/game-config/index.js';
import { remoteAssetManifest } from '../packages/client-runtime/remote-assets.js';
import { baishiShopSignPlacements, buildingDisplayName, shouldUseCustomSign, signTemplateTextStyle } from '../packages/client-runtime/shop-signs.js';

const root = process.cwd();
test('五家核心建筑将稳定 ID、展示名称和自定义远程招牌分离', () => {
  const core = initialWorld.buildings.filter(building => baishiShopSignPlacements.some(sign => sign.buildingId === building.id));
  assert.equal(core.length, 5);
  for (const building of core) {
    assert.ok(building.id.startsWith('B_'));
    assert.equal(buildingDisplayName(building), building.name);
    assert.equal(building.signMode, 'custom_image');
    assert.ok(building.signResourceId);
    assert.equal(shouldUseCustomSign(building, building.signResourceId), true);
    const resource = remoteAssetManifest.resources[building.signResourceId!];
    assert.equal(resource.type, 'shop-sign');
    assert.ok(statSync(join(root, 'assets/remote', resource.path)).size > 0);
  }
});

test('招牌模板会在自定义资源失效时保留可读的短名称布局', () => {
  assert.equal(baishiShopSignPlacements.length, 5);
  const short = signTemplateTextStyle('白石商行', 'horizontal-lacquer');
  const long = signTemplateTextStyle('横阳客栈远房亲戚店', 'horizontal-wood');
  assert.ok(short.fontSize > long.fontSize);
  assert.match(short.fontFamily, /KaiTi/);
});
