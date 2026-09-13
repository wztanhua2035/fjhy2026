#!/usr/bin/env python3
"""Generate the first Baishi remote asset audit from the published manifest."""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path("assets/remote")
BUDGETS = {
    "scene-map": (300, 900, 1229),
    "scene-background": (200, 500, 700),
    "scene-foreground": (30, 150, 250),
    "shop-sign": (20, 100, 150),
    "portrait": (100, 350, 600),
    "icon": (5, 50, 80),
}


def audit(root: Path = ROOT) -> str:
    manifest = json.loads((root / "manifests/remote-asset-manifest-v1.json").read_text(encoding="utf-8"))
    rows = []
    current_paths = set()
    total_before = total_after = 0
    for resource_id, entry in manifest["resources"].items():
        file = root / entry["path"]
        current_paths.add(file.resolve())
        old_file = file
        if entry["version"] > 1 and (entry["type"] != "scene-foreground" or entry["version"] > 2):
            old_file = file.with_name(file.name.replace(f'_v{entry["version"]}', f'_v{entry["version"] - 1}'))
        if not old_file.exists():
            old_file = file
        with Image.open(file) as image:
            image.load()
            size = f"{image.width}×{image.height}"
            alpha = "有" if "A" in image.getbands() and image.getchannel("A").getextrema()[0] < 255 else "无"
            fmt = image.format
        old, new = old_file.stat().st_size, file.stat().st_size
        total_before += old
        total_after += new
        low, target, hard = BUDGETS[entry["type"]]
        status = "超硬上限" if new > hard * 1024 else ("高于目标" if new > target * 1000 else "达标")
        suggestion = "保留，按需验证" if old == new else ("通道低2位轻量量化" if entry["type"] == "scene-background" else "按实际显示尺寸缩放")
        rows.append((new, f"| {resource_id} | `{entry['path']}` | {size} | {fmt} | {alpha} | {old:,} | {new:,} | {entry['type']} | {low}–{target} KB / ≤{hard} KB | {status} | {suggestion} |"))
    archived_bytes = archived_count = 0
    for file in root.rglob("*.png"):
        if file.resolve() in current_paths:
            continue
        category = "scene-background" if "background_" in file.name else "shop-sign" if "sign_" in file.name else "scene-foreground"
        low, target, hard = BUDGETS[category]
        with Image.open(file) as image:
            image.load()
            size = f"{image.width}×{image.height}"
            alpha = "有" if "A" in image.getbands() and image.getchannel("A").getextrema()[0] < 255 else "无"
            fmt = image.format
        bytes_ = file.stat().st_size
        archived_bytes += bytes_
        archived_count += 1
        status = "旧版超硬上限" if bytes_ > hard * 1024 else "旧版保留"
        rows.append((bytes_, f"| —（旧版） | `{file.relative_to(root).as_posix()}` | {size} | {fmt} | {alpha} | {bytes_:,} | — | {category} | {low}–{target} KB / ≤{hard} KB | {status} | 保留用于回滚，不再作为运行图 |"))
    lines = ["# 白石街远程资源体积审计 V1", "", "单位：字节；预算目标以十进制 KB 表示，硬上限按 KiB 计算。按仓库实际文件大小降序，覆盖 assets/remote 下全部 PNG；旧版已不在当前 manifest 中。", "", "| Resource ID | relativePath | 像素 | 格式 | 有透明像素 | 优化前字节 | 当前字节 | 类别 | 目标 / 硬上限 | 当前状态 | 处理建议 |", "| --- | --- | ---: | --- | --- | ---: | ---: | --- | --- | --- | --- |"]
    lines.extend(row for _, row in sorted(rows, key=lambda item: -item[0]))
    saved = total_before - total_after
    lines.extend(["", f"当前 17 项运行资源合计：{total_before:,} → {total_after:,} 字节，节省 {saved:,} 字节（{saved / 1024 / 1024:.2f} MiB，{saved / total_before * 100:.1f}%）。另有 {archived_count} 个旧版 PNG 共 {archived_bytes:,} 字节留在 Git / COS 以便回滚，不计入当前运行下载量。", "", "背景全部保留原像素尺寸和逐像素 alpha。前景层原本远低于硬上限，故不生成无意义新版本。招牌保持原画内容，384px 宽仍约为游戏实际显示宽度的 2.3 倍。", "", "PSNR 仅是辅助指标；六座室内及招牌最终画质和 foreground 遮挡以 Web / 微信真机验收为准。"])
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    output = Path("docs/ASSET_SIZE_AUDIT_V1.md")
    output.write_text(audit(), encoding="utf-8")
    print(f"Wrote {output}", flush=True)
