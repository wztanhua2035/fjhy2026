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
