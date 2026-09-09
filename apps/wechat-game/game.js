require('./libs/weapp-adapter.js');
const root = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
// Phaser checks this constructor before it uses the Canvas supplied by WeChat.
const runtimeWindow = typeof window !== 'undefined' ? window : root;
root.__fjhyWechatCanvas = runtimeWindow.canvas || root.canvas;
if (!root.__fjhyWechatCanvas || !root.__fjhyWechatCanvas.getContext('2d')) {
  throw new Error('FJHY: visible WeChat Canvas unavailable');
}
if (!runtimeWindow.CanvasRenderingContext2D) {
  runtimeWindow.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
}
require('./game.bundle.js');
