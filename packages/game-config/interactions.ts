interface InteractionZone {x:number;y:number;width:number;height:number}

/** Stable geometry overrides for doors whose visible doorway is not centred on the Portal anchor. */
export const interactionZoneOverrides:Record<string,InteractionZone>={
  ENTER_INN_GUEST_ROOM:{x:2.55,y:6.55,width:.9,height:1.3},
  EXIT_INN_GUEST_ROOM:{x:6.2,y:9.75,width:1.6,height:.9}
};

export const serviceInteractionLabels:Record<string,string>={
  INN_SERVICE:'与陈掌柜交谈',
  GROCERY_SERVICE:'看看商品',
  TRADE_SERVICE:'交易',
  SALON_SERVICE:'查看美发服务',
  CLOTH_COUNTER_SERVICE:'查看服装服务',
  CLOTH_FITTING:'查看试衣服务'
};

/** Service zones retain the existing NPC conversation/action endpoint until each shop gets its dedicated UI. */
export const serviceInteractionNpcs:Record<string,string>={
  INN_SERVICE:'NPC_001',GROCERY_SERVICE:'NPC_GROCERY_CLERK',TRADE_SERVICE:'NPC_TRADE_CLERK',
  SALON_SERVICE:'NPC_SALON_HAIRDRESSER',CLOTH_COUNTER_SERVICE:'NPC_CLOTH_SHOPKEEPER',CLOTH_FITTING:'NPC_CLOTH_SHOPKEEPER'
};

export const furnitureInteractionLabels:Record<string,string>={
  GUEST_BED:'休息',GUEST_CHEST:'打开箱子',GUEST_WARDROBE:'查看衣柜',GUEST_DESK:'查看书桌'
};
