# 玩家 Face Template V1

角色创建顺序为性别 → Face → Hair → Outfit → 确认。Face、Hair、Outfit 分别保存稳定 ID；`headwearId` 为可空槽位，当前恒为 `null`，没有头饰资源、选择或商店。行走方向仍由运行时动画状态控制。

Face 配置位于 `packages/game-config/face-templates.ts`，后台可编辑名称、资源 ID、排序与启用状态，Face ID 和性别固定。男：`M_FACE_01` 晴朗、`M_FACE_02` 清峻、`M_FACE_03` 含笑；女：`F_FACE_01` 晴音、`F_FACE_02` 清雅、`F_FACE_03` 笑颜。服务端创建角色时校验 Face 存在、启用且性别一致。以后增加 Face，应先增加正式资源及配置；不能只在后台填一个未打包的资源 ID。

V1 初版资源归档在 `apps/admin/public/scene-layers/baishi/formal/face-v1/`；当前运行资源见下方 V1.1。每张透明 PNG 为 256×256、4×4、单帧 64×64；行顺序为下、左、右、上。Face 图层包含头部、五官、耳部与同色脖子；合成顺序为 body/Outfit → Face → 既有 Hair。Headwear 位置保留在 Hair 之后，但空配置不会渲染任何图片。没有运行时逐帧位移；footAnchor、碰撞、速度和世界位置不变。

`tools/build-face-templates.py` 从上一版已验收的 neutral body 生成 Face 与 body v4。运行 `tools/audit-face-templates.py` 可在 `tmp/face-audit/` 生成男女各三套 Face 与三套 Hair 的全部 18 种组合，每种均为 16 帧放大检查图；另有 body-only 和 body+Face。图片以这些逐帧检查图和最终微信真机为视觉验收依据。

数据库迁移 `202609130002_face_headwear_slots` 只增加两列，并按现有角色性别把已有角色回填为 Face 01；不清空玩家、背包或账本。重新开始删除角色外观记录，重新创建时再次选择 Face，Headwear 恢复为空。

## Face 视觉校准 V1.1

运行贴图改用 `face-v2/` 中的 Face v2 与 neutral body v5，保留 Face ID、Hair v3、外观存档和服务逻辑。三种脸型的脸部横向半径分别从 10/9/10 像素增至 11/10/11 像素；在最宽的脸颊区域，宽度从 21/19/21 像素增至 23/21/23 像素，约增加 9.5%/10.5%/9.5%，高度和帧尺寸不变。base v4 在头颈交界残留零散旧像素；v5 清除头部带并只保留衣领附近的服装像素。Face 的脸和脖子仍使用同一实色皮肤 palette。Hair v3 未修改。

`tests/face-assets.test.py` 检查逐帧尺寸、实色 alpha、受控 palette、孤立皮肤像素、脸宽和身体/服装保留。`tools/audit-face-templates.py` 输出 18 种 Face×Hair 的 16 帧放大图到 `tmp/face-audit-v1-1/`；最终视觉仍以微信真机为准。

后续《全局 UI Design System V1 / Dialogue Layout》待办：玩家与 NPC 半身像在真机对话中被过宽的对话框遮挡；需统一调整对话框宽度与立绘展示区域。本轮不改 Dialogue UI。
