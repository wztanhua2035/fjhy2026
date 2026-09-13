# 物品、背包与店铺报价 V1.1

`ItemConfig` 只描述稳定 Item ID、名称、分类、图标 Resource ID、堆叠、使用效果和任务/重要物品保护。物品名称可改，Item ID 不可改。旧版发布配置的 `basePrice` 只为读取兼容保留；新配置不写此字段，启动时的增量迁移会移除它。

`BuildingConfig.stock[itemId]` 是现有世界配置里的 `ShopListing`。`baseBuyPrice` / `baseSellPrice` 属于店铺报价，`canBuy` / `canSell` / `enabled` 属于上架规则。旧版 `buy` / `sell` 继续可读，后台改价会同时更新旧字段和基价，避免旧客户端和已发布草稿失效。街坊杂货铺与白石商行现有报价保持不变。所有现有报价采用 `FIXED`。`MARKET_DYNAMIC` 仅作配置预留，交易时安全拒绝。

`MarketState` 独立于物品和玩家背包，未来才保存全服供需指数及真正稀缺品的共享库存。本轮没有市场公式、全服库存事务或补货。`INFINITE` 是当前可运行的店铺库存模式；`PLAYER_PRIVATE`、`GLOBAL_LIMITED` 类型可解析，但运行时拒绝交易，待各自的库存规则上线后启用。店内货架数量、玩家私有库存、全服市场指数不能互相代替。

玩家存档继续使用 `Record<ItemId, quantity>`，不保存物品名称、图标 URL 或价格。背包列表由同一份 Item 配置排序并生成，顺序为重要、任务、食品、饮品、日用品、材料、礼物、服饰、其他，再按 `sortOrder` 与 Item ID。未知旧 ID 显示“未知物品”，不会暴露原始 ID 给玩家。无图时使用文字占位。

`GET /v1/inventory` 返回当前权威数量与可显示的物品信息。`POST /v1/inventory/use` 接收 `itemId`、`quantity:1`、`requestId`。操作复用玩家事务和请求去重：先验证物品及正式效果，效果成功后才扣除一件并保存。V1.1 仅提供轻量 `ENERGY` 增量处理器作为效果底座，没有把现有食品开放使用，也没有加入完整活力或饮食系统。任务/重要物品不可普通使用或出售；`DELIVER` 仍只走任务步骤。

Web 与微信背包使用共享 `GameController.inventoryItems()`。购买、出售和使用都接收服务端返回的最新 PlayerState，因此面板立即刷新；重登仍从原有存档恢复。后台物品定义、店铺报价和未来市场区域分开展示，发布仍遵循原有草稿 → TEST → PUBLISHED 流程。
