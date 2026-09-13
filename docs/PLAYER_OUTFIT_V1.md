# 玩家 Outfit V1

Outfit 是一整套服装，稳定 ID 为 `M_OUTFIT_01/02/03`、`F_OUTFIT_01/02/03`。`Face`、`Hair`、`Headwear` 槽位不随换装改变。运行时合成顺序为 `Body Base → Outfit → Face → Hair → Headwear`，最后仍使用一张 4×4 动画贴图和原脚底锚点。

原 `body_v5` 是设计来源。`tools/build-outfit-layers.py` 把它逐帧拆为仅保留裸露手部等基础像素的 `body_v6` 与 01 套装；两层合成与原图逐像素一致。02、03 套装基于同一帧位制作款式、衣领、腰线和下摆变化。八张运行图在 `apps/admin/public/scene-layers/baishi/formal/outfit-v1/`，均为 256×256 透明 PNG，64×64/帧。美术来源不另复制到 Git。

`OutfitConfig` 只描述衣服；`OutfitOffer` 保存店铺价格和上下架。春衫衣坊 `B_CLOTH` 首轮测试价格为 70、110、150 文，每种性别相同。服装持有权复用现有 `PlayerState.cosmetics` 持久化集合，`ownedOutfitIds` 是目录 API 返回的服装子集。建角时选定的 Outfit 自动进入持有集合；`outfitId` 是当前穿着。重新开始会通过现有初始化链清除旧角色服装记录。

`GET /v1/outfits/catalog?shopId=B_CLOTH` 返回适配服装、报价、持有和当前穿着。购买复用 `POST /v1/appearance/purchase`，服务端在同一事务里核对上架、性别、余额，再扣款、登记持有并穿上。已持有服装复用 `POST /v1/appearance/change` 免费换穿。两个写接口都使用已有 `requestId` 幂等事务；客户端试穿只修改内存中的 `previewOutfitId`。后台「服装与衣坊报价」页编辑发布配置。

运行 `tools/audit-outfit-layers.py` 校验 54 种 Face×Hair×Outfit 组合各 16 帧、尺寸、脚底边界和初始套装的逐像素还原。最终画面仍由微信真机验收。
