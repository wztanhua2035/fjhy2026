import type {Gender, WorldConfig} from '../shared-types/index.js';

export interface HairConfig {
  hairId:string; gender:Gender; displayName:string; description?:string;
  assetResourceId:string; enabled:boolean; sortOrder:number;
}
export interface HairServiceOffer {
  serviceId:string; shopId:string; hairId:string; price:number; enabled:boolean; sortOrder:number;
}
export const hairConfigs:HairConfig[]=(['MALE','FEMALE'] as const).flatMap(gender=>{
  const prefix=gender==='MALE'?'M':'F';
  const names=gender==='MALE'?['竖起短发·蓝黑','规整中短发·蓝黑','蓬松侧后束·蓝黑']:['自然垂落发','高束长卷发','蓝丝带双丸子头'];
  return names.map((displayName,index)=>({hairId:`${prefix}_HAIR_0${index+1}`,gender,displayName,assetResourceId:`PLAYER_${prefix}_HAIR_0${index+1}`,enabled:true,sortOrder:index}));
});
// V1 待真机验证的服务费；发型本身不拥有价格。
export const hairServiceOffers:HairServiceOffer[]=hairConfigs.map(hair=>({serviceId:`SALON_${hair.hairId}`,shopId:'B_SALON',hairId:hair.hairId,price:[24,36,48][hair.sortOrder],enabled:true,sortOrder:hair.sortOrder}));
export function hairServiceConfig(world:Pick<WorldConfig,'hairs'|'hairServiceOffers'>){
  return {hairs:world.hairs??hairConfigs,offers:world.hairServiceOffers??hairServiceOffers};
}
