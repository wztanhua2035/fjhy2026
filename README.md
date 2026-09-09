# 富甲横阳

根据《富甲横阳 微信小游戏完整开发脚本与技术实现方案 V2.2》建立的第一阶段工程。当前交付范围对应第 35 章的可运行原型；第 36 章的赠礼、住宅和商业经营仅保留接口及数据表，尚未宣称为完整游戏。

项目使用 Node.js / TypeScript / Fastify、Prisma / PostgreSQL、Redis / BullMQ、React / Ant Design，以及 Cocos Creator 3.8.8 客户端。世界内容通过服务端配置加载。浏览器试玩复用 Cocos 端的交互控制器和角色绘制规则。

## 先试玩

在项目根目录打开两个终端：

```powershell
npm ci
npm run db:generate
npm run assets:build
npm run dev:demo
```

第二个终端：

```powershell
npm run dev:admin
```

打开 http://127.0.0.1:5173 。输入 `traveler-a` 登录，选择性别、六个基础形象之一与三组配色。确认后出生在客栈，使用 WASD / 方向键或屏幕按钮移动，靠近出口、建筑或 NPC 按 E。`n`n手机局域网试玩：电脑和手机连接同一 Wi‑Fi 后，使用电脑局域网 IPv4 地址访问 `http://电脑局域网IP:5173`。本地演示服务仅用于同一局域网测试。

验收路线：客栈出口 → 向东到街坊杂货铺 → 买一袋鸣山大米（12 文）→ 出门继续向东到白石商行 → 卖出（16 文）。初始 120 文，完成后 124 文，行囊大米归零，账本有初始赠款、买入、卖出三笔记录。两家原型商店全天开放，以便任何时间验收；美发室与服装店按北京时间 08:00–20:30 营业。

演示模式只监听本机，数据在内存中，重启清空。不要将 `dev:demo` 用于 Zeabur。后台演示凭据是 `local-demo-admin-only-not-for-production`，仅对此演示进程有效，正式服务不会接受它。

## 持久化开发

需要 Node.js 22+、Docker Desktop（或已有 PostgreSQL 17 和 Redis 7）。

```powershell
Copy-Item .env.example .env
docker compose -f deploy/compose.yml up -d
```

在 `.env` 中填写三个相互独立的随机密钥。可运行 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 分别生成。不要提交 `.env`。

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

另开终端执行 `npm run worker` 和 `npm run dev:admin`。后台使用 `.env` 中的 `ADMIN_TOKEN`。真实微信登录还需填写 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`；Secret 只进入 API 环境变量。

## 已开发内容

- 服务端微信 code 换取身份、HMAC 身份摘要、JWT 会话，以及仅 DEV 可用的测试登录。
- 男女各 6 个基础角色、初始配色、永久外观保存；男女各 8 种发型、6 款上衣、4 款下装、4 款鞋的配置定义。素材为程序绘制的原型，款式差异尚不等同于正式美术。
- 白石街 80×80 地图、10 个 Plot、5 栋动态建筑、5 个室内场景、街道 3 个 NPC 和旅馆掌柜。完整城镇道路关系以稳定 ID 保留，外围区域尚未开放。
- 四方向移动、地块和室内障碍碰撞、跟随视角、场景切换、NPC 对话记忆、北京时间营业与夜色。
- 商店买卖、容量与库存校验、每日交易限额、账本与事务幂等。玩家写入使用 UUID requestId；相同编号不同载荷返回冲突。余额上限 10^12，数据库保存 BIGINT，JSON 使用安全整数。
- 服饰购买、已拥有服饰试穿、付费理发，以及立即更新真实玩家 Ghost 公开外观。住宅衣柜属于后续地产阶段。
- 世界后台只读列表、完整 JSON 草稿、引用与稳定 ID 校验、DRAFT → TEST → PUBLISHED → ARCHIVED、复制历史配置为新版本回滚。数据库模式记录后台审计；单一管理员令牌为当前原型方案。
- Worker 周期构建 Redis Ghost 候选池；API 当前直接读取最新 PostgreSQL 公共快照，避免换装后缓存延迟。加权抽样和生产级缓存策略待第二阶段。
- Zeabur 三个服务的 Dockerfile、本地数据库配置、迁移、资源版本清单、CI、发布检查和运维步骤。

## 检查与构建

```powershell
npm run typecheck
npm test
npm run build
```

`npm run build` 检查共享代码、API、Worker、后台与测试类型，并生成 `dist/admin`；它不构建 Cocos 引擎。Cocos 工程需由 Creator 导入、编译及真机验收，详见 `docs/WECHAT.md`。

PostgreSQL 集成测试需提供 `TEST_DATABASE_URL`，且数据库名含 `test`，否则明确跳过。CI 已配置 PostgreSQL 服务并执行该测试。测试数据库要先运行迁移和 seed。

## 项目导航

- `apps/client-wechat`：Cocos 工程、Boot 场景、微信网络适配、组合角色和地图运行时。
- `apps/server`：API、领域服务、内存和 PostgreSQL 存储、配置校验。
- `apps/worker`：BullMQ 维护任务与健康检查。
- `apps/admin`：试玩和 React 管理后台。
- `packages/shared-types`、`game-config`、`game-rules`、`client-runtime`：共享类型、世界内容、纯规则和客户端逻辑。
- `database/prisma`：数据库模型与可部署迁移。
- `assets/public/1`：不可变版本目录示例、TMX、瓦片图和 SHA256 清单。
- `docs/DEPLOYMENT.md`：Zeabur 上线步骤、环境变量、迁移、回滚与备份。
- `docs/WECHAT.md`：Cocos 导入、微信构建和真机验收。
- `docs/STATUS.md`：交付边界与验证记录。

原始 V2.1 / V2.2 Word 资料完整保留在 `参考资料`，没有修改。
