import type { LifecycleState, PlatformAdapter, PlatformTransport } from '../../../packages/platform-adapter/index.js';

declare const wx: any;

export function allowWechatDebug(buildEnabled: boolean, envVersion: string | undefined) {
  return buildEnabled && envVersion === 'develop';
}

export function wechatRequestHeaders(token = '', debugOpenAll = false) {
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(debugOpenAll ? { 'X-Debug-Open-All': '1' } : {}) };
}

export function createWeChatPlatform(apiBase: string, options: { debugOpenAll?: boolean } = {}): PlatformAdapter {
  const base = apiBase.replace(/\/$/, '');
  const transport: PlatformTransport = (path, body, token) => new Promise((resolve, reject) => {
    wx.request({
      url: `${base}${path}`,
      method: body ? 'POST' : 'GET',
      header: wechatRequestHeaders(token, allowWechatDebug(!!options.debugOpenAll, wx.getAccountInfoSync?.().miniProgram?.envVersion)),
      data: body,
      timeout: 10000,
      success: (result: any) => result.statusCode >= 200 && result.statusCode < 300
        ? resolve(result.data)
        : reject(Object.assign(new Error(result.data?.message ?? '请求失败'), { status: result.statusCode })),
      fail: () => reject(new Error('网络连接中断，请检查网络后重试。')),
    });
  });
  return {
    kind: 'wechat',
    canLoginWithWeChat: true,
    transport,
    getLoginCode: () => new Promise((resolve, reject) => wx.login({ success: (value: any) => resolve(value.code), fail: reject })),
    readLocal: (key) => { try { return String(wx.getStorageSync(key) || '') || null; } catch { return null; } },
    writeLocal: (key, value) => { try { wx.setStorageSync(key, value); } catch {} },
    onLifecycle: (listener: (state: LifecycleState) => void) => {
      const show = () => listener('show'); const hide = () => listener('hide');
      wx.onShow(show); wx.onHide(hide);
      return () => { wx.offShow(show); wx.offHide(hide); };
    },
  };
}

export function scaleSafeInsets(info: { windowWidth?: number; windowHeight?: number; safeArea?: { left: number; right: number; top: number; bottom: number } }, width: number, height: number) {
  const safe = info.safeArea;
  if (!safe || !info.windowWidth || !info.windowHeight) return { left: 0, right: 0, top: 0, bottom: 0 };
  return { left: safe.left / info.windowWidth * width, right: (info.windowWidth - safe.right) / info.windowWidth * width, top: safe.top / info.windowHeight * height, bottom: (info.windowHeight - safe.bottom) / info.windowHeight * height };
}

export function safeInsets(width: number, height: number) {
  try { return scaleSafeInsets(wx.getWindowInfo?.() ?? wx.getSystemInfoSync(), width, height); }
  catch { return { left: 0, right: 0, top: 0, bottom: 0 }; }
}
