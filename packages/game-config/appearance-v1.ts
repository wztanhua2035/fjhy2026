import type { AppearanceDefinition, Gender } from '../shared-types/index.js';

export const starterSkinTones = [
  { id: 'SKIN_LIGHT', name: '浅肤色', hex: '#f5d8ba' },
  { id: 'SKIN_WHEAT', name: '小麦色', hex: '#e9b78e' },
  { id: 'SKIN_HONEY', name: '暖棕色', hex: '#d6a180' }
] as const;

// These IDs describe finished looks. The existing clothed 4x4 player sheets
// remain the safe render fallback until matching transparent walk layers exist.
export const starterLooks: AppearanceDefinition[] = (['MALE', 'FEMALE'] as Gender[]).flatMap(gender => {
  const prefix = gender === 'MALE' ? 'M' : 'F';
  const hairNames = gender === 'MALE' ? ['竖起短发·蓝黑', '规整中短发·蓝黑', '蓬松侧后束·蓝黑'] : ['自然垂落发', '高束长卷发', '蓝丝带双丸子头'];
  return [
    ...hairNames.map((name, index) => ({ id: `${prefix}_HAIR_0${index + 1}`, partType: 'HAIR', name, genderScope: gender, assetKey: `appearance/${prefix}_HAIR_0${index + 1}`, price: 0, colors: [], enabled: true, starter: true })),
    ...[1, 2, 3].map(index => ({ id: `${prefix}_OUTFIT_0${index}`, partType: 'OUTFIT', name: `${gender === 'MALE' ? '男装' : '女装'}整套 ${index}`, genderScope: gender, assetKey: `appearance/${prefix}_OUTFIT_0${index}`, price: 0, colors: [], enabled: true, starter: true }))
  ];
});

export function starterLookOptions(gender: Gender) {
  return {
    skins: starterSkinTones,
    hairs: starterLooks.filter(option => option.genderScope === gender && option.partType === 'HAIR'),
    outfits: starterLooks.filter(option => option.genderScope === gender && option.partType === 'OUTFIT')
  };
}

/** The same published choices and fallback selection are used by Web and WeChat. */
export function availableStarterLookOptions(
  bootstrap: { appearances: AppearanceDefinition[]; colors: Record<string,string> }, gender: Gender,
  current: { skinToneId?: string; hairId?: string; outfitId?: string }
) {
  const skins=starterSkinTones.filter(item=>Object.hasOwn(bootstrap.colors,item.id));
  const catalogIds=new Set(starterLooks.map(item=>item.id));
  const hairs=bootstrap.appearances.filter(item=>item.enabled&&item.starter&&item.partType==='HAIR'&&item.genderScope===gender&&catalogIds.has(item.id));
  const outfits=bootstrap.appearances.filter(item=>item.enabled&&item.starter&&item.partType==='OUTFIT'&&item.genderScope===gender&&catalogIds.has(item.id));
  return {skins,hairs,outfits,selection:{
    skinToneId:skins.some(item=>item.id===current.skinToneId)?current.skinToneId:skins[0]?.id??'',
    hairId:hairs.some(item=>item.id===current.hairId)?current.hairId:hairs[0]?.id??'',
    outfitId:outfits.some(item=>item.id===current.outfitId)?current.outfitId:outfits[0]?.id??''
  }};
}
