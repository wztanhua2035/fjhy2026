# Remote Asset Architecture V1

Large game resources use stable **Resource IDs** and provider-neutral relative paths. Game state, scene configuration, NPC configuration, quests, and database records must never store a COS or other vendor URL.

The shared manifest is [remote-assets.ts](../packages/client-runtime/remote-assets.ts). Each entry contains a `resourceId`, `path`, `version`, `type`, and a temporary packaged `fallbackPath`. Runtime URLs are formed as `ASSET_BASE_URL + path`. The staging/default base is `https://res-fjhy.wzpy.net`.

Web loads the CDN URL first and permits Phaser to use the packaged local fallback URL if the remote URL fails. Interior assets are requested only after their scene becomes active, so a failed interior cannot prevent the home page or White Stone Street from appearing.

WeChat resolves the same manifest entry through `wx.downloadFile`, saves it in the Mini Game local filesystem, and records `resourceId`, `version`, and local `path` in `fjhy-remote-assets-v1.json`. A matching cache entry is reused. A newer manifest version downloads a new filename. V1 retries downloads twice and leaves a clear DEV/STAGING console diagnostic. Cache eviction/LRU can be added behind the cache class without changing manifest semantics.

During this migration, each interior image remains in its existing split package. If a CDN image cannot be downloaded or decoded, the client loads its corresponding split package on demand and uses that packaged file. Neither CDN errors nor fallback errors block startup; an individual interior keeps the lightweight scene fallback instead.

## CDN to self-hosted migration

1. Export the COS objects under `assets/remote`'s directory structure.
2. Copy them unchanged to a normal static host or Nginx document root.
3. Verify the export with `node --import tsx tools/verify-remote-assets.ts <static-root>`.
4. Keep all relative paths unchanged, then point `res-fjhy.wzpy.net` DNS to the new host, or change the centrally supplied `ASSET_BASE_URL` build/runtime setting.
5. Keep the old host available until the CDN/cache transition is complete.

The game client only uses standard HTTPS and has no Tencent COS SDK dependency. Player saves remain unaffected because they store no absolute resource URLs.

## CI publishing

`assets/remote/` is the sole directory allowed to enter the COS publishing workflow. On a `main` push, the workflow validates the shared manifest, uploads only added or modified existing files, HEAD-checks the objects, then publishes `manifests/remote-asset-manifest-v1.json` last. It never deletes COS objects.

The workflow reads `TENCENT_CLOUD_SECRET_ID`, `TENCENT_CLOUD_SECRET_KEY`, `TENCENT_COS_BUCKET`, and `TENCENT_COS_REGION` only from GitHub Actions Secrets. Without all four values it exits successfully with `COS publish skipped: secrets not configured`.

Run `node --import tsx tools/verify-remote-assets.ts <static-root>` to validate that every manifest relative path exists in any ordinary static directory.

## 白石街招牌资源 V1

- 核心建筑的逻辑标识始终使用 `BuildingConfig.id`；玩家可见名称使用可编辑的 `displayName`，未配置时兼容 `name`。
- 招牌配置使用 `signMode`、`signResourceId`、`signTemplateId` 与 `signMeta`。当前五家核心店优先从共享远程资源 manifest 取得透明 PNG；资源不可用时才使用动态模板。
- 招牌源文件位于 `assets/remote/signs/baishi/**`，由既有 COS Asset Publish 工作流上传。微信不打包高清招牌，使用 CDN 与本地缓存；失败不会阻断启动。
- 新版本使用新的 Resource ID 与版本化文件名，不能复用同一个 ID 覆盖旧图。
