import { baishiFormalArtRegistry, baishiInteriorArtRegistry, baishiV2ArtAssets } from '../../../packages/client-runtime/assets.js';

export interface WechatAsset { key: string; source: string; path: string; frameWidth?: number; frameHeight?: number }
export function packagedAssetPath(source: string) {
  const file = source.split('?')[0].split('/').pop()!;
  const interior = source.includes('/interiors/') ? file.match(/^interior_([a-z]+)_/)?.[1] : undefined;
  const root = source.includes('/ground/') ? 'baishi-ground' : interior ? `baishi-interior-${interior}` : file.startsWith('portrait_') ? 'baishi-portraits' : 'baishi-world';
  return `${root}/${file}`;
}
export const wechatAssets: WechatAsset[] = [
  { key: 'baishi-ground-image', source: '/scene-layers/baishi/ground/baishi_composition_approved_v01.png' },
  ...baishiInteriorArtRegistry.flatMap(asset => [{ key: asset.assetKey, source: asset.imagePath }, { key: asset.foreground.assetKey, source: asset.foreground.imagePath }]),
  ...baishiFormalArtRegistry.buildings.flatMap(a => [{ key: a.assetKey, source: a.imagePath }, ...(a.foreground && a.foregroundOcclusionFrontY !== undefined ? [{ key: a.foreground.assetKey, source: a.foreground.imagePath }] : [])]),
  ...baishiFormalArtRegistry.npcs.map(a => ({ key: a.assetKey, source: a.imagePath, frameWidth: a.frameWidth, frameHeight: a.frameHeight })),
  ...[baishiV2ArtAssets.playerMale, baishiV2ArtAssets.playerFemale].map(a => ({ key: a.assetKey, source: a.imagePath, frameWidth: a.frameWidth, frameHeight: a.frameHeight })),
  ...baishiFormalArtRegistry.portraits.map(a => ({ key: a.assetKey, source: a.imagePath })),
  ...['male', 'female'].map(g => ({ key: `portrait-player-${g}`, source: `/scene-layers/baishi/formal/portrait_player_${g}_base.png` }))
].map(a => ({ ...a, path: packagedAssetPath(a.source) }));

// Package images must use wx.createImage, never wx.request / Blob URLs.
export async function loadWechatAssets(textures: { exists(key: string): boolean; addImage(key: string, image: any): unknown; addSpriteSheet(key: string, image: any, config: any): unknown }, createImage: () => any, progress: (done: number, total: number) => void = () => {}) {
  let done = 0;
  const failures: string[] = [];
  for (const asset of wechatAssets) {
    if (!textures.exists(asset.key)) {
      try {
        const image = await new Promise<any>((resolve, reject) => {
          const image = createImage();
          const timer = setTimeout(() => reject(new Error('image timeout')), 15000);
          image.onload = () => { clearTimeout(timer); resolve(image); };
          image.onerror = () => { clearTimeout(timer); reject(new Error(asset.path)); };
          image.src = asset.path;
        });
        if (asset.frameWidth) textures.addSpriteSheet(asset.key, image, { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight });
        else textures.addImage(asset.key, image);
        if (!textures.exists(asset.key)) throw new Error('Texture registration failed');
      } catch { failures.push(asset.path); }
    }
    progress(++done, wechatAssets.length);
  }
  return failures;
}
