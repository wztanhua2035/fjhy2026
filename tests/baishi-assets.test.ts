import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';

const root=process.cwd();
const assets=[
 'apps/admin/public/scene-layers/baishi/ground/baishi_composition_approved_v01.png',
 'apps/admin/public/scene-layers/baishi/ground/baishi_ground_candidate_v01.png',
 'apps/admin/public/scene-layers/baishi/buildings/baishi_buildings_candidate_v01.png',
 'apps/admin/public/scene-layers/baishi/buildings/baishi_buildings_north_candidate_v01.png',
 'apps/admin/public/scene-layers/baishi/buildings/baishi_buildings_south_candidate_v01.png',
 'apps/admin/public/scene-layers/baishi/foreground_branch_01.png',
 'apps/admin/public/scene-layers/baishi/foreground_tree_canopy_01.png',
 'apps/admin/public/scene-layers/baishi/foreground_eave_inn_01.png',
 'apps/admin/public/scene-layers/baishi/foreground_eave_shop_01.png',
 'apps/admin/public/scene-layers/baishi/buildings/baishi_building_inn_candidate_v01.png',
 'apps/admin/public/scene-layers/baishi/buildings/baishi_building_grocery_candidate_v01.png',
 'apps/admin/public/scene-layers/baishi/buildings/baishi_building_trade_candidate_v01.png',
 'apps/admin/public/scene-layers/baishi/buildings/baishi_building_salon_candidate_v01.png',
 'apps/admin/public/scene-layers/baishi/buildings/baishi_building_house_left_candidate_v01.png',
 'apps/admin/public/scene-layers/baishi/buildings/baishi_building_stall_candidate_v01.png',
 'apps/admin/public/scene-layers/baishi/buildings/baishi_building_cloth_candidate_v01.png',
 'apps/admin/public/scene-layers/baishi/buildings/baishi_building_house_right_candidate_v01.png'
];

test('资源版本 2 清单存在且包含基础地图',()=>{const manifest=JSON.parse(readFileSync(join(root,'assets/public/2/manifest.json'),'utf8'));assert.equal(manifest.version,2);assert.ok(manifest.files.some((file:any)=>file.path==='maps/baishi.tmx'));});

test('白石街已登记图层资源均为可加载 PNG',()=>{
 for(const relative of assets){
  const data=readFileSync(join(root,relative));
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a',relative);
  assert.ok(statSync(join(root,relative)).size>1024,`${relative} 资源为空或过小`);
 }
});
