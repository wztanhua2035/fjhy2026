# Remote Asset Architecture V1

Large game resources use stable **Resource IDs** and provider-neutral relative paths. Game state, scene configuration, NPC configuration, quests, and database records must never store a COS or other vendor URL.

The shared manifest is [remote-assets.ts](../packages/client-runtime/remote-assets.ts). Each entry contains a `resourceId`, `path`, `version`, `type`, and a temporary packaged `fallbackPath`. Runtime URLs are formed as `ASSET_BASE_URL + path`. The staging/default base is `https://res-fjhy.wzpy.net`.

Web loads the CDN URL first and permits Phaser to use the packaged local fallback URL if the remote URL fails. Interior assets are requested only after their scene becomes active, so a failed interior cannot prevent the home page or White Stone Street from appearing.

Local Web development currently reads these same CDN objects through a DEV-only proxy to avoid browser CORS restrictions. Before exposing Web staging/production directly, configure and verify the CDN's browser CORS response for the intended Web origins; the WeChat downloader does not exercise that browser check.

WeChat resolves the same manifest entry through `wx.downloadFile`, saves it in the Mini Game local filesystem, and records `resourceId`, `version`, and local `path` in `fjhy-remote-assets-v1.json`. A matching cache entry is reused. A newer manifest version downloads a new filename. V1 retries downloads twice and leaves a clear DEV/STAGING console diagnostic. Cache eviction/LRU can be added behind the cache class without changing manifest semantics.

The six full-resolution interiors are not in WeChat split packages. A failed CDN download or decode uses the existing lightweight generic interior fallback; the current scene's collision and interactions continue to work. Neither CDN errors nor fallback errors block startup.

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
- Resource ID 是稳定逻辑标识。优化后的文件使用新版本路径和递增 `version`，旧对象保留；不能以新像素覆盖旧 COS key。

## Runtime image size and source policy

The existing artist originals or approved concept archives are the source/master. Do not duplicate large masters into Git merely for this policy. `assets/remote/**` contains versioned runtime PNGs. The first optimized interiors use their immutable previous runtime versions as inputs. Subsequent revisions must start from the high-quality source when available, not repeatedly compress a lossy runtime variant. Generated source files are distinct from the files shipped to players.

Run `python -m pip install -r tools/requirements-assets.txt` once, then use `python tools/optimize-game-assets.py SOURCE NEW_VERSIONED_PATH --category interior-background` (categories: `map`, `interior-background`, `interior-foreground`, `portrait`, `sign`, `icon`). Sign resizes need an explicit `--width 384`; other categories retain dimensions. The tool refuses to overwrite and checks decoding, original alpha, dimensions, colour fidelity and file size. Review the image visually before changing the manifest.

Current budgets: large maps target 300–900 KB/hard 1.2 MiB; interior backgrounds 200–500 KB/hard 700 KiB; foregrounds 30–150 KB/hard 250 KiB; signs 20–100 KB/hard 150 KiB; portraits 100–350 KB/hard 600 KiB; icons 5–50 KB/hard 80 KiB. `npm run verify-asset-budget` warns above targets and fails above hard limits unless the shared resource declares `sizeBudgetOverride: { reason: 'specific reason' }`. The portable manifest records actual width, height, format, byte size and SHA-256; the validator checks these against files. Regenerate it with `npm run assets:remote:sync` after adding a new version; the sync script never overwrites an existing runtime file. This check runs before COS uploads and in general CI. The initial measurements are in [ASSET_SIZE_AUDIT_V1.md](ASSET_SIZE_AUDIT_V1.md).

PNG retains original alpha for the first batch. WebP is an option for future opaque backgrounds only after Web, developer-tool, WeChat device, CDN Content-Type and fallback checks. Preserve older versioned objects and let the existing WeChat version-keyed cache download the new path. Source art from AI generation is not itself a release file.
