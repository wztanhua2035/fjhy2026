/** Public platform boundary. Core gameplay must not import wx.* directly. */
export type PlatformKind = 'web' | 'wechat';
export type PlatformTransport = (path: string, body?: unknown, token?: string) => Promise<any>;
export type LifecycleState = 'show' | 'hide';

export interface PlatformAdapter {
  readonly kind: PlatformKind;
  readonly canLoginWithWeChat: boolean;
  readonly transport: PlatformTransport;
  getLoginCode(): Promise<string>;
  readLocal(key: string): string | null;
  writeLocal(key: string, value: string): void;
  onLifecycle(listener: (state: LifecycleState) => void): () => void;
}