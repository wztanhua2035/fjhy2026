export type AssetOrigin = { x: number; y: number };

export interface BuildingImageAsset {
  assetKey: string; imagePath: string; worldX: number; worldY: number;
  renderWidth: number; renderHeight: number; originX: number; originY: number;
  depth: number;
  foreground?: { assetKey: string; imagePath: string; offsetX: number; offsetY: number; depth: number };
}

export interface SpriteSheetAsset {
  assetKey: string; imagePath: string; frameWidth: number; frameHeight: number;
  columns: number; rows: number; directionRows: Record<'down'|'left'|'right'|'up', number>;
  framesPerDirection: number; footAnchorX: number; footAnchorY: number;
  renderScale: number; startX?: number; startY?: number;
}

export interface PortraitAsset {
  assetKey: string; imagePath: string; preferredWidth: number; preferredHeight: number;
  slot: 'left'|'right'; originX: number; originY: number;
}

export interface ImageSource { width: number; height: number; }
export interface ImageDrawTarget { drawImage(image: ImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void; }

export function spriteFrame(asset: SpriteSheetAsset, direction: 'down'|'left'|'right'|'up', frame: number) {
  const column = Math.max(0, Math.min(asset.framesPerDirection - 1, frame));
  const row = asset.directionRows[direction];
  return { sx: (asset.startX ?? 0) + column * asset.frameWidth, sy: (asset.startY ?? 0) + row * asset.frameHeight, sw: asset.frameWidth, sh: asset.frameHeight };
}

export function drawBuildingAsset(target: ImageDrawTarget, image: ImageSource, asset: BuildingImageAsset) {
  target.drawImage(image, 0, 0, image.width, image.height, asset.worldX - asset.renderWidth * asset.originX, asset.worldY - asset.renderHeight * asset.originY, asset.renderWidth, asset.renderHeight);
}

export function drawSpriteSheet(target: ImageDrawTarget, image: ImageSource, asset: SpriteSheetAsset, direction: 'down'|'left'|'right'|'up', frame: number, x: number, y: number) {
  const source = spriteFrame(asset, direction, frame);
  target.drawImage(image, source.sx, source.sy, source.sw, source.sh, x - asset.footAnchorX * asset.renderScale, y - asset.footAnchorY * asset.renderScale, source.sw * asset.renderScale, source.sh * asset.renderScale);
}

export function drawSpriteSheetOrFallback(target: ImageDrawTarget, image: ImageSource|undefined, asset: SpriteSheetAsset, direction: 'down'|'left'|'right'|'up', frame: number, x: number, y: number, fallback: () => void) { if(image) drawSpriteSheet(target,image,asset,direction,frame,x,y); else fallback(); }

export interface PortraitState { portraitMode: boolean; backgroundDim: boolean; left?: PortraitAsset; right?: PortraitAsset; speaking?: 'left'|'right'; }
export const emptyPortraitState = (): PortraitState => ({ portraitMode: false, backgroundDim: false });
export function portraitState(left?: PortraitAsset, right?: PortraitAsset, speaking?: 'left'|'right'): PortraitState { return { portraitMode: true, backgroundDim: true, left, right, speaking }; }

export class ImageAssetStore {
  private images = new Map<string, ImageSource>();
  async load(assetKey: string, loader: () => Promise<ImageSource>) { const image = await loader(); this.images.set(assetKey, image); return image; }
  set(assetKey: string, image: ImageSource) { this.images.set(assetKey, image); }
  get(assetKey: string) { return this.images.get(assetKey); }
  has(assetKey: string) { return this.images.has(assetKey); }
}
