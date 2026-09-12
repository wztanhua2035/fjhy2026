import type { BuildingConfig } from '../shared-types/index.js';

export type SignPlacement = { buildingId: string; assetKey: string; worldX: number; worldY: number; width: number; height: number; frontY: number; templateId: 'horizontal-wood' | 'horizontal-lacquer' };

/** Stable art placement belongs to the building; editable wording stays in BuildingConfig. */
export const baishiShopSignPlacements: SignPlacement[] = [
  { buildingId: 'B_INN', assetKey: 'sign-baishi-inn-v1', worldX: 8.5, worldY: 13.5, width: 164, height: 62, frontY: 17, templateId: 'horizontal-wood' },
  { buildingId: 'B_GROCERY', assetKey: 'sign-baishi-grocery-v1', worldX: 21, worldY: 13.8, width: 158, height: 60, frontY: 17, templateId: 'horizontal-wood' },
  { buildingId: 'B_TRADE', assetKey: 'sign-baishi-trade-v1', worldX: 32.5, worldY: 13.4, width: 170, height: 64, frontY: 17, templateId: 'horizontal-lacquer' },
  { buildingId: 'B_SALON', assetKey: 'sign-baishi-salon-v1', worldX: 43.5, worldY: 13.5, width: 164, height: 62, frontY: 17, templateId: 'horizontal-wood' },
  { buildingId: 'B_CLOTH', assetKey: 'sign-baishi-cloth-v1', worldX: 34, worldY: 30.5, width: 170, height: 64, frontY: 35, templateId: 'horizontal-wood' }
];

export const buildingDisplayName = (building: BuildingConfig) => building.displayName?.trim() || building.name;
export const shouldUseCustomSign = (building: BuildingConfig, resourceId?: string) => building.signMode === 'custom_image' && !!resourceId && building.signResourceId === resourceId;
/** Fits changing names into a readable template without writing screen coordinates in game data. */
export function signTemplateTextStyle(name: string, templateId: SignPlacement['templateId']) {
  const size = name.length > 7 ? 18 : name.length > 5 ? 21 : 25;
  return { text: name, fontSize: size, color: templateId === 'horizontal-lacquer' ? '#f6dea0' : '#f7ead0', backgroundColor: templateId === 'horizontal-lacquer' ? '#742c30' : '#5a4230', padding: { left: 16, right: 16, top: 8, bottom: 8 }, fontFamily: 'STKaiti, KaiTi, serif' };
}
