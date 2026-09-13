import type {Gender, WorldConfig} from '../shared-types/index.js';

export interface OutfitConfig {outfitId:string;gender:Gender;displayName:string;description?:string;assetResourceId:string;enabled:boolean;sortOrder:number}
export interface OutfitOffer {shopId:string;outfitId:string;price:number;enabled:boolean;sortOrder:number}

const names={MALE:['青灰便装','白石工装','深蓝长衫'],FEMALE:['浅粉便装','青绿短衫裙','靛蓝长裙']} as const;
export const outfitConfigs:OutfitConfig[]=(['MALE','FEMALE'] as const).flatMap(gender=>names[gender].map((displayName,index)=>({
  outfitId:`${gender==='MALE'?'M':'F'}_OUTFIT_0${index+1}`,gender,displayName,
  description:'一整套日常服装',assetResourceId:`PLAYER_${gender==='MALE'?'M':'F'}_OUTFIT_0${index+1}`,enabled:true,sortOrder:index
})));
// 首轮测试价。Outfit 是永久资产，价格只存放在销售配置中。
export const outfitOffers:OutfitOffer[]=outfitConfigs.map(outfit=>({shopId:'B_CLOTH',outfitId:outfit.outfitId,price:[70,110,150][outfit.sortOrder],enabled:true,sortOrder:outfit.sortOrder}));
export function outfitShopConfig(world:Pick<WorldConfig,'outfits'|'outfitOffers'>){return {outfits:world.outfits??outfitConfigs,offers:world.outfitOffers??outfitOffers};}
