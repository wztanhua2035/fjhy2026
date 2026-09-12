import test from 'node:test';
import assert from 'node:assert/strict';
import { paginateDialogue, mobileDialogueBounds, DIALOGUE_PORTRAIT_SCALE, JOYSTICK_VISUAL_SCALE, JOYSTICK_HIT_SCALE } from '../packages/client-runtime/index.js';

test('长中文对白分为不超过三行的页面，不截断内容', () => {
  const text = '春衫掌柜：这批新布刚到，我还拿不准颜色。你若顺路，帮我送一块给青丝美发师看看。她的配色眼光向来很准。请把她的意见仔细记下，回来再告诉我，我们也好在雨季到来之前把新衣的颜色定下来。';
  const pages = paginateDialogue(text, 18, 3);
  assert.ok(pages.length > 1);
  assert.ok(pages.every(page => page.split('\n').length <= 3));
  assert.equal(pages.join('').replaceAll('\n', ''), text);
});

test('对白框处于横屏安全边距内，触摸区大于摇杆视觉盘', () => {
  const box = mobileDialogueBounds(960, 540, { left: 20, right: 20, bottom: 20 });
  assert.ok(box.left >= 20 && box.right <= 940);
  assert.ok(box.top > 300 && box.bottom <= 520);
  assert.ok(box.height >= 135 && box.height <= 162);
  assert.equal(DIALOGUE_PORTRAIT_SCALE, 1.15);
  assert.equal(JOYSTICK_VISUAL_SCALE, 1.15);
  assert.equal(JOYSTICK_HIT_SCALE, 1.24);
  assert.ok(JOYSTICK_HIT_SCALE > JOYSTICK_VISUAL_SCALE);
});
