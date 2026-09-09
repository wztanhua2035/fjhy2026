# Web First 技术审计与迁移计划

更新日期：2026-09-08

## 结论

《富甲横阳》后续采用 Web First：以 Phaser 和 TypeScript 作为日常浏览器开发的 Canvas 2D 游戏主体，以 Platform Adapter 隔离微信专属能力，并继续使用现有 Fastify API、PostgreSQL、Redis、Worker、Prisma、后台和 Zeabur 测试服。Cocos Creator 工程保留为微信适配、素材与历史配置的复用来源，但不再作为日常玩法开发的主路径。

## 审计结果

### 必须完整保留

- `apps/server`：微信登录、开发登录、玩家、交易、账本、世界读取、配置发布 API。
- `apps/worker`：Ghost 候选池和 Redis/BullMQ 维护职责。
- `database/prisma` 与既有 migration：玩家、外观、背包、账本、幂等请求、Ghost 与世界版本数据。
- `packages/shared-types`、`packages/game-config`、`packages/game-rules`、`packages/client-runtime`：共享类型、内容配置、碰撞/营业规则与平台无关的交互控制器。
- `apps/admin`：运营配置和现有浏览器试玩页，后续逐步把试玩职责迁出。
- Zeabur 的 PostgreSQL、Redis、game-api、game-worker、admin 服务及现有 API 路径。

### 需要调整

- 新增独立 `apps/web-game`，不再将日常游戏试玩绑在后台管理页面中。
- 新增 `packages/platform-adapter`。核心玩法只能依赖此契约和 `Transport`，不能直接引用 `wx.*`。
- Cocos 的 `GameRuntime` 通过 `WeChatPlatform` 处理微信登录、请求、存储和生命周期；微信专属能力不进入 `GameController`。
- 后续将白石街图层加载从“进入页面即预载候选资源”升级为按场景 Manifest 加载与卸载。
- 任务从当前 Q_001 的最小闭环，扩展为基于配置的状态、步骤、奖励和关系变化；不能继续累积任务专用分支。
- NPC 从当前 `sceneId + hours + priority` 扩展为日程、条件、权重和任务覆盖；保持同场景少量实例化。

### Cocos 可复用内容

- 白石街图层素材、TMX、入口、碰撞和场景配置。
- `GameRuntime` 中的微信发布、横屏、Cocos 输入和资源加载经验。
- 已生成的共享类型、规则和客户端运行时。
- Boot 场景与微信小游戏构建配置。

不复用 Cocos 的场景节点和 UI 代码作为 Web 主体；这些属于引擎实现，不是游戏业务。

### Phaser 选择

选择 Phaser 而非 PixiJS。当前项目需要 2D 场景生命周期、固定横屏、键盘/触摸输入、相机坐标、图层和地图资源加载。Phaser 已提供这些能力；PixiJS 更适合只需渲染层的项目，采用它会额外实现场景、输入和 TileMap 管理，当前没有收益。

### Platform Adapter 契约

`PlatformAdapter` 统一提供：

- 网络 Transport。
- 微信登录码获取。
- 本地存储。
- 前后台生命周期。

`WebPlatform` 使用 Fetch、localStorage 和浏览器 visibility 事件。`WeChatPlatform` 封装 wx.login、wx.request、wx 存储和前后台事件。支付、分享、广告、音频和文件缓存以后以新增可选能力扩展，不应进入核心任务、交易或地图逻辑。

### 大世界 小运行集审计

现有设计已具备正确基础：Scene 通过 Portal 划分、场景接口只返回当前 Scene、NPC 按 sceneId、营业时段与 priority 过滤且上限为 8、Ghost 上限为 6、位置同步与经济写入由服务端裁决。

仍未完全满足：NPC 没有跨场景日程/条件权重；Q_001 的完成与奖励仍有专用业务判断；当前白石街素材候选图会被浏览器试玩页预加载；远程 Bundle、CDN Manifest 缓存和按区域卸载尚未接通。

### 白石街垂直切片缺口

已具备建角、客栈/街道/店铺切换、移动、碰撞、入口、NPC 对话、买卖、理发、服装、存档和重登的原型闭环。

仍需补齐或验收：通用任务状态与多步骤触发、关系变化、NPC 日程覆盖、室内外前景遮挡、资源按场景加载、正式图层美术验收、移动端横屏与安全区真机验收、微信真实登录、CDN 缓存和低端机性能。

## 当前实施

第一阶段已完成：

- 新增 `apps/web-game`：Phaser Canvas 2D 浏览器游戏入口，支持开发登录、最小建角、键盘/触摸移动、互动、横屏提示与现有白石街图层显示。
- 新增 `packages/platform-adapter`、WebPlatform 和 WeChatPlatform。
- Cocos 的微信登录与请求迁入 WeChatPlatform；GameRuntime 不再直接调用 wx API。
- 保留所有现有 API、数据结构、服务端和 Cocos 工程。

## 后续分阶段计划

1. Web First 白石街验收：把现有浏览器试玩的建角外观、商店、理发、服装、任务面板迁到 `apps/web-game`，并保持同一 API 验收用例。
2. Scene Runtime：引入场景 Manifest、区域资源加载/卸载与邻近场景预加载；白石街先作为样板。
3. 内容通用化：实现 NPC Schedule/Override、Quest State/Step/Reward 配置与关系变化，移除新增任务的专用业务分支。
4. 微信阶段适配：由 WeChatPlatform 承接正式登录、分享、生命周期、缓存和触摸能力，在明确里程碑后统一用微信开发者工具和真机验收。
5. 白石街完成 70% 至 80% 后，将场景、建筑、入口、NPC、任务、遮挡和加载规范固化为可复制模板，再制作第二街区验证复制效率。

## 兼容性结论

兼容。此次路线只增加一个浏览器客户端和平台抽象；现有 Zeabur 服务、PostgreSQL、Redis、Prisma、API、玩家数据、账本、存档、后台和 Ghost 机制均保持兼容。当前阶段不需要数据库迁移、API 破坏性变更、清空数据或重建云服务。
## 已确认的补充决策

- Cocos Creator 停止作为主开发链路，只保留归档和可复用素材、配置及历史实现；迁移完成后不再与 Web 客户端双线维护。
- Phaser 和 Web First 是唯一的客户端主路径；微信小游戏仅承担平台能力和阶段性真机验收。
- 横阳采用独立场景块、方向出口和场景拓扑的拼图式世界，不建设大型无缝地图。
- 每次只运行当前场景及其少量 NPC、任务和资源；长街可拆成多个方向一致的连续场景。
- 白石街是首个可复制的 Scene Definition 模板。新增场景应主要新增配置、素材、建筑、NPC 和任务，不重写核心程序。
