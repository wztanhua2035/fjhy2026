import type { Rect } from '../shared-types/index.js';

export type BaishiLayerName = 'ground' | 'buildings' | 'decorations_back' | 'npcs' | 'foreground';
export type BaishiLayerPlacement = Rect & { asset: string; layer: BaishiLayerName; z: number; enabled: boolean };

export const baishiLayerAssetPaths: Record<string,string> = {
  baishi_composition_approved_v01: 'ground/baishi_composition_approved_v01.png',
  baishi_ground_candidate_v01: 'ground/baishi_ground_candidate_v01.png',
  baishi_buildings_candidate_v01: 'buildings/baishi_buildings_candidate_v01.png',
  baishi_buildings_north_candidate_v01: 'buildings/baishi_buildings_north_candidate_v01.png',
  baishi_buildings_south_candidate_v01: 'buildings/baishi_buildings_south_candidate_v01.png',
  foreground_branch_01: 'foreground_branch_01.png',
  foreground_tree_canopy_01: 'foreground_tree_canopy_01.png',
  foreground_eave_inn_01: 'foreground_eave_inn_01.png',
  foreground_eave_shop_01: 'foreground_eave_shop_01.png',
  baishi_building_inn_candidate_v01: 'buildings/baishi_building_inn_candidate_v01.png',
  baishi_building_grocery_candidate_v01: 'buildings/baishi_building_grocery_candidate_v01.png',
  baishi_building_trade_candidate_v01: 'buildings/baishi_building_trade_candidate_v01.png',
  baishi_building_salon_candidate_v01: 'buildings/baishi_building_salon_candidate_v01.png',
  baishi_building_house_left_candidate_v01: 'buildings/baishi_building_house_left_candidate_v01.png',
  baishi_building_stall_candidate_v01: 'buildings/baishi_building_stall_candidate_v01.png',
  baishi_building_cloth_candidate_v01: 'buildings/baishi_building_cloth_candidate_v01.png',
  baishi_building_house_right_candidate_v01: 'buildings/baishi_building_house_right_candidate_v01.png'
};

/** 白石街资源挂载表。坐标与碰撞/入口配置使用同一张 48×48 网格。 */
export const baishiBuildingLayerBindings={
  B_INN:'baishi_building_inn_candidate_v01',
  B_GROCERY:'baishi_building_grocery_candidate_v01',
  B_TRADE:'baishi_building_trade_candidate_v01',
  B_SALON:'baishi_building_salon_candidate_v01',
  B_CLOTH:'baishi_building_cloth_candidate_v01'
} as const;

export const baishiLayerPlacements: BaishiLayerPlacement[] = [
  // 合成样图暂时作为 ground 基准，后续替换为独立透明图层时保持同一渲染顺序。
  { asset: 'baishi_composition_approved_v01', layer: 'ground', z: 0, enabled: true, x: 0, y: 0, width: 48, height: 48 },
  { asset: 'baishi_ground_candidate_v01', layer: 'ground', z: 0, enabled: false, x: 0, y: 0, width: 48, height: 48 },
  { asset: 'baishi_buildings_candidate_v01', layer: 'buildings', z: 20, enabled: false, x: 0, y: 0, width: 48, height: 48 },
  { asset: 'baishi_buildings_north_candidate_v01', layer: 'buildings', z: 20, enabled: false, x: 0, y: 0, width: 48, height: 48 },
  { asset: 'baishi_buildings_south_candidate_v01', layer: 'buildings', z: 21, enabled: false, x: 0, y: 0, width: 48, height: 48 },
  { asset: 'baishi_building_inn_candidate_v01', layer: 'buildings', z: 30, enabled: false, x: 0, y: 0, width: 48, height: 48 },
  { asset: 'baishi_building_grocery_candidate_v01', layer: 'buildings', z: 31, enabled: false, x: 0, y: 0, width: 48, height: 48 },
  { asset: 'baishi_building_trade_candidate_v01', layer: 'buildings', z: 32, enabled: false, x: 0, y: 0, width: 48, height: 48 },
  { asset: 'baishi_building_salon_candidate_v01', layer: 'buildings', z: 33, enabled: false, x: 0, y: 0, width: 48, height: 48 },
  { asset: 'baishi_building_house_left_candidate_v01', layer: 'buildings', z: 34, enabled: false, x: 0, y: 0, width: 48, height: 48 },
  { asset: 'baishi_building_stall_candidate_v01', layer: 'buildings', z: 35, enabled: false, x: 0, y: 0, width: 48, height: 48 },
  { asset: 'baishi_building_cloth_candidate_v01', layer: 'buildings', z: 36, enabled: false, x: 0, y: 0, width: 48, height: 48 },
  { asset: 'baishi_building_house_right_candidate_v01', layer: 'buildings', z: 37, enabled: false, x: 0, y: 0, width: 48, height: 48 },
  { asset: 'foreground_branch_01', layer: 'foreground', z: 50, enabled: false, x: 0, y: 0, width: 24, height: 12 },
  { asset: 'foreground_tree_canopy_01', layer: 'foreground', z: 51, enabled: false, x: 0, y: 0, width: 24, height: 12 },
  { asset: 'foreground_eave_inn_01', layer: 'foreground', z: 52, enabled: false, x: 0, y: 0, width: 32, height: 16 },
  { asset: 'foreground_eave_shop_01', layer: 'foreground', z: 53, enabled: false, x: 0, y: 0, width: 32, height: 16 }
];
