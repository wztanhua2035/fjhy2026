/** Service zones retain the existing NPC conversation/action endpoint until each shop gets its dedicated UI. */
export const serviceInteractionNpcs:Record<string,string>={
  INN_SERVICE:'NPC_001',GROCERY_SERVICE:'NPC_GROCERY_CLERK',TRADE_SERVICE:'NPC_TRADE_CLERK',
  SALON_SERVICE:'NPC_SALON_HAIRDRESSER',CLOTH_COUNTER_SERVICE:'NPC_CLOTH_SHOPKEEPER',CLOTH_FITTING:'NPC_CLOTH_SHOPKEEPER'
};

export const furnitureInteractionLabels:Record<string,string>={
  GUEST_BED:'休息',GUEST_CHEST:'打开箱子',GUEST_WARDROBE:'查看衣柜',GUEST_DESK:'查看书桌'
};
