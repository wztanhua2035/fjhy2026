# 白石街入口与分层验收标准

## 当前样板数据

- 场景网格：48×48，主街横向位于 y=20～25，中央巷道连接南北区域，河道位于 y=39～45。
- 开放建筑：5 间。
- 入口方向：4 个 `south`，1 个 `west`，符合普通建筑以南门为主、侧门为辅的规则。
- 封闭建筑：5 个保留地块，建筑范围由场景碰撞框阻挡，不开放进入。

## 入口验收

每个入口必须同时具备：

- `position`
- `direction`
- `interactionArea`
- `targetScene`
- `targetSpawnPoint`

入口必须位于可步行道路或巷道末端；玩家进入 `interactionArea` 后才显示交互提示。室内出口通过 `returnEntranceId` 返回对应外部入口，未指定时才使用该建筑的第一个入口作为兼容回退。

## 图层验收

- `ground`：当前正式测试使用确认样图合成层。
- `buildings`：候选层必须完成透明边缘、道路覆盖和门洞位置检查后，才允许 `enabled=true`。
- `decorations_back`：不应遮挡道路和入口交互区。
- `npcs`：NPC 脚底坐标必须落在可行走区域，不能放入建筑碰撞框。
- `foreground`：只覆盖角色上半身或场景边缘，不得覆盖入口和交互按钮。

候选图层预览可使用：

- `?layers=candidates&debug=baishi`
- `?ground=candidate&debug=baishi`
- `?building=inn&debug=baishi`

正式测试默认不启用候选层。

## 资源版本

本轮白石街图层资源版本为 `assetVersion=2`。新增或替换地面、建筑、装饰、NPC、前景资源时，必须同步提升资源版本，避免客户端继续使用旧缓存。
