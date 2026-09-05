# API 契约

所有 `/v1` 接口（登录除外）需要 `Authorization: Bearer <JWT>`。服务端仅返回当前玩家私有状态；Ghost 只包含玩家 ID、游戏昵称、称号与 Appearance。OpenID 和 session_key 不返回客户端，session_key 当前不保存。

玩家写接口都需要 UUID `requestId`。同一玩家同一编号相同操作返回原结果；不同操作或不同载荷返回 409 `REQUEST_CONFLICT`。客户端在网络错误时保留原始请求；业务 4xx 可重新选择操作。登录接口使用微信一次性 code，不自动重试旧 code，应重新 wx.login。

## 已提供接口

- `POST /v1/auth/wechat`：`{code}`。
- `POST /v1/auth/dev`：`{account}`，仅 DEV。
- `GET /v1/bootstrap`：玩家、服务端时间、三种版本、资源清单 URL、外观目录和功能开关。
- `POST /v1/player/appearance/create`：`{requestId,gender,baseAvatarId,hairColorId,topColorId,bottomColorId}`。
- `GET /v1/player/appearance` 和 `GET /v1/appearance/owned`。
- `GET /v1/world/scenes/:id`：Scene、Plot、有效建筑、当时 NPC 与昼夜阶段。
- `POST /v1/player/move`：`{requestId,x,y}`，同场景短步、服务端碰撞检查。
- `POST /v1/world/enter`：`{requestId,plotId}`，检查同场景、距离和营业时间。
- `POST /v1/world/portal`：`{requestId,portalId}`，检查出口距离。
- `POST /v1/npc/talk`：`{requestId,npcId}`，返回记忆对白。
- `POST /v1/economy/buy` 或 `/sell`：`{requestId,buildingId,itemId,quantity}`。价格、余额、行囊和额度均由服务端决定；请求不能携带价格覆盖项。
- `GET /v1/appearance/catalog?shop=BUILDING_ID`，需要玩家身处该场所。
- `POST /v1/appearance/purchase`：`{requestId,buildingId,appearanceId}`。
- `POST /v1/appearance/change`：`{requestId,buildingId,appearanceId,colorId}`。
- `GET /v1/scenes/:id/ghosts`：最新公开外观快照，原型不做实时位置与聊天。

赠礼、邮箱领取、地产购买返回 501 `FEATURE_NOT_ENABLED`。任务与排行榜返回 `enabled:false`，不伪造奖励或排行榜。

## 后台

`/admin` 使用独立 `ADMIN_TOKEN`，不可用玩家 JWT。支持获取当前世界和版本列表、创建完整配置草稿、推进 TEST 与 PUBLISHED。草稿绑定 `basedOn`，上线版本变动后旧草稿不能覆盖；发布在 PostgreSQL 全局配置锁事务中进行。TEST 执行静态规则校验，不代表已完成真机验收。

当前后台单令牌对应审计 actor `admin`，不能区分多名运维人员。正式多人运营需接入独立身份与 RBAC。后台保存草稿使用乐观版本控制而非玩家经济幂等表；重复保存可能产生多个未发布草稿，不会重复修改在线配置。

## 持久化设计与边界

玩家、当前外观、服饰所有权、物品、经济账本、幂等记录、Ghost 快照使用独立 PostgreSQL 表。经济更新和请求结果在同一数据库事务提交，通过玩家 advisory lock 跨 API 副本串行化；没有以客户端余额覆盖数据库的路径。

Plot / Building / NPC / AppearanceDefinition 在第一阶段存入不可变 WorldRelease JSON，类型与校验已分离，后台整版发布。并非已将文档所有内容表逐一规范化为独立关系表；后续内容规模增长时可增加投影表。Mailbox、GiftTransaction、Relationship、Property 只预置数据表，业务未开放。

当前普通移动每约 400ms 同步并做碰撞校验，但没有基于时钟的服务端速度预算，不能当成完整反作弊。经济每日额度为每玩家、每店铺、每商品、每方向限额，尚非全服有限商店库存或动态市场快照。原型不扣普通步行体力，不包含工作和离线经营收益。
