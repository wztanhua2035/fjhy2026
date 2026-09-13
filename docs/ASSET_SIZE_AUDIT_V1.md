# 白石街远程资源体积审计 V1

单位：字节；预算目标以十进制 KB 表示，硬上限按 KiB 计算。按仓库实际文件大小降序，覆盖 assets/remote 下全部 PNG；旧版已不在当前 manifest 中。

| Resource ID | relativePath | 像素 | 格式 | 有透明像素 | 优化前字节 | 当前字节 | 类别 | 目标 / 硬上限 | 当前状态 | 处理建议 |
| --- | --- | ---: | --- | --- | ---: | ---: | --- | --- | --- | --- |
| —（旧版） | `signs/baishi/cloth/sign_v1.png` | 1774×887 | PNG | 有 | 1,919,244 | — | shop-sign | 20–100 KB / ≤150 KB | 旧版超硬上限 | 保留用于回滚，不再作为运行图 |
| —（旧版） | `signs/baishi/salon/sign_v1.png` | 1920×819 | PNG | 有 | 1,874,954 | — | shop-sign | 20–100 KB / ≤150 KB | 旧版超硬上限 | 保留用于回滚，不再作为运行图 |
| —（旧版） | `signs/baishi/inn/sign_v1.png` | 1774×887 | PNG | 有 | 1,743,098 | — | shop-sign | 20–100 KB / ≤150 KB | 旧版超硬上限 | 保留用于回滚，不再作为运行图 |
| —（旧版） | `signs/baishi/grocery/sign_v1.png` | 1774×887 | PNG | 有 | 1,702,615 | — | shop-sign | 20–100 KB / ≤150 KB | 旧版超硬上限 | 保留用于回滚，不再作为运行图 |
| —（旧版） | `signs/baishi/trade/sign_v1.png` | 1983×793 | PNG | 有 | 1,660,651 | — | shop-sign | 20–100 KB / ≤150 KB | 旧版超硬上限 | 保留用于回滚，不再作为运行图 |
| —（旧版） | `world/baishi/interiors/cloth/background_v1.png` | 768×640 | PNG | 有 | 1,346,823 | — | scene-background | 200–500 KB / ≤700 KB | 旧版超硬上限 | 保留用于回滚，不再作为运行图 |
| —（旧版） | `world/baishi/interiors/inn/background_v1.png` | 768×640 | PNG | 有 | 1,292,571 | — | scene-background | 200–500 KB / ≤700 KB | 旧版超硬上限 | 保留用于回滚，不再作为运行图 |
| —（旧版） | `world/baishi/interiors/trade/background_v1.png` | 768×640 | PNG | 有 | 1,262,968 | — | scene-background | 200–500 KB / ≤700 KB | 旧版超硬上限 | 保留用于回滚，不再作为运行图 |
| —（旧版） | `world/baishi/interiors/grocery/background_v1.png` | 768×640 | PNG | 有 | 1,257,965 | — | scene-background | 200–500 KB / ≤700 KB | 旧版超硬上限 | 保留用于回滚，不再作为运行图 |
| —（旧版） | `world/baishi/interiors/salon/background_v1.png` | 768×640 | PNG | 有 | 1,217,259 | — | scene-background | 200–500 KB / ≤700 KB | 旧版超硬上限 | 保留用于回滚，不再作为运行图 |
| BAISHI_INTERIOR_CLOTH_BG | `world/baishi/interiors/cloth/background_v2.png` | 768×640 | PNG | 有 | 1,346,823 | 569,384 | scene-background | 200–500 KB / ≤700 KB | 高于目标 | 通道低2位轻量量化 |
| BAISHI_INTERIOR_TRADE_BG | `world/baishi/interiors/trade/background_v2.png` | 768×640 | PNG | 有 | 1,262,968 | 559,470 | scene-background | 200–500 KB / ≤700 KB | 高于目标 | 通道低2位轻量量化 |
| BAISHI_INTERIOR_GROCERY_BG | `world/baishi/interiors/grocery/background_v2.png` | 768×640 | PNG | 有 | 1,257,965 | 547,652 | scene-background | 200–500 KB / ≤700 KB | 高于目标 | 通道低2位轻量量化 |
| BAISHI_INTERIOR_INN_BG | `world/baishi/interiors/inn/background_v2.png` | 768×640 | PNG | 有 | 1,292,571 | 510,136 | scene-background | 200–500 KB / ≤700 KB | 高于目标 | 通道低2位轻量量化 |
| BAISHI_INTERIOR_SALON_BG | `world/baishi/interiors/salon/background_v2.png` | 768×640 | PNG | 有 | 1,217,259 | 469,755 | scene-background | 200–500 KB / ≤700 KB | 达标 | 通道低2位轻量量化 |
| —（旧版） | `world/baishi/interiors/guest-room/background_v2.png` | 448×384 | PNG | 有 | 338,124 | — | scene-background | 200–500 KB / ≤700 KB | 旧版保留 | 保留用于回滚，不再作为运行图 |
| BAISHI_INTERIOR_GUEST_ROOM_BG | `world/baishi/interiors/guest-room/background_v3.png` | 448×384 | PNG | 有 | 338,124 | 125,968 | scene-background | 200–500 KB / ≤700 KB | 达标 | 通道低2位轻量量化 |
| SIGN_BAISHI_CLOTH_V1 | `signs/baishi/cloth/sign_v2.png` | 384×192 | PNG | 有 | 1,919,244 | 101,003 | shop-sign | 20–100 KB / ≤150 KB | 高于目标 | 按实际显示尺寸缩放 |
| SIGN_BAISHI_GROCERY_V1 | `signs/baishi/grocery/sign_v2.png` | 384×192 | PNG | 有 | 1,702,615 | 100,278 | shop-sign | 20–100 KB / ≤150 KB | 高于目标 | 按实际显示尺寸缩放 |
| SIGN_BAISHI_SALON_V1 | `signs/baishi/salon/sign_v2.png` | 384×164 | PNG | 有 | 1,874,954 | 97,559 | shop-sign | 20–100 KB / ≤150 KB | 达标 | 按实际显示尺寸缩放 |
| SIGN_BAISHI_INN_V1 | `signs/baishi/inn/sign_v2.png` | 384×192 | PNG | 有 | 1,743,098 | 93,927 | shop-sign | 20–100 KB / ≤150 KB | 达标 | 按实际显示尺寸缩放 |
| SIGN_BAISHI_TRADE_V1 | `signs/baishi/trade/sign_v2.png` | 384×154 | PNG | 有 | 1,660,651 | 78,103 | shop-sign | 20–100 KB / ≤150 KB | 达标 | 按实际显示尺寸缩放 |
| BAISHI_INTERIOR_TRADE_FG | `world/baishi/interiors/trade/foreground_v1.png` | 768×640 | PNG | 有 | 28,504 | 28,504 | scene-foreground | 30–150 KB / ≤250 KB | 达标 | 保留，按需验证 |
| BAISHI_INTERIOR_CLOTH_FG | `world/baishi/interiors/cloth/foreground_v1.png` | 768×640 | PNG | 有 | 22,789 | 22,789 | scene-foreground | 30–150 KB / ≤250 KB | 达标 | 保留，按需验证 |
| BAISHI_INTERIOR_INN_FG | `world/baishi/interiors/inn/foreground_v1.png` | 768×640 | PNG | 有 | 22,593 | 22,593 | scene-foreground | 30–150 KB / ≤250 KB | 达标 | 保留，按需验证 |
| BAISHI_INTERIOR_GROCERY_FG | `world/baishi/interiors/grocery/foreground_v1.png` | 768×640 | PNG | 有 | 21,203 | 21,203 | scene-foreground | 30–150 KB / ≤250 KB | 达标 | 保留，按需验证 |
| BAISHI_INTERIOR_SALON_FG | `world/baishi/interiors/salon/foreground_v1.png` | 768×640 | PNG | 有 | 15,549 | 15,549 | scene-foreground | 30–150 KB / ≤250 KB | 达标 | 保留，按需验证 |
| BAISHI_INTERIOR_GUEST_ROOM_FG | `world/baishi/interiors/guest-room/foreground_v2.png` | 448×384 | PNG | 有 | 797 | 797 | scene-foreground | 30–150 KB / ≤250 KB | 达标 | 保留，按需验证 |

当前 17 项运行资源合计：15,727,707 → 3,364,670 字节，节省 12,363,037 字节（11.79 MiB，78.6%）。另有 11 个旧版 PNG 共 15,616,272 字节留在 Git / COS 以便回滚，不计入当前运行下载量。

背景全部保留原像素尺寸和逐像素 alpha。前景层原本远低于硬上限，故不生成无意义新版本。招牌保持原画内容，384px 宽仍约为游戏实际显示宽度的 2.3 倍。

PSNR 仅是辅助指标；六座室内及招牌最终画质和 foreground 遮挡以 Web / 微信真机验收为准。
