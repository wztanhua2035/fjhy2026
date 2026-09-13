# Interaction Targeting V6

互动使用玩家脚底世界坐标。人物素材、显示倍率和 footAnchor 不参与距离调整。

- NPC：两个固定、脚底居中的互动身体（各 1 × 1.44 tile）之间的间距 <= 0.9 tile；其中 <= 0.6 tile 不要求朝向，外围采用 140° 朝向锥。Web 和微信的交易按钮、对话目标均调用同一个判定。
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

DEV/STAGING 使用现有 collision debug 开关查看互动区。微信输出 `npcChecks`（边缘距离、朝向要求和允许结果），用于区分“渲染看起来很近”与实际互动距离。正式包必须包含 `interaction-targeting-v6` 标记；此标记只验证新代码进入产物，不能代替真机验收。

V4 互动身体仅用于接近判定，不改变玩家移动碰撞。回归覆盖所有 NPC 侧面 1.4 tile 接近、杂货铺/商行实际柜台前合法站点 `(12,11.29)`、精确外缘与圆角越界。调试范围与实际判定共用 `npcInteractionBody()`，不再只测试没有柜台阻挡的贴身点。

## V6 移动与互动确认

V5 的逐转折点 HTTP 同步已废弃：摇杆持续变向可产生每秒 60 个请求，超过每分钟 180 的限流。

V6 保留路径，在 0.8 秒同步周期内作为单个 move 请求的可选 path 上传；服务端检查最多 256 点、总路程最多 8 tile、终点一致、逐段碰撞，完整通过才保存。旧客户端 x/y 请求仍兼容。bootstrap.features.movementPath 声明支持，客户端仅在支持时发送 path。staging 场景诊断返回 movementProtocol=bounded-path-v1 用于核验部署。

互动先确认在途与剩余移动，期间显示确认提示并拦截重复点击。429 显式返回 RATE_LIMITED，客户端等待 60 秒，不让后台移动继续触发失败。网络断开暂停新移动直到重新连接；明确失败恢复确认位置。门区、NPC 范围和静态碰撞不变。

回归必须覆盖连续摇杆变向一分钟（不超过 80 次移动 HTTP）、弱网积压上限、真实 HTTP 429 和批量路径校验；不能仅用直线行走测试证明请求量安全。
