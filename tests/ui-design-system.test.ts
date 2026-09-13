import test from 'node:test';
import assert from 'node:assert/strict';
import { uiTokens, UiNotificationQueue, speakerKind, speakerName, compactQuestText } from '../packages/client-runtime/ui-design-tokens.js';
import { mobileDialogueBounds, paginateDialogue } from '../packages/client-runtime/dialogue-layout.js';

test('speaker names and semantic colors distinguish player, NPC and narrator without recoloring body text', () => {
  assert.equal(speakerKind('主角'), 'player');
  assert.equal(speakerName('主角', '林知远'), '林知远');
  assert.equal(speakerKind('陈掌柜'), 'npc');
  assert.equal(speakerKind('旁白'), 'narrator');
  assert.notEqual(uiTokens.colors.speakerPlayer, uiTokens.colors.speakerNpc);
  assert.equal(uiTokens.colors.dialogueBody, '#fff8e8');
});

test('landscape dialogue remains inside safe area and leaves portrait room', () => {
  const bounds = mobileDialogueBounds(960, 540, { left: 32, right: 40, bottom: 20 });
  assert.ok(bounds.width / 960 >= .7 && bounds.width / 960 <= .85);
  assert.ok(bounds.left >= 32 && bounds.right <= 920);
  assert.ok(bounds.height <= 142);
  assert.equal(paginateDialogue('一'.repeat(82), 25, 3).length, 2);
});

test('notification queue shows one result at a time and ignores stale dismissal', () => {
  const queue = new UiNotificationQueue();
  const first = queue.enqueue('result', '购买成功');
  const second = queue.enqueue('toast', '任务推进');
  assert.equal(queue.current()?.id, first.id);
  queue.dismiss(second.id);
  assert.equal(queue.current()?.id, first.id);
  queue.dismiss(first.id);
  assert.equal(queue.current()?.id, second.id);
  queue.dismiss(second.id);
  assert.equal(queue.current(), null);
});

test('quest tracker omits reward and internal progress details', () => {
  assert.equal(compactQuestText({ name: '第一桶金', currentObjective: '将鸣山大米卖给白石商行', completed: false }), '第一桶金\n将鸣山大米卖给白石商行');
});
