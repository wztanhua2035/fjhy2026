# Hair Service / Hair Layer V1

## 配置与经济

`packages/game-config/hair-services.ts` 定义六个稳定 Hair ID；HairConfig 不含价格。
`WorldConfig.hairs` 与 `WorldConfig.hairServiceOffers` 可通过管理后台“发型与美发服务”编辑、保存草稿、校验、发布。
旧世界缺少这两个字段时使用同一份默认配置；staging 启动只在字段缺失时补齐，不重置运营改价或停用状态。

服务商店沿用 `B_SALON`、`NPC_SALON_HAIRDRESSER`、`INTERIOR_B_SALON` 和 `SALON_SERVICE`。
每种性别的 01/02/03 服务费分别为 24/36/48 文，属于待真机验证的 V1 数值。

`GET /v1/services/appearance?shopId=B_SALON` 返回适配性别的发型与该店报价。
`POST /v1/services/appearance` 仅接受 `shopId, serviceType: HAIR, targetId, requestId`。
服务端重新校验店铺、营业、发型、性别、上架、价格、余额、当前发型，并复用现有 repository.mutate 原子事务及请求摘要幂等机制。
同一请求号只扣一次；相同请求号不同内容冲突。当前发型拒绝收费。
账本类型 `HAIR_SERVICE`，referenceId 为 `shopId:hairId`，保留金额、余额、时间、请求号和交易 ID。
发型只更新当前 appearance，不加入发型收藏；换回旧发型仍按服务报价收费。
沿用 `hairId` 以及原数据库兼容存储 `hairStyleId`，不新增发色或平行存档字段。

## 素材与组合

当前运行素材位于 `apps/admin/public/scene-layers/baishi/formal/hair-v3/`：

- `player_male_body_v3.png`、`player_female_body_v3.png`：保留脸与服装、清除冲突旧发的基础层。
- `m_hair_01_v3.png`、`m_hair_02_v3.png`、`m_hair_03_v3.png`。
- `f_hair_01_v3.png`、`f_hair_02_v3.png`、`f_hair_03_v3.png`。

全部 256×256 RGBA、4×4、64×64 帧，行顺序 down/left/right/up。
原 base PNG 与旧版运行资源均不覆盖；每帧 y≥43 的身体、服装和脚部逐像素一致。仅对女性少量低于头部的旧发像素做透明清理。
头皮底色逐帧取原脸部实际肤色，额头不再复制旧刘海/发饰；保留真实五官与耳朵。角色创建不再有独立肤色属性。
生成发型原图经过透明背景处理、独立方向裁切、逐帧定位和无损 PNG 编码。
每张 Hair 约 11～16KB；每张基础层约 38KB；小资源随现有 baishi-world 包发布，不新增分包、不改远程 manifest。

`hair-assets.ts` 是两端同一 Resource ID→文件映射。
`hair-phaser.ts` 将 body（包含当前 outfit）→hair 预组合一次为帧图集，继续使用原玩家 sprite。
不创建另一套运动实体，原 sprite 的 frame/position/origin/display size/depth/visible/camera 均保持。
footAnchor 仍为 (32,59)，室内缩放沿用 1.43 multiplier，无碰撞或交互范围改动。
缺图保留原完整角色；旧或不匹配的 hairId 回退本性别默认发型。

## 预览与兼容

Web/微信共享 GameController 的临时 previewHairId 和功能面板，正式 appearance 仅根据服务端结果修改。
返回、离开合法服务范围、切场景、退出、重新开始清除预览；面板内禁止移动。
预览人物可点击转向；当前发型显示标识，不能重复确认扣款。
新建角色仍使用同一六个 hairId，微信建角预览也使用同一组合器。
对话 portrait 本轮保持原样，后续另做 Player Portrait Composition V2。

## 资源来源与复现

`tools/build-hair-layers.py --male <三列四行男性源图> --female <三列四行女性源图>`。
需要 Pillow，输出到上述 hair-v3 目录；方向源区和对齐规则在脚本内记录。`tools/audit-hair-alignment.py` 输出男女基础层及六套 Hair 的 16 帧放大检查图。
本轮源图在本机 Codex generated_images 的任务归档目录：
`C:/Users/tanhu/.codex/generated_images/01a08ec7-1a85-7103-81d0-1f197a4eca23/`。
男性源文件 `exec-02bb1f31-0e32-495b-b18d-cc9e749a3515.png`；女性源文件 `exec-4faa6a1d-a2c4-4104-a168-ad81e7ebb4f2.png`。
这些生成源图不是运行资源，不复制进 Git；原始角色图继续作为身体来源。

## 验证

- `npm test` 包含服务、预览、重登、重建、经济回归与渲染状态不变测试。
- `python tests/hair-assets.test.py` 检查像素尺寸、alpha、80KiB 上限、身体像素不变和四方向三种发型差异。
- 用户微信真机负责最终美术验收，自动图像检查不能替代人工观看。
