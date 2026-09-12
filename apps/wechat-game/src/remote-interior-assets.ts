import { assetUrl, remoteAsset, type InteriorArtAsset } from '../../../packages/client-runtime/index.js';
import { genericInteriorFallback, genericInteriorForeground, loadWechatImage, type WechatAsset, type WechatTextures } from './assets';

type CacheEntry = { version: number; path: string; updatedAt: number };
type CacheIndex = Record<string, CacheEntry>;
const INDEX_FILE = 'fjhy-remote-assets-v1.json';

function diagnosticEnabled(wxRuntime: any) { const version = wxRuntime?.getAccountInfoSync?.()?.miniProgram?.envVersion; return version === 'develop' || version === 'trial'; }
function invoke<T>(fn: (options: any) => void, options: Record<string, unknown>) { return new Promise<T>((resolve, reject) => fn({ ...options, success: resolve, fail: reject })); }

/** V1 cache keeps the index simple; eviction can be added behind this class later. */
export class WechatRemoteAssetCache {
  private index?: CacheIndex;
  constructor(private readonly wxRuntime: any, private readonly assetBaseUrl: string, private readonly retries = 2) {}
  private get fs() { return this.wxRuntime.getFileSystemManager(); }
  private get root() { return this.wxRuntime.env.USER_DATA_PATH; }
  private get indexPath() { return `${this.root}/${INDEX_FILE}`; }
  private async readIndex() {
    if (this.index) return this.index;
    try { this.index = JSON.parse(await invoke<string>(this.fs.readFile.bind(this.fs), { filePath: this.indexPath, encoding: 'utf8' })); }
    catch { this.index = {}; }
    return this.index;
  }
  private async exists(path: string) { try { await invoke(this.fs.access.bind(this.fs), { path }); return true; } catch { return false; } }
  private async writeIndex() { await invoke(this.fs.writeFile.bind(this.fs), { filePath: this.indexPath, data: JSON.stringify(this.index ?? {}), encoding: 'utf8' }); }
  async localPath(resourceId: string) {
    const resource = remoteAsset(resourceId), index = await this.readIndex() ?? {}, cached = index[resourceId];
    if (cached?.version === resource.version && await this.exists(cached.path)) {
      if (diagnosticEnabled(this.wxRuntime)) console.info('[FJHY remote asset] local-cache-hit', { resourceId, relativePath: resource.path, url: assetUrl(resource, this.assetBaseUrl), cachePath: cached.path });
      return cached.path;
    }
    const url = assetUrl(resource, this.assetBaseUrl);
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const result: any = await invoke(this.wxRuntime.downloadFile.bind(this.wxRuntime), { url });
        if (result.statusCode && result.statusCode >= 400) throw new Error(`HTTP ${result.statusCode}`);
        const destination = `${this.root}/${resource.resourceId.toLowerCase()}-v${resource.version}.png`;
        await invoke(this.fs.saveFile.bind(this.fs), { tempFilePath: result.tempFilePath, filePath: destination });
        index[resourceId] = { version: resource.version, path: destination, updatedAt: Date.now() };
        await this.writeIndex();
        if (diagnosticEnabled(this.wxRuntime)) console.info('[FJHY remote asset] remote-download', { resourceId, relativePath: resource.path, url, cachePath: destination });
        return destination;
      } catch (error: any) {
        lastError = error;
        if (diagnosticEnabled(this.wxRuntime)) console.warn('[FJHY remote asset] download failure', { resourceId, url, attempt, errMsg: error?.errMsg ?? error?.message });
      }
    }
    throw lastError ?? new Error(`Download failed: ${resourceId}`);
  }
}

export class WechatInteriorAssetLoader {
  private cache: WechatRemoteAssetCache;
  constructor(private readonly wxRuntime: any, private readonly assetBaseUrl: string) { this.cache = new WechatRemoteAssetCache(wxRuntime, assetBaseUrl); }
  async load(scene: InteriorArtAsset, textures: WechatTextures, createImage: () => any) {
    const diagnostic = diagnosticEnabled(this.wxRuntime);
    const sides = [
      { key: scene.assetKey, resourceId: scene.resourceId, fallback: genericInteriorFallback },
      { key: scene.foreground.assetKey, resourceId: scene.foreground.resourceId, fallback: genericInteriorForeground }
    ];
    let remote = true;
    for (const side of sides) {
      const fallback: WechatAsset = { ...side.fallback, key: side.key };
      try { await loadWechatImage(textures, fallback, createImage, await this.cache.localPath(side.resourceId), diagnostic); }
      catch (remoteError: any) {
        remote = false;
        if (diagnostic) console.warn('[FJHY remote asset] local-fallback', { resourceId: side.resourceId, requestedPath: fallback.path, errMsg: remoteError?.message });
        try { await loadWechatImage(textures, fallback, createImage, fallback.path, diagnostic); }
        catch (fallbackError: any) { throw new Error(`${side.resourceId}: remote and fallback failed (${fallbackError?.errMsg ?? fallbackError?.message ?? 'unknown'})`); }
      }
    }
    return { remote };
  }
}
