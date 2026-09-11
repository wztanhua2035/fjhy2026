export type AssetOrigin = { x: number; y: number };

// World objects sort by their feet/front edge; UI always remains above this range.
export const GROUND_DEPTH = 0;
export const WORLD_BASE = 1000;
export const WORLD_DEPTH_SCALE = 32;
export const ACTOR_BIAS = 1;
export const UI_DEPTH_BASE = 100000;
export const PORTRAIT_DIM_DEPTH = UI_DEPTH_BASE + 100;
export const PORTRAIT_DEPTH = UI_DEPTH_BASE + 110;
export const DEBUG_DEPTH = UI_DEPTH_BASE + 1000;
export const worldActorDepth = (footWorldY: number) => WORLD_BASE + footWorldY * WORLD_DEPTH_SCALE + ACTOR_BIAS;
export const worldBuildingDepth = (occlusionFrontY: number) => WORLD_BASE + occlusionFrontY * WORLD_DEPTH_SCALE;
export const foregroundImagePosition = (asset: BuildingImageAsset, tileSize = 1) => ({
  x: asset.worldX * tileSize - asset.renderWidth * asset.originX + (asset.foreground?.offsetX ?? 0),
  y: asset.worldY * tileSize - asset.renderHeight * asset.originY + (asset.foreground?.offsetY ?? 0)
});

export interface BuildingImageAsset {
  assetKey: string; imagePath: string; worldX: number; worldY: number;
  renderWidth: number; renderHeight: number; originX: number; originY: number;
  depth: number;
  /** World-Y line where actors cross from behind this building to in front of it. */
  occlusionFrontY?: number;
  foreground?: { assetKey: string; imagePath: string; offsetX: number; offsetY: number; depth: number };
  /** World-Y front edge for the optional transparent foreground image. */
  foregroundOcclusionFrontY?: number;
}

