import type { LifecycleState, PlatformAdapter, PlatformTransport } from '../../../packages/platform-adapter/index.js';

export function createWebPlatform(apiBase = ''): PlatformAdapter {
  const base = apiBase.replace(/\/$/, '');
  const transport: PlatformTransport = async (path, body, token) => {
    const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message ?? '网络请求失败'), { status: response.status });
    return data;
  };
  return {
    kind: 'web', canLoginWithWeChat: false, transport,
    async getLoginCode() { throw new Error('浏览器开发环境不提供微信登录码'); },
    readLocal(key) { try { return localStorage.getItem(key); } catch { return null; } },
    writeLocal(key, value) { try { localStorage.setItem(key, value); } catch {} },
    onLifecycle(listener) { const change = () => listener(document.visibilityState === 'visible' ? 'show' : 'hide'); document.addEventListener('visibilitychange', change); return () => document.removeEventListener('visibilitychange', change); }
  };
}