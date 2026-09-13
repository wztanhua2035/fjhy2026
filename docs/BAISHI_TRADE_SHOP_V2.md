# 白石商行交易 V2

白石商行沿用 `B_TRADE`、`NPC_TRADE_CLERK`、`INTERIOR_B_TRADE`。当前六条 ShopListing：鸣山大米、横阳米糕、饮用水、牛奶、纸巾、雨伞；牛奶和雨伞只收购。价格是待平衡数值，已有 staging 报价由迁移保留，后台可单独编辑。

`ItemConfig` 只定义物品。`BuildingConfig.stock[itemId]` 是店铺报价表，`baseBuyPrice` 指商店卖给玩家的价格，`baseSellPrice` 指商店向玩家收购的价格。FIXED 报价经共用 `resolveShopPrice` 读取；旧世界版本仍可读 `buy/sell`。同一店同时买卖时，发布配置要求买价高于收购价。`MARKET_DYNAMIC`、`PLAYER_PRIVATE`、`GLOBAL_LIMITED` 仍仅为数据边界，运行时拒绝未支持的模式；普通商品使用 `INFINITE`。

客户端使用既有 `GET /v1/economy/catalog/:buildingId` 和 `POST /v1/economy/buy|sell`。请求仅传店铺、物品、数量和 requestId；服务端在玩家事务中查最新配置、校验报价与持有量、写入铜钱与背包，再返回 `trade`（transactionId、playerId、shopId、itemId、side、quantity、actualUnitPrice、total、timestamp）。原账本记录 `SHOP_BUY/SHOP_SELL` 和 `shopId:itemId`；多件交易后缀 `:Q数量`，旧账本不带后缀视为一件。幂等请求表保存完整响应，重复 requestId 不会重复结算。PostgreSQL 的玩家级事务锁使不同 requestId 的并发卖出串行化。

任务进度从正式交易账本按物品、可选店铺和数量读取。第一桶金的 BUY 绑定杂货铺、SELL 绑定商行；交易服务不再以大米 ID 特判，完成奖励与出售同一事务提交。旧存档的单件账本继续有效。

Staging 启动时 `ensureTradeShop` 只增量加入缺少的报价、店员与服务点绑定以及任务店铺绑定；已有报价与下架状态保持不变。后台草稿经 TEST、PUBLISHED 后下一笔交易读取新价格。Web 与微信仅显示功能型买卖入口，最终以服务端返回的实际成交金额提示玩家。