export interface SpriteSheetAsset {
  assetKey: string; imagePath: string; frameWidth: number; frameHeight: number;
  columns: number; rows: number; directionRows: Record<'down'|'left'|'right'|'up', number>;
  framesPerDirection: number; footAnchorX: number; footAnchorY: number;
  renderScale: number; startX?: number; startY?: number; frameOffsets?: Record<'down'|'left'|'right'|'up', {x:number;y:number}[]>;
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
  target.drawImage(image, source.sx, source.sy, source.sw, source.sh, x - asset.footAnchorX * asset.renderScale + (asset.frameOffsets?.[direction]?.[frame]?.x??0), y - asset.footAnchorY * asset.renderScale + (asset.frameOffsets?.[direction]?.[frame]?.y??0), source.sw * asset.renderScale, source.sh * asset.renderScale);
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

export const baishiV2ArtAssets = {
  building: { assetKey:'building_baishi_shop_base', imagePath:'/scene-layers/baishi/formal/building_baishi_shop_base.png', worldX:32.5, worldY:20, renderWidth:320, renderHeight:384, originX:0, originY:0, depth:30, occlusionFrontY:19, foreground:{assetKey:'building_baishi_shop_fg',imagePath:'/scene-layers/baishi/formal/building_baishi_shop_fg.png',offsetX:0,offsetY:0,depth:50} },
  npcClerk: {assetKey:'npc_baishi_clerk_walk',imagePath:'/scene-layers/baishi/formal/npc_baishi_clerk_walk.png',frameWidth:64,frameHeight:64,columns:4,rows:4,directionRows:{down:0,left:1,right:2,up:3},framesPerDirection:4,footAnchorX:32,footAnchorY:59,renderScale:1,frameOffsets:{down:[{x:-14,y:0},{x:5,y:0},{x:-5,y:0},{x:8.5,y:0}],left:[{x:-3.5,y:0},{x:-3.5,y:0},{x:5,y:0},{x:8.5,y:0}],right:[{x:-12.5,y:0},{x:4,y:0},{x:-4,y:0},{x:12.5,y:0}],up:[{x:-14,y:0},{x:5.5,y:0},{x:-4.5,y:0},{x:14,y:0}]}},
  playerMale: {assetKey:'player_male_base',imagePath:'/scene-layers/baishi/formal/player_male_base.png',frameWidth:64,frameHeight:64,columns:4,rows:4,directionRows:{down:0,left:1,right:2,up:3},framesPerDirection:4,footAnchorX:32,footAnchorY:59,renderScale:1,frameOffsets:{down:[{x:-13.5,y:0},{x:3,y:0},{x:-2.5,y:0},{x:12,y:0}],left:[{x:-12,y:0},{x:3,y:0},{x:.5,y:0},{x:8.5,y:0}],right:[{x:-12,y:0},{x:2.5,y:0},{x:-3,y:0},{x:5,y:0}],up:[{x:-13.5,y:0},{x:1.5,y:0},{x:-4,y:0},{x:10,y:0}]}},
  playerFemale: {assetKey:'player_female_base',imagePath:'/scene-layers/baishi/formal/player_female_base.png',frameWidth:64,frameHeight:64,columns:4,rows:4,directionRows:{down:0,left:1,right:2,up:3},framesPerDirection:4,footAnchorX:32,footAnchorY:59,renderScale:1,frameOffsets:{down:[{x:-13,y:0},{x:2,y:0},{x:3,y:0},{x:2,y:0}],left:[{x:-13,y:0},{x:3,y:0},{x:6,y:0},{x:0,y:0}],right:[{x:-11.5,y:0},{x:3,y:0},{x:3.5,y:0},{x:6.5,y:0}],up:[{x:-14.5,y:0},{x:2,y:0},{x:1,y:0},{x:7.5,y:0}]}},
  clerkPortrait: {assetKey:'portrait_baishi_clerk_normal',imagePath:'/scene-layers/baishi/formal/portrait_baishi_clerk_normal.png',preferredWidth:330,preferredHeight:430,slot:'right',originX:.5,originY:1}
} as const;
const standardWalk = (assetKey: string, imagePath: string) => ({ assetKey, imagePath, frameWidth:64, frameHeight:64, columns:4, rows:4, directionRows:{down:0,left:1,right:2,up:3}, framesPerDirection:4, footAnchorX:32, footAnchorY:59, renderScale:1, frameOffsets:{down:[{x:0,y:0}],left:[{x:0,y:0}],right:[{x:0,y:0}],up:[{x:0,y:0}]}});

export const hengyangInnV1ArtAssets = {
  building: { assetKey:'building_hengyang_inn_base', imagePath:'/scene-layers/baishi/formal/building_hengyang_inn_base.png', worldX:8.5, worldY:20, renderWidth:320, renderHeight:384, originX:0, originY:0, depth:30, occlusionFrontY:19, foreground:{assetKey:'building_hengyang_inn_fg',imagePath:'/scene-layers/baishi/formal/building_hengyang_inn_fg.png',offsetX:0,offsetY:0,depth:50} },
  shopkeeper: {...standardWalk('npc_chen_shopkeeper_walk','/scene-layers/baishi/formal/npc_chen_shopkeeper_walk.png')},
  portrait: {assetKey:'portrait_chen_shopkeeper_normal',imagePath:'/scene-layers/baishi/formal/portrait_chen_shopkeeper_normal.png',preferredWidth:264,preferredHeight:264,slot:'right',originX:.5,originY:1}
} as const;

export interface FormalBuildingRegistration extends BuildingImageAsset { buildingId: string; }
export interface FormalNpcRegistration extends SpriteSheetAsset { npcId: string; }
export interface FormalPortraitRegistration extends PortraitAsset { speaker: string; }
export const baishiFormalArtRegistry = {
  buildings: [
    { buildingId:'B_TRADE', ...baishiV2ArtAssets.building },
    { buildingId:'B_INN', ...hengyangInnV1ArtAssets.building }
  ] as FormalBuildingRegistration[],
  npcs: [
    { npcId:'NPC_TRADE_CLERK', ...baishiV2ArtAssets.npcClerk },
    { npcId:'NPC_001', ...hengyangInnV1ArtAssets.shopkeeper }
  ] as FormalNpcRegistration[],
  portraits: [
    { speaker:'白石商行伙计', ...baishiV2ArtAssets.clerkPortrait },
    { speaker:'陈掌柜', ...hengyangInnV1ArtAssets.portrait }
  ] as FormalPortraitRegistration[]
};
export const streetGroceryV1ArtAssets = {
  building: { assetKey:'building_street_grocery_base', imagePath:'/scene-layers/baishi/formal/building_street_grocery_base.png', worldX:21, worldY:20, renderWidth:320, renderHeight:384, originX:0, originY:0, depth:30, occlusionFrontY:19, foreground:{assetKey:'building_street_grocery_fg',imagePath:'/scene-layers/baishi/formal/building_street_grocery_fg.png',offsetX:0,offsetY:0,depth:50} },
  assistant: {...standardWalk('npc_shop_assistant_walk','/scene-layers/baishi/formal/npc_shop_assistant_walk.png')},
  portrait: {assetKey:'portrait_shop_assistant_normal',imagePath:'/scene-layers/baishi/formal/portrait_shop_assistant_normal.png',preferredWidth:264,preferredHeight:264,slot:'right',originX:.5,originY:1}
} as const;
baishiFormalArtRegistry.buildings.push({buildingId:'B_GROCERY',...streetGroceryV1ArtAssets.building});
baishiFormalArtRegistry.npcs.push({npcId:'NPC_GROCERY_CLERK',...streetGroceryV1ArtAssets.assistant});
baishiFormalArtRegistry.portraits.push({speaker:'街坊杂货铺店员',...streetGroceryV1ArtAssets.portrait});
export const qingsiHairSalonV1ArtAssets = {
  building: { assetKey:'building_hair_salon_base', imagePath:'/scene-layers/baishi/formal/building_hair_salon_base.png', worldX:39, worldY:7, renderWidth:320, renderHeight:384, originX:0, originY:0, depth:30, occlusionFrontY:19, foreground:{assetKey:'building_hair_salon_fg',imagePath:'/scene-layers/baishi/formal/building_hair_salon_fg.png',offsetX:0,offsetY:0,depth:50} },
  hairdresser: {...standardWalk('npc_hairdresser_walk','/scene-layers/baishi/formal/npc_hairdresser_walk.png')},
  portrait: {assetKey:'portrait_hairdresser_normal',imagePath:'/scene-layers/baishi/formal/portrait_hairdresser_normal.png',preferredWidth:264,preferredHeight:264,slot:'right',originX:.5,originY:1}
} as const;
baishiFormalArtRegistry.buildings.push({buildingId:'B_SALON',...qingsiHairSalonV1ArtAssets.building});
baishiFormalArtRegistry.npcs.push({npcId:'NPC_SALON_HAIRDRESSER',...qingsiHairSalonV1ArtAssets.hairdresser});
baishiFormalArtRegistry.portraits.push({speaker:'青丝美发师',...qingsiHairSalonV1ArtAssets.portrait});
export const chunshanClothShopV1ArtAssets = {
  building: { assetKey:'building_cloth_shop_base', imagePath:'/scene-layers/baishi/formal/building_cloth_shop_base.png?v=cloth-v2', worldX:34, worldY:37, renderWidth:384, renderHeight:320, originX:.5, originY:1, depth:30, occlusionFrontY:37 },
  shopkeeper: {...standardWalk('npc_cloth_shopkeeper_walk','/scene-layers/baishi/formal/npc_cloth_shopkeeper_walk.png')},
  portrait: {assetKey:'portrait_cloth_shopkeeper_normal',imagePath:'/scene-layers/baishi/formal/portrait_cloth_shopkeeper_normal.png',preferredWidth:264,preferredHeight:264,slot:'right',originX:.5,originY:1}
} as const;
baishiFormalArtRegistry.buildings.push({buildingId:'B_CLOTH',...chunshanClothShopV1ArtAssets.building});
baishiFormalArtRegistry.npcs.push({npcId:'NPC_CLOTH_SHOPKEEPER',...chunshanClothShopV1ArtAssets.shopkeeper});
baishiFormalArtRegistry.portraits.push({speaker:'春衫掌柜',...chunshanClothShopV1ArtAssets.portrait});
