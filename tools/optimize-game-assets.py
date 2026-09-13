#!/usr/bin/env python3
"""Create a NEW versioned runtime PNG from an archived, higher quality image.

Run with Python and Pillow 12.3.0 (tools/requirements-assets.txt). Never
overwrite an existing version, and inspect the resulting image before release.
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageStat


POLICIES = {
    "map": {"palette": None, "resize": False},
    "interior-background": {"palette": None, "resize": False},
    "interior-foreground": {"palette": None, "resize": False},
    "portrait": {"palette": 256, "resize": False},
    "sign": {"palette": None, "resize": True},
    "icon": {"palette": 256, "resize": False},
}


def prepare(image: Image.Image, category: str, width: int | None) -> Image.Image:
    policy = POLICIES[category]
    rgba = image.convert("RGBA")
    if width is not None:
        if not policy["resize"] or width <= 0 or width > rgba.width:
            raise ValueError("Only signs may opt in to a smaller, positive width")
        rgba = rgba.resize((width, round(rgba.height * width / rgba.width)), Image.Resampling.LANCZOS)
    palette = policy["palette"]
    if palette is None:
        if category in ("map", "interior-background"):
            rgb = rgba.convert("RGB").point(lambda value: (value // 4) * 4)
            result = rgb.convert("RGBA")
            result.putalpha(rgba.getchannel("A"))
            return result
        return rgba
    # Quantize colours only: alpha stays byte-for-byte identical at the same
    # resolution, including all partially transparent outline pixels.
    original_rgb = rgba.convert("RGB")
    colour_table = original_rgb.quantize(colors=palette, method=Image.Quantize.MEDIANCUT)
    rgb = original_rgb.quantize(palette=colour_table, dither=Image.Dither.FLOYDSTEINBERG).convert("RGB")
    result = rgb.convert("RGBA")
    result.putalpha(rgba.getchannel("A"))
    return result


def psnr(source: Image.Image, output: Image.Image) -> float:
    if source.size != output.size:
        source = source.resize(output.size, Image.Resampling.LANCZOS)
    original = source.convert("RGB")
    compared = output.convert("RGB")
    rms = ImageStat.Stat(ImageChops.difference(original, compared)).rms
    mse = sum(value * value for value in rms) / 3
    return math.inf if mse == 0 else 10 * math.log10(255 * 255 / mse)


def optimize(source: Path, destination: Path, category: str, width: int | None = None) -> dict[str, object]:
    if source.resolve() == destination.resolve() or destination.exists():
        raise ValueError("Output must be a new, unused versioned filename")
    if category not in POLICIES or source.suffix.lower() != ".png" or destination.suffix.lower() != ".png":
        raise ValueError("Choose a supported category and PNG input/output")
    with Image.open(source) as image:
        image.load()
        before = image.convert("RGBA")
        after = prepare(image, category, width)
    if width is None and after.size != before.size:
        raise ValueError("Pixel size changed without explicit permission")
    if width is None and ImageChops.difference(before.getchannel("A"), after.getchannel("A")).getbbox():
        raise ValueError("Alpha changed")
    quality = psnr(before, after)
    if quality < 36.0:
        raise ValueError(f"Colour quality threshold failed: PSNR {quality:.2f} dB")
    destination.parent.mkdir(parents=True, exist_ok=True)
    after.save(destination, format="PNG", optimize=True, compress_level=9)
    with Image.open(destination) as check:
        check.load()
        if check.size != after.size or check.convert("RGBA").tobytes() != after.tobytes():
            destination.unlink()
            raise ValueError("Output failed decode or pixel equality verification")
    old, new = source.stat().st_size, destination.stat().st_size
    if new >= old:
        destination.unlink()
        raise ValueError(f"No size improvement: {old} -> {new} bytes")
    return {"source": str(source), "destination": str(destination), "category": category,
            "dimensions": after.size, "originalBytes": old, "optimizedBytes": new,
            "reductionPercent": round((old - new) * 100 / old, 2), "psnrDb": round(quality, 2)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--category", choices=sorted(POLICIES), required=True)
    parser.add_argument("--width", type=int, help="Explicit runtime width for signs only")
    args = parser.parse_args()
    print(optimize(args.source, args.destination, args.category, args.width), flush=True)


if __name__ == "__main__":
    main()
