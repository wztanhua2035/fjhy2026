# 微信小游戏白石街构建与验收

## 2026-09-12 追平修正与交付边界

当前实际入口为 `apps/wechat-game`，产物 `dist/wechat-game`。`apps/client-wechat` 是保留的 Cocos 原型，不用于本轮导入。不要将两个目录混用。

- 正式资源通过 `wx.createImage` 加载已下载分包内的 PNG，再注册 Phaser texture/spritesheet；不走浏览器 XHR/Blob。缺失资源显示文件名并可点击重试，不再静默显示占位街区。
- 构建和加载共用 `src/assets.ts` 清单；五栋建筑、foreground、7 张人物 spritesheet、7 张 portrait 和底图共 21 张 PNG。构建逐字节核对 Web 源文件，输出 `asset-check-report.json`（尺寸、大小、SHA256）。加载结果跨场景缓存。
- 场景/NPC/入口/碰撞/任务/关系/交易继续使用共享 GameController 和 API；建筑锚点由共享 registry 解释，Web 原位置保持不变。微信不维护第二套建筑或碰撞坐标。
- 交谈和交易分成两个按钮；交易/对话期间停止摇杆移动，多点触控按 pointer ID 释放。任务栏优先显示尚未完成任务。男女建角预览使用正式图。
- 以 540 逻辑高度和实际横屏比例计算画布宽度，避免拉伸和触点比例混用；安全区与胶囊底部留白用于 HUD/任务栏。按钮加大，portrait 对话显示名字与结束提示。

### 必须区分代码部署和世界配置发布

PostgreSQL 的 `worldRelease(PUBLISHED)` 是线上数据源。重新部署代码、执行数据库 migration 或 seed **不会更新已有已发布世界配置**。本地 MemoryRepository 的最新白石街不能证明线上也已同步。

本轮加入 `apps/server/src/sync-baishi.ts`：仅合并当前白石街场景、Plot、建筑、NPC及其任务/物品，保留其他记录，通过原有 DRAFT → TEST → PUBLISHED 发布并归档旧版本，不清空玩家存档。重复启动无差异时不会再次发布。

如线上仍是旧数据，在部署本轮服务端代码后，对 **game-api** 设置 `SYNC_BAISHI_CONTENT=true`，且 `APP_ENV=STAGING`（或 DEV），重启。日志应出现 `Baishi content release` 及更新 ID / 发布版本；成功后移除此开关。PROD 不允许启用此启动同步。校验或发布失败会明确报错，不带着半更新内容启动。

本轮没有远程控制台凭据，未替用户部署或执行线上发布。客户端登录后核对五店 Plot/入口、运行时 collision 及两项任务步骤；不一致时显示“服务端白石街配置尚未同步”及版本/差异项，而不冒充可验收版本。

### 本轮用户测试步骤

1. 本轮构建完成后直接导入 `D:\ChatGPTProjects\fjhy\dist\wechat-game`。以后修改源码或构建变量后重新运行 `npm run build:wechat-game`。
2. 本次分包与加载方式有变化，开发者工具清除**文件/编译缓存**后重新编译，再重新预览二维码。不需要删除账号云存档。
3. AppID 使用自己的正式小游戏 AppID，API request 合法域名与该 AppID 对应。正常构建连接 STAGING，使用 wx.login；清缓存不会生成一个新的微信身份。
4. 全营业仅供 DEV：设置 `WECHAT_GAME_API_BASE_URL` 为手机可访问的 DEV API HTTPS 地址，服务端 `NODE_ENV=development`、`APP_ENV=DEV`；构建时 `WECHAT_GAME_DEBUG_OPEN_ALL=true`。开发工具/预览的 `envVersion=develop` 才发头，trial/release 不发送，服务端 production/STAGING 仍忽略。不要为营业测试降低现有 STAGING 服务的安全设置。
5. 可选 `WECHAT_GAME_DEBUG_COLLISION=true` 同样仅 develop 生效。正式包清除上述变量后重建。
6. 五店进出、正式美术、遮挡、portrait、摇杆、多比例手机、首次加载耗时及峰值内存由用户人工确认。自动测试只证明内部规则和适配数据链，不代表真机视觉已通过。

底图分包约 3.43 MiB，余量较少；新增大图宜进一步分包或迁往 CDN。21 张图解码约 17.56 MiB，仅是像素下限，不含 Canvas、引擎、临时图片与系统缓存；首次加载耗时和设备实际峰值尚待真机测量。

> 当前 Web First 白石街垂直切片的微信开发者工具入口是根目录运行 `npm run build:wechat-game` 后生成的 `dist/wechat-game`。它使用 Phaser 微信小游戏 Canvas、`WeChatPlatform` 和共享 `GameController`。下文 Cocos Creator 工程说明用于保留旧工程与后续引擎参考，不是当前白石街日常真机验收的导入路径。

## Web First 微信小游戏构建

直接运行 `npm run build:wechat-game`，然后在微信开发者工具中导入 `dist/wechat-game`。构建包共用 Web 的正式白石街资源注册、场景/NPC/任务配置、入口、碰撞、world Y-depth、关系和任务运行时；微信专用代码只处理 `wx.request`、本地存储、生命周期、Canvas 触摸、横屏和安全区。

微信单包限制为 4 MiB，因此构建结果将主代码、白石街底图、世界建筑/角色和 portrait 分别放入主包及三个资源分包。`game.js` 在启动 Phaser 前统一调用 `wx.loadSubpackage`，构建脚本会为每个资源分包生成微信要求的空 `game.js` 入口，并逐包检查体积；任何一个包超过 4 MiB 都会直接失败并报告对应包名。

