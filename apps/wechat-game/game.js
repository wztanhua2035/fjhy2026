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
const packageNames = ['baishi-ground', 'baishi-world', 'baishi-portraits'];
Promise.all(packageNames.map((name) => new Promise((resolve, reject) => {
  wx.loadSubpackage({
    name,
    success: resolve,
    fail: (error) => reject(new Error(`FJHY: failed to load ${name}: ${error?.errMsg || 'unknown error'}`)),
  });
}))).then(() => require('./game.bundle.js')).catch((error) => {
  console.error(error);
  throw error;
});
