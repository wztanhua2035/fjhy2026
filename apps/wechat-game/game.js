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
const packageNames = ['baishi-ground', 'baishi-world', 'baishi-portraits',
  'baishi-interior-salon', 'baishi-interior-grocery', 'baishi-interior-trade',
  'baishi-interior-cloth', 'baishi-interior-inn', 'baishi-interior-guest'];
const envVersion = wx.getAccountInfoSync?.()?.miniProgram?.envVersion;
const diagnostic = envVersion === 'develop' || envVersion === 'trial';
Promise.all(packageNames.map((name) => new Promise((resolve, reject) => {
  if (diagnostic) console.info('[FJHY asset] loading subpackage', { name, root: name });
  wx.loadSubpackage({
    name,
    success: (result) => { if (diagnostic) console.info('[FJHY asset] subpackage success', { name, root: name }); resolve(result); },
    fail: (error) => { if (diagnostic) console.error('[FJHY asset] subpackage failure', { name, root: name, errMsg: error?.errMsg }); reject(new Error(`FJHY: failed to load ${name}: ${error?.errMsg || 'unknown error'}`)); },
  });
}))).then(() => require('./game.bundle.js')).catch((error) => {
  console.error(error);
  throw error;
});
