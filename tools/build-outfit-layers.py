"""Split the accepted clothed walk sheets and build three whole-outfit layers.

Source body_v5 remains archived unchanged. All geometry stays inside each 64px frame.
The starter outfit is a lossless pixel partition of body_v5.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path('apps/admin/public/scene-layers/baishi/formal')
SOURCE = ROOT / 'face-v2'
DEST = ROOT / 'outfit-v1'
DEST.mkdir(parents=True, exist_ok=True)

PALETTES = {
    'male': {2: ((47, 88, 107), (97, 70, 51), (39, 44, 49), (214, 174, 95)),
             3: ((168, 158, 132), (54, 69, 96), (44, 37, 39), (80, 52, 44))},
    'female': {2: ((66, 130, 105), (95, 113, 91), (72, 50, 53), (223, 188, 127)),
               3: ((66, 78, 135), (91, 83, 123), (45, 44, 70), (206, 170, 114))},
}

def is_skin(x, y, px, frame):
    r, g, b, a = px
    # Body only exposes hands at the two outer sides of each accepted frame.
    return a > 35 and 35 <= y <= 52 and (x <= 40 or x >= 53) and r > 86 and r > g * 1.12 and g > b * 1.06

def tint(px, color):
    r, g, b, a = px
    light = max(.42, min(1.33, (r * .24 + g * .59 + b * .17) / 91))
    return (*(min(255, int(c * light)) for c in color), a)

for gender in ('male', 'female'):
    source = Image.open(SOURCE / f'player_{gender}_body_v5.png').convert('RGBA')
    neutral = Image.new('RGBA', source.size)
    outfits = {n: Image.new('RGBA', source.size) for n in (1, 2, 3)}
    for frame in range(16):
        ox, oy = (frame % 4) * 64, (frame // 4) * 64
        tile = source.crop((ox, oy, ox + 64, oy + 64))
        skin = Image.new('RGBA', (64, 64))
        garment = Image.new('RGBA', (64, 64))
        for y in range(64):
            for x in range(64):
                px = tile.getpixel((x, y))
                (skin if is_skin(x, y, px, frame) else garment).putpixel((x, y), px)
        neutral.paste(skin, (ox, oy))
        outfits[1].paste(garment, (ox, oy))
        solid = [(x, y) for y in range(33, 59) for x in range(27, 64) if garment.getpixel((x, y))[3] > 170]
        if not solid:
            raise RuntimeError(f'empty frame: {gender} {frame}')
        top_y = min(y for _, y in solid)
        bottom_y = max(y for _, y in solid)
        for variant in (2, 3):
            top, lower, shoe, trim = PALETTES[gender][variant]
            new = Image.new('RGBA', (64, 64))
            for y in range(64):
                for x in range(64):
                    px = garment.getpixel((x, y))
                    if px[3] == 0:
                        continue
                    if y < top_y + 11: target = top
                    elif y < bottom_y - 5: target = lower
                    else: target = shoe
                    new.putpixel((x, y), tint(px, target))
            draw = ImageDraw.Draw(new)
            # Distinct collar, front closure, belt and coat/dress hem. The back
            # row uses a plain seam; side rows put the closure towards the face.
            waist = min(bottom_y - 6, top_y + 11)
            center = 46 if frame // 4 in (0, 3) else (48 if frame // 4 == 1 else 44)
            if variant == 2:
                draw.line((center - 4, waist, center + 4, waist), fill=(*trim, 240), width=1)
                if frame // 4 != 3:
                    draw.line((center, top_y + 2, center, waist - 2), fill=(*trim, 220), width=1)
                    draw.point((center - 2, top_y + 1), fill=(*trim, 245))
                    draw.point((center + 2, top_y + 1), fill=(*trim, 245))
            else:
                draw.line((center - 3, waist - 1, center + 3, waist - 1), fill=(*trim, 240), width=1)
                if frame // 4 != 3:
                    draw.line((center - 2, top_y + 2, center, top_y + 5), fill=(*trim, 245), width=1)
                    draw.line((center + 2, top_y + 2, center, top_y + 5), fill=(*trim, 245), width=1)
                for xx in (center - 7, center + 7):
                    if garment.getpixel((xx, bottom_y - 5))[3] > 100:
                        draw.line((xx, waist + 2, xx, bottom_y - 4), fill=(*top, 225), width=2)
            outfits[variant].paste(new, (ox, oy))
    for frame in range(16):
        ox, oy = (frame % 4) * 64, (frame // 4) * 64
        original = source.crop((ox, oy, ox + 64, oy + 64))
        reconstructed = Image.alpha_composite(outfits[1].crop((ox, oy, ox + 64, oy + 64)), neutral.crop((ox, oy, ox + 64, oy + 64)))
        if list(original.getdata()) != list(reconstructed.getdata()):
            raise RuntimeError(f'starter outfit failed exact reconstruction: {gender} {frame}')
    neutral.save(DEST / f'player_{gender}_body_v6.png', optimize=True)
    for n, image in outfits.items():
        image.save(DEST / f'{"m" if gender == "male" else "f"}_outfit_0{n}_v1.png', optimize=True)
    print(gender, 'neutral', (DEST / f'player_{gender}_body_v6.png').stat().st_size,
          'outfits', [(DEST / f'{"m" if gender == "male" else "f"}_outfit_0{n}_v1.png').stat().st_size for n in (1, 2, 3)], flush=True)
