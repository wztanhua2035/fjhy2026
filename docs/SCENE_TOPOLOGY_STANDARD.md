# 场景拓扑与拼图式世界标准

## 决策

横阳小镇采用独立 Scene、方向出口和拓扑连接组成的拼图式世界。项目不采用大型连续无缝地图。客户端在任意时刻仅加载和运行当前 Scene 的必要资源、建筑、NPC、任务和音频。

## Scene Definition

每个 Scene 必须使用配置定义，不为单独街道编写专属切换程序。最小定义包括：稳定 ID、名称、地图资源、出生点、出口、碰撞、建筑 Plot、NPC 池和资源键。

```ts
interface SceneDefinition {
  sceneId: string;
  name: string;
  mapAsset: string;
  spawn: { x: number; y: number };
  exits: Array<{
    id: string;
    direction: 'north' | 'east' | 'south' | 'west';
    interactionArea: { x: number; y: number; width: number; height: number };
    targetSceneId: string;
    targetExitId: string;
  }>;
}
```

出口数量由真实地理关系和游戏体验决定，可以是一至四个。长街可拆分为多个相邻 Scene，例如解放北路、解放街、解放南路；相邻出口方向必须互为对侧，特殊传送和剧情空间除外。

## 切换流程

玩家进入出口交互区后：校验出口 → 保存必要状态 → 卸载当前 Scene 非公共资源 → 加载目标 Scene → 在目标出口对侧出生。允许使用短淡入淡出，稳定和快速加载优先于无缝效果。

## 首批拓扑约定

白石街后续出口按下列规划实施，尚未制作的目标 Scene 仅保留配置接口：

- 东：解放街。
- 北：公桥路。
- 南：九凰山。
- 西：待后续地理规划确认，不强制预留出口。

目标 Scene 返回白石街时，必须使用相反方向出口。九凰山为正式名称。

## 模板要求

白石街完成后，新场景开发应遵循：场景美术 → Scene Definition → 出口 → Plot/建筑 → NPC → 任务 → 区域资源。若新场景需要修改核心场景切换程序，应先补足通用配置能力，而不是增加专用分支。