只有连接本地 DEV API（`APP_ENV=DEV`、`ALLOW_DEV_AUTH=true`）时，才可在 PowerShell 中生成 DEV 登录及全部营业测试包：

```powershell
$env:WECHAT_GAME_DEBUG_OPEN_ALL='true'
$env:WECHAT_GAME_DEV_LOGIN='true'
npm run build:wechat-game
```

连接 `https://api-fjhy-staging.wzpy.net` 时不要设置 `WECHAT_GAME_DEV_LOGIN`：STAGING 按部署规范关闭 `/v1/auth/dev`，客户端应调用 `wx.login` 和 `/v1/auth/wechat`。`WECHAT_GAME_DEV_LOGIN=true` 只供本地 DEV API 使用。可选碰撞调试使用 `WECHAT_GAME_DEBUG_COLLISION=true`；`WECHAT_GAME_DEBUG_OPEN_ALL=true` 也只会被 DEV API 接受，STAGING/production 均忽略营业覆盖。AppSecret 只配置在服务端。

已建立 `apps/client-wechat` 的 Cocos Creator 3.8.8 工程、Boot 场景、运行脚本及原型地图。当前机器未检测到 Creator，因此本交付不包含经 Creator 构建的微信上传包；请完成下列导入与真机步骤后再提交微信审核。

## 导入与预览

1. 安装官方 Cocos Dashboard 和 Creator 3.8.8，使用“添加项目”选择 `apps/client-wechat`。
2. 先在仓库根目录运行 `npm ci`、`npm run db:generate`、`npm run assets:build`。此命令把共享 TypeScript 复制到 Cocos `assets/scripts/generated`，并生成 `resources/maps` 下的 TMX 及纹理；这些脚本和资源须在 Creator 导入前存在。
3. 打开 `assets/Boot.scene`，场景根节点应具有 `GameRuntime` 组件。脚本在运行时建立 Canvas、正交 Camera、TiledMap、角色和交互 UI。若 Creator 对场景序列化版本提示升级，按编辑器正常升级并保存。
4. 启动根目录 `npm run dev:demo`，在 Creator 预览。浏览器预览会使用 `Environment.ts` 的开发账号；微信环境始终调用 `wx.login`，不会用测试账号代替。
5. 玩家和 Ghost 共用 `drawAppearance`；原型图形可逐步替换为统一锚点、四方向的 SpriteFrame 图层。四方向、遮挡和款式美术尚需按 V2.2 第 15 章逐个验收。

## 配置线上 API

在根目录执行：

```powershell
$env:CLIENT_API_BASE_URL='https://你的API域名'
npm run client:configure
npm run assets:build
```

这会把公开 API 地址写入 `Environment.ts`，并关闭开发登录。不要把 AppSecret、管理令牌或数据库密码写入客户端。

微信公众平台配置 API 的 request 合法域名；后续资源下载接入时配置 CDN downloadFile 合法域名。使用平台要求的有效 HTTPS 域名。AppSecret 留在 Zeabur API 的环境变量中。平台资质、类目、备案和审核以运营主体在微信后台收到的要求为准，本仓库不代办这些事项。

## 构建微信小游戏

在 Creator “构建发布”中选择微信小游戏平台，设置真实 AppID，启动场景 `Boot`，包含该场景，选择发布构建。不要手写或复制其他项目的 `game.js` 代替引擎构建。Creator 会生成微信项目文件，详见 [微信小游戏发布说明](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-wechatgame.html)。

先在编辑器完成一次构建并导出构建配置到 `deploy/wechat-build.local.json`。该文件与 Creator 小版本相关，不在仓库中伪造默认值。随后可使用官方命令行方式重复构建：

```powershell
& '你的CocosCreator.exe路径' --project 'D:\ChatGPTProjects\fjhy\apps\client-wechat' --build 'configPath=D:\ChatGPTProjects\fjhy\deploy\wechat-build.local.json'
```

具体参数与导出的配置格式参考 [Creator 命令行构建](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-in-command-line.html)。在微信开发者工具中导入 Creator 生成的 `build/wechatgame`（或实际构建目录），进行预览和真机测试，通过后上传体验版。

## 发布前需要验证

- 新用户必须建角，男女各六个模板，确认前配色和四方向预览可用；重登仍为原形象。
- 真机触摸方向按钮不粘键，切后台后停止移动；弱网保留待确认请求、重试不重复扣款。
- 客栈 → 街道 → 杂货店 → 商行闭环；街道地块与建筑通过服务器加载，碰撞和相机正常。
- TiledMap 层次、锚点和适配正常，低端机帧率与内存满足实际目标；当前没有承诺已达到 60 FPS。
- 首包大小、远程 Bundle、字体、音频、资源缓存、隐私说明、启动时间和机型覆盖均需在正式美术整合后验证。

当前 Cocos UI 优先覆盖第 35 章交易闭环。后台和浏览器试玩已提供美发与服装接口的操作入口；Cocos 端完整换装商店 UI、住宅衣柜以及资源 CDN 缓存属于后续客户端工作，尚未完成。


## 横屏设计基准

《富甲横阳》正式采用固定横屏开发与运行方案，以 16:9 作为主要设计基准。地图、移动、碰撞、交互、镜头和所有功能面板均在横屏内适配，不在地图与菜单之间切换竖屏。移动端地图界面优先使用左下角虚拟摇杆、右下角互动按钮、左上角玩家状态和右上角任务/小地图入口；剧情对话保留足够场景可视范围。
