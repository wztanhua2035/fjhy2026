# Interaction Targeting V3

互动使用玩家脚底世界坐标。人物素材、显示倍率和 footAnchor 不参与距离调整。

- NPC：到 `npcCollisionRect()` 边缘的距离 <= 0.8 tile；其中 <= 0.5 tile 不要求朝向，外围采用 140° 朝向锥。Web 和微信的交易按钮、对话目标均调用同一个判定。
- Portal：`Portal.interactionArea` 是连续矩形，客户端与服务端均使用 `portalInteractionZone()`。不要求朝向，不设最小距离。旧场景未配置该字段时使用统一兼容区域。
- 不能只改本地配置：新字段必须通过 server config schema、发布存储和 scene API。staging 启动时定向同步门区，保留已有 collision 和其他场景数据。

## 客栈校准（32px/tile）

依据当前正式 `interior_inn_v1.png` 的底部门洞、左上门帘，以及临时房正式背景；坐标为世界 tile，矩形为 x/y/width/height：

- 大厅出口：10.2 / 17 / 3.6 / 2，覆盖左右门槛。
- 大厅临时房入口：1.8 / 5.1 / 2.6 / 3.2，覆盖门帘前可站立位置至门前地毯；大厅 arrival `(3,8.6)` 在区域之外。
- 临时房出口：5.7 / 9.2 / 2.8 / 2；房间 arrival `(7,8.4)` 在区域之外。

这些是互动区，不是新增碰撞。开场事件及人物尺寸不变。

## 验证约定

`tests/interaction-targeting.test.ts` 使用真实 SceneConfig 覆盖左右门槛、贴门帘、NPC 四侧及所有朝向，并调用 GameService 验证服务器确实允许相同门口位置。`tests/guest-room.test.ts` 覆盖配置发布及 API 字段保留、开场与往返。

DEV/STAGING 使用现有 collision debug 开关查看互动区。微信输出 `npcChecks`（边缘距离、朝向要求和允许结果），用于区分“渲染看起来很近”与实际互动距离。正式包必须包含 `interaction-targeting-v3` 标记；此标记只验证新代码进入产物，不能代替真机验收。
