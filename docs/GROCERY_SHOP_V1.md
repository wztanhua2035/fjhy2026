# 街坊杂货铺商品系统 V1

沿用 `WorldConfig.items`、`BuildingConfig.stock`、`PlayerState.inventory/cash` 和 `/v1/economy/buy`。没有第二套背包、商店配置或购买接口。

## 商品与价格（待验证）

- RICE_01 鸣山大米：12 文；保留既有任务价格。
- SNACK_01 横阳米糕：8 文；保留既有商品，代替首批茶饮。
- WATER_01 饮用水：6 文。
- MILK_01 牛奶：15 文。
- BREAD_01 面包：10 文。
- BISCUIT_01 饼干：8 文。
- NOODLE_01 泡面：12 文。
- TISSUE_01 纸巾：20 文。
- UMBRELLA_01 雨伞：60 文，叠加上限 5。
- BATTERY_01 电池：30 文。

其余商品叠加上限 99；沿用背包总数量上限 100。`stockMode=infinite` 不受旧 dailyLimit 限制。

初始配置：`packages/game-config/grocery.ts`。Item 的 `id/name/basePrice/stackMax` 对应稳定 ID、展示名、参考价、叠加上限；正式买卖价唯一取自店铺 `stock[itemId].buy/sell`。食品/饮品预留 usable，但本轮没有使用入口。图标只用文字占位，后续 iconResourceId 引用远程资源 ID。

## 商店、API 与操作

商店沿用 `B_GROCERY`；场景 `INTERIOR_B_GROCERY`；店员 `NPC_GROCERY_CLERK`；购买服务点 `GROCERY_SERVICE`。不修改现有碰撞、服务区或 NPC 坐标。柜台区域提供“看看商品”，附近店员也可打开同一商品面板。

- `GET /v1/economy/catalog/:buildingId`：鉴权、角色、当前店铺和营业校验后返回最新 building/items。包含下架标记，客户端过滤不可购买商品。
- `POST /v1/economy/buy`：只接收 requestId、buildingId、itemId、quantity。数量为 1–99 整数；额外 totalPrice/price 字段直接拒绝。
- 出售继续使用 `POST /v1/economy/sell`。

服务端校验店铺、商品归属、启用状态、数量、余额和背包上限。PostgreSQL 按 playerId 事务锁串行处理，余额、背包、账本和 requestId 记录一同提交。相同请求返回原结果，改载荷复用请求号报冲突。客户端从点击开始禁止重复提交；断线重试保留原 requestId。

Web/微信使用同一 GameController 及商品数据；每次打开重新获取配置。数量 −/+，购买完成刷新余额和持有数量；微信每页 2 件商品。购买提示只保留成功、物品数量、支出三行。

第一桶金继续从通用 SHOP_BUY/SHOP_SELL 账本判断步骤；大米购买经过同一购买接口，白石商行出售及奖励保持兼容。

## 后台发布

世界管理 → 商品与商店：编辑名称、描述、分类、叠加上限、启用、所属店铺，以及各店买卖价和上架状态。ID 只读。

修改写入已有配置草稿；在“配置草稿”保存，然后 TEST → PUBLISHED。已有 ID 删除/改名、非法价格和绝对图标 URL 会被服务端拒绝。下次打开商品面板获取新配置，购买最终仍以服务端已发布价格为准。

staging 首次启动通过 `ensureGroceryShop` 添加缺失商品、补充杂货铺绑定和无限库存标记；保留已有价格。绑定完成后不再次覆盖运营改价或下架状态。production 不自动执行该迁移。

## 验证

`tests/grocery-shop.test.ts` 覆盖目录、数量、余额、库存、重登、非法请求、去重、任务与后台发布；现有 PostgreSQL 测试覆盖真实数据库并发和持久化，需 TEST_DATABASE_URL 指向独立 test 数据库。该文件已加入默认 npm test/CI。

真机重点验收柜台打开、五页商品、数量增减、购买后不收起、重复点击、断网重试和买米卖米任务。
