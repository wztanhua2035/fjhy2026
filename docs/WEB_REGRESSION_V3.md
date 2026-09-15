# Web V3：正式运行链路与回归记录

日期：2026-09-15。只修 Web 表现及直接依赖；任务、交易规则、碰撞、portal、NPC 站位、角色数据未修改。

## 根因和修复

1. **世界坐标分叉**：Web 背景和正式人物使用受地图边界约束的 `worldOrigin`，共享 Painter 却再次按“玩家永远居中”计算偏移。出口和普通 NPC 因而相对背景漂移。共享 render 现在接受 Web 提供的同一个 origin；微信未传该参数，原行为保持。
2. **旧资源 fallback 回流**：正式映射已经引用新图，但失败分支仍加载 public 下旧高清 PNG，并与 CDN 图片共用旧纹理 key。旧 Phaser Loader 的全局 COMPLETE 回调也无法隔离不同场景请求。现在每个资源使用独立 fetch/decode Promise，并在创建纹理之前验证尺寸、字节数、SHA-256。纹理 key 和 URL 同时包含版本/hash。
3. **旧图被升级成新版本的工具风险**：同步脚本在新文件缺失时会把 fallback 复制为新版本。该分支已删除；缺失正式源文件现在直接失败。
4. **两个聊天框**：不是发现了第二个独立 Dialogue 实例，而是 `controller.message` 被直接写入旧 #message，同时又送入正式 Dialogue；对话开始时旧 toast 未及时隐藏。删除直接写入及旧点击推进监听；主框只读 `controller.dialogue`，辅助信息单独显示。已显示过的 toast 不在对话后重播，未展示的队列通知继续保留。
5. **中文硬断行**：固定 25 字预断行与浏览器实际可用宽度再次换行叠加。现在按实际字体和宽度测量，使用中文词段并优先在标点停顿处换行，每页最多三行。例：“你眼光看着挺利落， / 正好帮我看看一块新料子。”
6. **交易结果压列表**：同一消息同时走全局 toast 和 shop feedback；旧面板限高还会挤出底部按钮。交易结果改为独立 shopResult，固定面板底部状态区，列表区域单独滚动，面板高度按视口约束。售出最后一件商品时也更新反馈。
7. **检查覆盖缺口**：旧 typecheck 没包含 Web 源码，旧图片测试还验证已淘汰的本地副本。Web 源码现已纳入类型检查，图像测试改读正式 manifest。

## 唯一资源链路

Resource ID → 共享 path/version + release manifest SHA-256 → CDN → 字节/尺寸/hash 校验 → 解码 → 带 hash 的 Phaser texture。

- CDN 一次失败后至多再请求一次（reload 绕过浏览器缓存），每次超时 8 秒。
- 仅 DEV 可在两次失败后读取 `/__fjhy_source__/`，服务端仅开放 manifest 白名单。读取的是同一个 `assets/remote` 文件，并重新校验相同 hash，不是旧 public 图。
- 仍失败则使用通用轻量背景/透明前景，显示简短提示。5 秒后只进行一轮后台恢复，不无限重试。
- 恢复替换纹理时重新设置显示尺寸，避免 generic 小图的缩放比例带到正式图。
- 正式室内名称只由 DOM HUD `#scene-plaque` 显示；Web 不渲染旧室内 zone label。客栈“宾至如归”是背景内装饰，保持不变。
- 不删除 COS 历史对象；无新图发布、无新版 CDN 上传。本次修复的是已发布新版实际成为纹理的链路。

当前版本（background / foreground）：青丝 7/1，杂货铺 4/1，商行 5/1，衣坊 7/2，客栈 3/1，临时房 4/2。精确路径与完整 hash 以 release manifest 为准。

## 旧文件处理

14 张旧 public 高清 PNG 原样迁至 `assets/source-archive/baishi-interiors-legacy/`，完整清单见该目录 README。没有永久删除图片。该目录不在 Web public、微信 copy list 或 COS 发布目录中。

共享 fallback 映射全部改为 `generic_interior_fallback.png` / `generic_interior_foreground.png`。旧版本仍保留在远程源目录和 COS 以便显式回滚，但不再参与失败兜底。

春衫衣坊 foreground v2 已经是消除两条错误矩形后的透明版本；本次未再次编辑它，也未清空其他场景有效 foreground。修复后确认实际下载、校验并使用 v2，而非旧 v1。

## Web 人工检查

使用独立内存服务 `tools/web-visual-fixture.ts`，固定日间，不连接数据库。通过真实登录 API、Web 页面按钮和键盘操作验收，不改用户存档。

- 临时房：background v4 / foreground v2 实际 CDN 校验通过；老虎画保留；左右移动后出口与地图同位，姓名牌高度稳定。
- 客栈：正式背景显示“宾至如归”；陈掌柜互动只有一个 Dialogue，关系说明在独立小提示中。
- 商行：background v5 / foreground v1 实际 CDN 校验通过；没有旧店名大字。伙计对白正常；出售一份大米后 120→136 文，库存 2→1，结果位于底部状态区。
- 杂货铺：正式背景正常；购买一份大米后 120→108 文，库存 2→3；列表底边与反馈区顶边相接，不重叠，旧 toast 高度为 0。
- 青丝：background v7 / foreground v1 实际 CDN 校验通过，无旧店名或错位字；NPC 对话及发型服务入口可见。
- 衣坊：background v7 / foreground v2 实际 CDN 校验通过，两条长条消失；NPC 互动、雨前送样对白正常。DOM 中主对白实例为 1，toast 隐藏；短语不再拆成“料 / 子”。
- 白石街：实际键盘移动前后，普通 NPC 相对路面和建筑位置稳定，NPC 标签和玩家标签分别绑定自己的世界坐标；右上 HUD 不跟随地图。

实际浏览器视口为 1280×720。未声称完成所有设备分辨率或微信真机验收；微信真机留给下一轮用户验收。

## 自动锁定

默认 `npm test` 包含 Web 坐标、测量换行、单一对白入口、hash/尺寸校验、损坏 CDN 响应、DEV 同版本恢复、失败次数上限、旧 public 图禁止回流，以及微信缓存/版本/fallback 测试。

额外执行 `tests/baishi-assets.test.ts`。构建后检查 Web 输出不存在归档的旧室内副本。`npm run typecheck` 现在包含 Web 全部 TypeScript。

本轮结果：默认测试 213 项，211 通过、2 项数据库集成测试因环境条件跳过、0 失败；额外素材测试 3/3 通过。TypeScript、Web build、微信 clean build、git diff --check 通过。Web 构建仍有既有的大 bundle 提醒，不属于本轮修复范围。微信输出 43 张 PNG，原有三个资源分包保留，无已删除室内分包回流。

普通 5173 页面四种入口及 healthz 均实测 HTTP 200；已在浏览器点击“使用测试账号进入”并到达“开始游戏”页面。最终商行购买反馈验收：确认按钮底边约 575px，反馈区从 612px 开始，二者不重叠。

## 后续人工测试入口

正常开发使用 5173（现有本地 API），5174 是隔离验收夹具，不用于替代现有存档。两者均只在本机开发使用。

- http://localhost:5173/
- http://localhost:5173/?debugCollision=1
- http://localhost:5173/?debugOpenAll=1
- http://localhost:5173/?debugCollision=1&debugOpenAll=1

开发页面更新后刷新即可。不要通过清空玩家数据处理图片缓存；旧图片缓存因新 key/hash 不再被命中。
