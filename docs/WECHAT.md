# Cocos 与微信小游戏部署准备

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
