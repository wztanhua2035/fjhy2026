"""Build pixel-aligned Face V1 layers from the approved neutral player sheets.

The source outfit and every frame's foot anchor remain unchanged. Face art is
drawn in each original 64 px cell; it never relies on runtime frame offsets.
"""
from pathlib import Path
from statistics import median
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'apps/admin/public/scene-layers/baishi/formal/hair-v3'
OUT = ROOT / 'apps/admin/public/scene-layers/baishi/formal/face-v2'
TONES = [(245, 210, 179), (234, 194, 158), (240, 202, 174)]
INK = (64, 51, 53, 255)
SHADE = (194, 143, 121, 255)


def is_skin(pixel):
    r, g, b, a = pixel
    return a > 160 and r > 155 and g > 105 and r - g > 13 and g - b > 8


def center(frame):
    xs = [x for y in range(13, 22) for x in range(64)
          if is_skin(frame.getpixel((x, y)))]
    if not xs:
        raise ValueError('Neutral base has no head')
    return round(median(xs))


def paint_face(cell, cx, direction, style, tone, gender):
    d = ImageDraw.Draw(cell)
    dark = INK if gender == 'male' else (70, 48, 57, 255)
    cheek = (226, 156, 146, 255)
    # A 1 px contour difference and independent feature geometry give each
    # template a distinct expression without shifting its hair registration.
    widths = [11, 10, 11]
    width = widths[style]
    bottom = [32, 31, 33][style]
    d.ellipse((cx-width, 9, cx+width, bottom), fill=(*tone, 255))
    d.rectangle((cx-3, 30, cx+2, 36), fill=(*tone, 255))
    d.point((cx-8, 27), fill=(*tone, 255))
    d.point((cx+8, 27), fill=(*tone, 255))
    if direction == 3:
        d.line((cx-3, 31, cx+2, 31), fill=SHADE)
        return
    if direction == 0:
        if style == 0:  # 明朗圆眼，柔和短眉
            for offset in (-4, 4):
                d.line((cx+offset-1, 23, cx+offset+1, 23), fill=dark)
                d.rectangle((cx+offset-1, 26, cx+offset, 28), fill=dark)
                d.point((cx+offset-1, 26), fill=(255, 245, 230, 255))
            d.line((cx-1, 30, cx+1, 30), fill=SHADE)
        elif style == 1:  # 修长眼，上扬眉，利落神情
            for offset in (-4, 4):
                d.line((cx+offset-2, 23, cx+offset+1, 22), fill=dark)
                d.line((cx+offset-2, 27, cx+offset+1, 26), fill=dark, width=1)
                d.point((cx+offset, 28), fill=dark)
            d.point((cx, 30), fill=SHADE)
        else:  # 杏眼，弯眉，轻笑
            for offset in (-4, 4):
                d.line((cx+offset-2, 23, cx+offset, 22), fill=dark)
                d.point((cx+offset+1, 23), fill=dark)
                d.rectangle((cx+offset-1, 26, cx+offset+1, 27), fill=dark)
                d.point((cx+offset, 26), fill=(255, 244, 226, 255))
            d.point((cx-7, 29), fill=cheek)
            d.point((cx+7, 29), fill=cheek)
            d.line((cx-1, 30, cx, 31, cx+1, 30), fill=SHADE)
        d.point((cx, 28), fill=(224, 170, 143, 255))
    else:
        # Front of the face points left in row 1 and right in row 2.
        sign = -1 if direction == 1 else 1
        eye_x = cx + sign * (4 if style != 1 else 5)
        brow_y = 23 if style != 2 else 22
        d.line((eye_x-1, brow_y, eye_x+1, brow_y), fill=dark)
        if style == 1:
            d.line((eye_x-1, 26, eye_x+1, 26), fill=dark)
        else:
            d.rectangle((eye_x, 26, eye_x+1, 28 if style == 0 else 27), fill=dark)
        d.point((cx+sign*8, 29), fill=(224, 170, 143, 255))
        d.point((cx+sign*6, 31), fill=SHADE)


def build(gender):
    source = Image.open(SOURCE / f'player_{gender}_body_v3.png').convert('RGBA')
    assert source.size == (256, 256)
    body = Image.new('RGBA', (256, 256))
    faces = [Image.new('RGBA', (256, 256)) for _ in range(3)]
    for row in range(4):
        for col in range(4):
            box = (col*64, row*64, (col+1)*64, (row+1)*64)
            frame = source.crop(box)
            cx = center(frame)
            cleaned = frame.copy()
            # The old neutral sheet still contains isolated head/neck pixels.
            for y in range(34):
                for x in range(64):
                    cleaned.putpixel((x, y), (0, 0, 0, 0))
            for y in range(34, 39):
                for x in range(64):
                    if is_skin(frame.getpixel((x, y))) or not cx-13 <= x <= cx+13:
                        cleaned.putpixel((x, y), (0, 0, 0, 0))
            # Keep collar pixels only when joined to the actual outfit below.
            connected = {(x, 39) for x in range(64) if cleaned.getpixel((x, 39))[3]}
            frontier = list(connected)
            while frontier:
                x, y = frontier.pop()
                for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1),(x-1,y-1),(x+1,y-1)):
                    if 0 <= nx < 64 and 34 <= ny <= 39 and (nx,ny) not in connected and cleaned.getpixel((nx,ny))[3]:
                        connected.add((nx,ny))
                        frontier.append((nx,ny))
            for y in range(34, 39):
                for x in range(64):
                    if (x,y) not in connected:
                        cleaned.putpixel((x,y), (0,0,0,0))
            body.paste(cleaned, (col*64, row*64))
            for style, tone in enumerate(TONES):
                cell = Image.new('RGBA', (64, 64))
                paint_face(cell, cx, row, style, tone, gender)
                faces[style].paste(cell, (col*64, row*64))
    OUT.mkdir(parents=True, exist_ok=True)
    result = [(f'player_{gender}_body_v5.png', body)]
    prefix = 'm' if gender == 'male' else 'f'
    result += [(f'{prefix}_face_0{i+1}_v2.png', face) for i, face in enumerate(faces)]
    for name, image in result:
        path = OUT / name
        image.save(path, optimize=True)
        print(f'{name} {path.stat().st_size} bytes')


if __name__ == '__main__':
    build('male')
    build('female')
