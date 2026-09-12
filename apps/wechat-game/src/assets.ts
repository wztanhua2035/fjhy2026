import { baishiFormalArtRegistry, baishiV2ArtAssets } from '../../../packages/client-runtime/assets.js';

export interface WechatAsset { key: string; source: string; path: string; frameWidth?: number; frameHeight?: number }
export const WECHAT_STARTUP_PACKAGE_ROOTS = ['baishi-ground', 'baishi-world', 'baishi-portraits'] as const;
export function packagedAssetPath(source: string) {
  const file = source.split('?')[0].split('/').pop()!;
  const interior = source.includes('/interiors/') ? file.match(/^interior_([a-z]+)_/)?.[1] : undefined;
  const root = source.includes('/ground/') ? 'baishi-ground' : interior ? `baishi-interior-${interior}` : file.startsWith('portrait_') ? 'baishi-portraits' : 'baishi-world';
  return `${root}/${file}`;
}
const packaged = (asset: Omit<WechatAsset, 'path'>): WechatAsset => ({ ...asset, path: packagedAssetPath(asset.source) });

/** Resources needed to render startup and Baishi street. Interiors load on demand. */
export const wechatStartupAssets: WechatAsset[] = [
  { key: 'baishi-ground-image', source: '/scene-layers/baishi/ground/baishi_composition_approved_v01.png' },
  ...baishiFormalArtRegistry.buildings.flatMap(a => [{ key: a.assetKey, source: a.imagePath }, ...(a.foreground && a.foregroundOcclusionFrontY !== undefined ? [{ key: a.foreground.assetKey, source: a.foreground.imagePath }] : [])]),
  ...baishiFormalArtRegistry.npcs.map(a => ({ key: a.assetKey, source: a.imagePath, frameWidth: a.frameWidth, frameHeight: a.frameHeight })),
  ...[baishiV2ArtAssets.playerMale, baishiV2ArtAssets.playerFemale].map(a => ({ key: a.assetKey, source: a.imagePath, frameWidth: a.frameWidth, frameHeight: a.frameHeight })),
  ...baishiFormalArtRegistry.portraits.map(a => ({ key: a.assetKey, source: a.imagePath })),
  ...['male', 'female'].map(g => ({ key: `portrait-player-${g}`, source: `/scene-layers/baishi/formal/portrait_player_${g}_base.png` })),
  { key: 'generic-interior-fallback', source: '/scene-layers/baishi/interiors/generic_interior_fallback.png' },
  { key: 'generic-interior-foreground', source: '/scene-layers/baishi/interiors/generic_interior_foreground.png' }
].map(packaged);

export const genericInteriorFallback = packaged({ key: 'generic-interior-fallback', source: '/scene-layers/baishi/interiors/generic_interior_fallback.png' });
export const genericInteriorForeground = packaged({ key: 'generic-interior-foreground', source: '/scene-layers/baishi/interiors/generic_interior_foreground.png' });

/** Full build inventory. Interiors use CDN/cache and share a low-cost local fallback. */
export const wechatAssets = wechatStartupAssets;
export type WechatTextures = { exists(key: string): boolean; addImage(key: string, image: any): unknown; addSpriteSheet(key: string, image: any, config: any): unknown };

export async function loadWechatImage(textures: WechatTextures, asset: WechatAsset, createImage: () => any, source = asset.path, diagnostic = false) {
  if (textures.exists(asset.key)) return;
  const image = await new Promise<any>((resolve, reject) => {
    const image = createImage();
    const timer = setTimeout(() => reject(new Error('image timeout')), 15000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = (error: any) => { clearTimeout(timer); if (diagnostic) console.error('[FJHY asset] image failure', { requestedPath: asset.path, imageSrc: source, errMsg: error?.errMsg }); reject(new Error(source)); };
    if (diagnostic) console.info('[FJHY asset] image request', { requestedPath: asset.path, imageSrc: source });
    image.src = source;
  });
  if (asset.frameWidth) textures.addSpriteSheet(asset.key, image, { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight });
  else textures.addImage(asset.key, image);
  if (!textures.exists(asset.key)) throw new Error('Texture registration failed');
}

// Package images must use wx.createImage, never wx.request / Blob URLs.
export async function loadWechatAssets(textures: WechatTextures, createImage: () => any, progress: (done: number, total: number) => void = () => {}) {
  let done = 0;
  const failures: string[] = [];
  const wxRuntime = (globalThis as any).wx;
  const envVersion = wxRuntime?.getAccountInfoSync?.()?.miniProgram?.envVersion;
  const diagnostic = envVersion === 'develop' || envVersion === 'trial';
  for (const asset of wechatStartupAssets) {
    if (!textures.exists(asset.key)) {
      try {
        await loadWechatImage(textures, asset, createImage, asset.path, diagnostic);
      } catch { failures.push(asset.path); }
    }
    progress(++done, wechatStartupAssets.length);
  }
  return failures;
}
