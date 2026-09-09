# 《富甲横阳》窗口交接摘要

- 日期：2026-09-09（北京时间）
- 分支：`main`
- 最近关键 commit：`648f4e3 Handoff Baishi Street vertical slice`，已与 `origin/main` 同步。
- 工作区：干净。
- 关键文件：`PROJECT_CONTEXT.md`、`tests/game.test.ts`、`packages/client-runtime/index.ts`、`apps/server/src/{app,service,repository}.ts`、`apps/web-game/`、`apps/wechat-game/`、`apps/admin/`。
- 测试：`npm.cmd run typecheck` 通过；定向测试 31 项通过、1 项 PostgreSQL 集成测试因未配置测试数据库跳过、0 项失败；本次未运行全项目无关测试。
- 未解决：真实 PostgreSQL/Zeabur 重启后的人工存档复验；正式微信登录；关系值玩法；部分微信开发者工具平台兼容警告。
- 下一项：任务 7——统一建筑入口和室内外切换体验。
- 不得破坏：Web First、TypeScript/Phaser/Canvas 2D；Cocos 只归档；只深做白石街；场景块+出口拓扑；配置驱动；服务端权威存档/经济/任务/幂等；微信端薄适配且与 Web 共用资源和组件。
