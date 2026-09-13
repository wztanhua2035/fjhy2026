# 玩家 Face Template V1

角色创建顺序为性别 → Face → Hair → Outfit → 确认。Face、Hair、Outfit 分别保存稳定 ID；`headwearId` 为可空槽位，当前恒为 `null`，没有头饰资源、选择或商店。行走方向仍由运行时动画状态控制。

Face 配置位于 `packages/game-config/face-templates.ts`，后台可编辑名称、资源 ID、排序与启用状态，Face ID 和性别固定。男：`M_FACE_01` 晴朗、`M_FACE_02` 清峻、`M_FACE_03` 含笑；女：`F_FACE_01` 晴音、`F_FACE_02` 清雅、`F_FACE_03` 笑颜。服务端创建角色时校验 Face 存在、启用且性别一致。以后增加 Face，应先增加正式资源及配置；不能只在后台填一个未打包的资源 ID。

运行资源在 `apps/admin/public/scene-layers/baishi/formal/face-v1/`。每张透明 PNG 为 256×256、4×4、单帧 64×64；行顺序为下、左、右、上。`player_*_body_v4.png` 保留原服装、身体和脚底，移除画死的头脸。Face 图层包含头部、五官、耳部与同色脖子；合成顺序为 body/Outfit → Face → 既有 Hair。Headwear 位置保留在 Hair 之后，但空配置不会渲染任何图片。没有运行时逐帧位移；footAnchor、碰撞、速度和世界位置不变。

`tools/build-face-templates.py` 从上一版已验收的 neutral body 生成 Face 与 body v4。运行 `tools/audit-face-templates.py` 可在 `tmp/face-audit/` 生成男女各三套 Face 与三套 Hair 的全部 18 种组合，每种均为 16 帧放大检查图；另有 body-only 和 body+Face。图片以这些逐帧检查图和最终微信真机为视觉验收依据。

数据库迁移 `202609130002_face_headwear_slots` 只增加两列，并按现有角色性别把已有角色回填为 Face 01；不清空玩家、背包或账本。重新开始删除角色外观记录，重新创建时再次选择 Face，Headwear 恢复为空。
