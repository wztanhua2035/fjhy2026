# 横阳客栈临时房生活功能 V1

`INTRO_INN_KEEPER_DONE` 仅表示陈掌柜开场对白结束。玩家第一次通过客栈大厅出口进入白石街，服务端才在同一场景切换事务中写入 `GUEST_ROOM_LIFE_UNLOCKED`。此前房间四件家具只返回环境对白；重新开始会重置此标记与以下角色生活数据。

床、衣柜、箱子、书桌沿用现有室内语义区及交互坐标。正式功能由服务端根据设施类型、所在场景、解锁状态和脚底距离校验。Web 与微信使用同一 GameController 和 Phaser 面板。

- 床：`/v1/facilities/sleep/start`、`/wake`；现实时间 1/3/6 小时，重登时一次结算。
- 衣柜：GET `/v1/facilities/wardrobe`、POST `/equip`；仅已拥有的整套 Outfit，预览不写存档，确认后免费换装。
- 个人箱子：GET `/v1/facilities/storage`、POST `/transfer`；背包与个人储物双向转移，任务/重要物品不可存入。
- 书桌：`/v1/world/inspect`；展示精力、物品种类和当前任务概况。

`PlayerState.life` 记录精力、睡眠开始时间、目标时长、上次有效睡眠时间及最近结果；`PlayerState.storage` 沿用稳定 `itemId → quantity`。PostgreSQL 通过两个带默认值的 JSONB 列增量保存，不清理旧玩家数据。设施操作沿用玩家事务锁和 `requestId` 幂等记录。

精力 0–100，初始 100。当前测试参数集中在 `packages/game-config/life-v1.ts`：睡满 6 小时，低于 60 最多恢复至 60；60–69 最多增加 10，最终不超过 70；70 及以上无睡眠恢复。12 小时内再次有效睡眠按约 20% 恢复，1/3 小时短睡分别按 4/10 点测试。冷却衰减与短睡恢复值均待微信真机试玩调整。普通移动和对话暂不消耗精力，精力暂不加入常驻 HUD。
