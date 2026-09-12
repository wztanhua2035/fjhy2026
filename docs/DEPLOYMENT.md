# Zeabur 部署准备

本工程尚未推送到任何远程仓库，未创建云服务，未产生部署费用。以下步骤用于先部署 STAGING，再通过验收提升至 PROD。不要将开发数据库或演示进程当作生产服务。

## 需要准备的账号与配置

1. Zeabur 项目和可供其读取的 Git 仓库。
2. 微信小游戏 AppID 和仅服务端持有的 AppSecret。
3. API、后台和资源域名及 HTTPS。方案建议 `api.fjhy.wzpy.net`、`admin.fjhy.wzpy.net`、`assets.fjhy.wzpy.net`，这些仅是参考名，尚未验证归属或配置。
4. COS / R2 / OSS 任一对象存储及 CDN。地图与正式美术资源放对象存储，API 只返回版本及资源地址。

## 服务创建顺序

在独立 STAGING Project 中创建 PostgreSQL 17 和 Redis 7。数据库端口只供项目内网访问，不建立公共数据库入口。再从同一仓库创建以下三个服务，构建上下文必须是仓库根目录：

- `game-api`：选择 `Dockerfile.game-api`。设置 `ZBPACK_DOCKERFILE_PATH=Dockerfile.game-api` 可显式指定。
- `game-worker`：选择 `Dockerfile.game-worker`；同理设置对应路径。
- `admin`：选择 `Dockerfile.admin`，构建参数 `VITE_API_BASE_URL=https://你的API域名`，端口固定 8080。前端地址是构建时变量，改后需要重新构建。

Zeabur 支持按服务名匹配 Dockerfile 后缀和显式 Dockerfile 路径。具体控制台入口以当前界面为准，参考 [Zeabur Dockerfile 文档](https://zeabur.com/docs/en-US/deploy/methods/dockerfile)。API 和 Worker 使用 `0.0.0.0:$PORT`；后台 Nginx 使用 8080。参考 [健康检查说明](https://zeabur.com/docs/en-US/operations/monitoring/health-checks)。

## API 环境变量

- `NODE_ENV=production`，`APP_ENV=STAGING` 或 `PROD`。
- `PORT=8080`，与服务端口一致。
- `DATABASE_URL`：Zeabur PostgreSQL 的内网连接串，独立数据库。
- `REDIS_URL`：Redis 内网连接串，Worker 必需；API 原型暂未依赖缓存可用性。
- `JWT_SECRET`：32 位以上随机密钥。
- `SUBJECT_HASH_SECRET`：不同的 32 位以上随机密钥。已产生真实玩家后不能随意更改，否则身份摘要改变。
- `ADMIN_TOKEN`：第三个独立的 32 位以上随机值。仅运维知晓，当前按单管理员方式使用。
- `WECHAT_APP_ID`、`WECHAT_APP_SECRET`：小游戏后台取得。
- `ALLOW_DEV_AUTH=false`：线上强制关闭开发账号入口。
- `ADMIN_ORIGIN=https://你的后台域名`：精确浏览器 CORS 来源，不带尾部斜线。
- `ASSET_BASE_URL=https://你的资源域名`：不带末尾斜线，服务端拼接 `/1/manifest.json`。

Worker 设置 `DATABASE_URL`、`REDIS_URL`、`PORT=8081`、`NODE_ENV=production` 即可。Worker 不需要微信密钥或后台令牌。后台只需公开 API 地址，不能添加 AppSecret、数据库连接串或后台令牌到前端构建参数。

## 初始化数据库

`game-api` 容器启动时会先执行 `prisma migrate deploy`，确认所有已提交迁移成功后才启动 HTTP 服务。当前 Zeabur STAGING 为单实例，这可以避免服务终端不可用时出现“容器存活但玩家查询因缺列而失败”。如以后扩展为多实例，应改为 Zeabur 独立 release/migration job，并让所有 API 实例依赖该任务完成。

需要手动检查或补跑时，也可以在一次性迁移任务或服务终端中运行：

```sh
npm run db:migrate
node --import tsx database/seed.ts
```

不要使用 `prisma db push` 替代正式迁移。Seed 只创建版本 1，重复运行不覆盖后台已经发布的世界配置。

## 资源发布

先执行 `npm run assets:build`。把 `assets/public/1` 的内容上传至 CDN 的 `/1/` 目录。保留目录层级，不能把 manifest 中的 `maps` 展平。开启正确的 MIME、跨域读取和静态长缓存；地图及依赖图片应一起上传。

原型目前将两张 TMX 随 Cocos 主包携带以保证首屏可用。服务端已经提供资源清单 URL，完整远程 AssetBundle 下载、哈希校验、缓存淘汰和版本回滚仍需在下一轮客户端资源工作中接通；不要误认为当前已实现差分热更新。生产资源发布时应新建版本目录，不覆盖旧目录。

## STAGING 验收

1. `/healthz` 返回 200；数据库迁移和 seed 后 `/readyz` 返回 200。Worker 的 `/readyz` 必须同时检查 PostgreSQL 与 Redis。
2. `/v1/auth/dev` 在 STAGING 返回 404；匿名访问 `/v1/bootstrap` 与 `/admin/world` 返回 401。
3. 微信真机新账号建角，退出重登外观一致；从客栈进入白石街，看到 10 个地块、5 栋建筑、3 个 NPC。
4. 买米再卖米，验证 120 → 108 → 124，数据库账本逐笔一致。重复发送同一请求仅返回原结果。
5. 后台修改杂货店名称，草稿校验、发布，客户端重新加载场景后显示新名称；复制历史配置为新草稿发布后恢复。
6. 两个账号分别建角、换装，另一账号重新进入场景取得真实外观 Ghost。赠礼与地产入口仍返回 `FEATURE_NOT_ENABLED`。
7. 服务滚动重启后玩家存档保持；并发压测、日志、错误率与数据库连接数在上线前另行记录。

静态检查：配置线上环境后执行 `npm run release:check`。检查失败会逐项报出缺失项，但通过不能替代真机和数据库验收。

## 生产提升与回滚

新建独立 PROD Project 和数据库，用相同的已验收提交构建服务，分别配置密钥、域名、资源。发布前做数据库备份并验证恢复。数据库迁移用兼容扩展策略；代码回滚时不得直接删除数据表或逆转已写入的资产数据。

世界配置回滚：在后台选取历史版本，复制到编辑器，以当前线上版本为 basedOn 保存新草稿，校验后发布。旧版本保留，发布号继续递增。API 不接受已过期草稿覆盖新版本。

至少建立每日 PostgreSQL 备份、保留周期、异地副本和恢复演练；备份由 Zeabur/数据库运维平台配置，仓库未自动开通备份。API 容器健康检查、进程日志已提供；错误告警、集中日志、多管理员 RBAC、Redis 限流、完整压测属于正式上线前追加工作。
