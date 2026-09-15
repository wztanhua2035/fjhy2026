import assert from 'node:assert/strict';
import test from 'node:test';
import { containSize, worldOrigin } from '../apps/web-game/src/presentation-layout.js';

test('portraits keep their natural aspect ratio inside the allotted space', () => {
  const portrait = containSize(300, 500, 264, 344);
  assert.ok(Math.abs(portrait.width - 206.4) < 0.001);
  assert.equal(portrait.height, 344);
  assert.deepEqual(containSize(400, 400, 264, 344), { width: 264, height: 264 });
});

test('outdoor origin stays within the image as the player approaches every edge', () => {
  const zoom = 1.08;
  for (const [x, y] of [[0, 0], [1536, 0], [0, 1536], [1536, 1536], [768, 768]]) {
    const origin = worldOrigin(960, 540, 1536, 1536, x, y, zoom);
    const left = (origin.x - 480) * zoom + 480;
    const right = (origin.x + 1536 - 480) * zoom + 480;
    const top = (origin.y - 270) * zoom + 270;
    const bottom = (origin.y + 1536 - 270) * zoom + 270;
    assert.ok(left <= 0 && right >= 960 && top <= 0 && bottom >= 540);
  }
});

test('small indoor maps stay centered on the dark stage', () => {
  assert.deepEqual(worldOrigin(960, 540, 448, 384, 0, 0, 1), { x: 256, y: 78 });
  assert.deepEqual(worldOrigin(960, 540, 448, 384, 448, 384, 1), { x: 256, y: 78 });
});
