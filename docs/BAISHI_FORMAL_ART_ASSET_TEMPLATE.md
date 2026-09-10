# 《富甲横阳》白石街正式美术资源模板 V1

本模板用于白石街后续正式建筑、NPC、主角与对话立绘的工程接入。后续内容优先通过新增素材与资源元数据完成，避免为单个建筑或角色重复修改核心渲染代码。白石商行 V2 / V2.1 作为当前已验证样板。

## 建筑模板

```ts
{
  assetKey: 'building_xxx_base',
  imagePath: '/scene-layers/baishi/formal/building_xxx_base.png',
  worldX: 0,
  worldY: 0,
  renderWidth: 320,
  renderHeight: 384,
  originX: 0,
  originY: 0,
  depth: 30,
  foreground: {
    assetKey: 'building_xxx_fg',
    imagePath: '/scene-layers/baishi/formal/building_xxx_fg.png',
    offsetX: 0,
    offsetY: 0,
    depth: 50
  }
}
```

建筑元数据必须同时明确主体底边参考线、origin、门洞中心与宽度，以及入口 ID / 方向（如 `ENT_BAISHI_TRADE_S` / `south`）。门洞应与 Plot 和入口碰撞配置对齐。`foreground` 为可选层；若与主体几何不一致，保持禁用，不通过重构渲染架构强行适配。

## 角色 spritesheet 模板

```ts
{
  assetKey: 'npc_xxx_walk',
  imagePath: '/scene-layers/baishi/formal/npc_xxx_walk.png',
  frameWidth: 64,
  frameHeight: 64,
  columns: 4,
  rows: 4,
  directionRows: { down: 0, left: 1, right: 2, up: 3 },
  framesPerDirection: 4,
  footAnchorX: 32,
  footAnchorY: 59,
  frameOffsets: {
    down: [{ x: 0, y: 0 }],
    left: [{ x: 0, y: 0 }],
    right: [{ x: 0, y: 0 }],
    up: [{ x: 0, y: 0 }]
  },
  idleFrame: 0
}
```

默认采用 256×256、4×4、单帧 64×64 的四向 spritesheet。`frameOffsets` 只用于透明边距和帧间视觉中心的轻量校准，不改变世界坐标或碰撞。停止移动时使用稳定 `idleFrame`；正式图片加载或本帧绘制失败时回退 `drawAppearance()`，不得使角色消失。

## Portrait 模板

```ts
{
  assetKey: 'portrait_xxx_normal',
  imagePath: '/scene-layers/baishi/formal/portrait_xxx_normal.png',
  preferredWidth: 264,
  preferredHeight: 344,
  slot: 'left',
  originX: 0.5,
  originY: 1,
  backgroundDim: true
}
```

重要剧情对话使用 `left` / `right` 插槽；当前说话方正常突出，另一方适度降低亮度，背景轻度压暗。无立绘或立绘加载失败时降级为现有普通文字对话。

## 跨端规则

- Web 与微信小游戏共用同一套 `assetKey`、路径约定、元数据和 `packages/client-runtime` 共享加载 / 绘制逻辑。
- 平台层只处理图片创建、加载缓存和生命周期差异。
- 不维护两套正式美术资源；微信早期简化显示不作为正式资源标准。

## 新增内容标准流程

```text
准备素材 → 填资源元数据 → 场景挂载 → 人工视觉校准 → Web 验证 → 微信验证 → 提交
```

素材接入必须检查透明边缘、脚底锚点、建筑底边、门洞与入口、depth / foreground 遮挡、PC 与微信共用资源路径，以及旧资源失败时的降级表现。

## 当前范围

本模板不要求完整换装渲染、复杂动画状态机、逐帧 atlas、Live2D、全 NPC 半身立绘或完整剧情编辑器。后续扩展前，先以白石商行样板验证新增配置与素材是否足够。

## 可进入店铺 NPC 规则

凡是可进入、可互动，并承担剧情、经营、交易、任务或关系功能的店铺，原则上至少配置 1 名独立店内核心 NPC。该 NPC 必须拥有明确、稳定的实体 ID，不得临时复用无关 NPC。

店内核心 NPC 应在配置中明确绑定：所属建筑、室内 `sceneId`、初始位置、朝向、基础对话、interaction / dialogue、formal spritesheet，以及重要角色或重要对话所需的 portrait。初始位置不得挡住出口、交互热点或主要通行路线。

新增店铺正式美术前，先检查对应核心 NPC 是否存在；若不存在，应先补 NPC 实体，再接入 spritesheet 和 portrait。店铺 NPC 后续可承载商品交易、支线任务、好感 / 关系、店铺经营、城镇传闻和剧情推进等功能。

青丝美发室新增独立实体 `NPC_SALON_HAIRDRESSER`（青丝美发师），作为本规则的第一个明确执行案例。该规则本身不要求本轮扩展额外玩法。
## 店铺核心 NPC 动态活动规则

拥有独立核心 NPC 的店铺，其 NPC 同时具有职业身份与生活状态。职业身份包括店主、店员、美发师、掌柜、琴师等；生活状态至少支持 `working`、`offDuty`、`special`、`night` 四类轻量状态。

`working` 时 NPC 原则上位于所属店铺并承担交易、服务、任务、剧情和关系互动；`offDuty` 或外出时可出现在街道、茶馆、客栈、市场、河边、寺观等公共空间。店外出现时仍保持同一实体身份、职业特色、性格和玩家关系状态，但默认不开放完整店铺功能，例如正式理发或购买仍需回到店内。

店外对白应结合人物身份、当前地点、当前时间与关系状态适配。第一阶段只使用轻量配置：每个核心 NPC 可配置 2～4 个非营业候选地点，由时间段、剧情条件或简单概率选择；不实现复杂 AI 日程。NPC 不复制成多个独立实体，而是通过状态、场景和当前位置切换。后续好感、支线、节庆、随机事件与传闻优先复用本规则。

青丝美发室独立 NPC `NPC_SALON_HAIRDRESSER` 作为本规则的首个正式执行案例。
## Portrait 正式素材规范

所有正式 NPC 与主角 portrait 必须是 `512×512`、真正带透明 alpha 的 PNG，且只包含人物本体。禁止包含店铺、房间、街景、文字、对话内容、边框、展示板、参数说明或其他非人物元素；不得直接从概念展示板或素材总览图裁切后使用，必须提供单独生成或单独处理的人物透明立绘文件。

人物保持自然比例，不得为填满画布进行纵向或横向拉伸；缩放只允许等比进行，必要时通过透明边距解决。建议头顶保留适量透明边距，人物主体居中或按左右槽位自然偏置，下半身裁切位置统一，并保留头发、手臂、道具等重要部分。

接入前必须自动检查：画布是否为 `512×512`、PNG 是否具有 alpha 通道、是否存在透明像素、四周边缘是否至少部分透明。若所谓透明 portrait 的 alpha 全为 `255`，直接判定为不合格，不允许接入。每次新增 portrait 均须先完成素材检查，再进入 Web 页面。

固定验收流程：`素材尺寸检查 → alpha 透明检查 → 人物比例检查 → 无背景/无文字检查 → Web 实际显示验收 → 才允许 commit`。

陈掌柜透明素材修复为正确示例。当前 `portrait_hairdresser_normal.png` 标记为待替换不合格素材：虽然文件存在透明像素，但仍包含矩形背景、场景元素与文字，不符合正式立绘规范。