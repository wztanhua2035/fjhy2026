import type {Gender} from '../shared-types/index.js';

/** Reserved appearance slot. There are no equipable headwear assets in V1. */
export interface HeadwearConfig {
  headwearId:string; gender?:Gender; displayName:string;
  assetResourceId:string; enabled:boolean; sortOrder:number;
}
export const headwearConfigs:HeadwearConfig[]=[];
