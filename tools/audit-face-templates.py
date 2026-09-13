"""Render every Face V1 animation cell at 4x for visual inspection."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
FORMAL = ROOT / 'apps/admin/public/scene-layers/baishi/formal'
OUT = ROOT / 'tmp/face-audit'
OUT.mkdir(parents=True, exist_ok=True)


def contact(name, image):
    sheet = Image.new('RGBA', (256, 256), (244, 237, 225, 255))
    sheet.alpha_composite(image)
    draw = ImageDraw.Draw(sheet)
    for edge in (64, 128, 192):
        draw.line((edge, 0, edge, 255), fill=(199, 71, 52, 255))
        draw.line((0, edge, 255, edge), fill=(199, 71, 52, 255))
    for row in range(4):
        for col in range(4):
            x, y = col*64+32, row*64+59
            draw.line((x-2,y,x+2,y), fill=(30, 113, 231, 255))
            draw.line((x,y-2,x,y+2), fill=(30, 113, 231, 255))
    sheet.resize((1024, 1024), Image.Resampling.NEAREST).save(OUT / f'{name}.png')


for gender, prefix in [('male','m'), ('female','f')]:
    body = Image.open(FORMAL/'face-v1'/f'player_{gender}_body_v4.png').convert('RGBA')
    contact(f'{gender}-body-only', body)
    for index in (1,2,3):
        face = Image.open(FORMAL/'face-v1'/f'{prefix}_face_0{index}_v1.png').convert('RGBA')
        with_face = Image.alpha_composite(body, face)
        contact(f'{prefix}-face-0{index}-body-face', with_face)
        for hair_index in (1,2,3):
            hair = Image.open(FORMAL/'hair-v3'/f'{prefix}_hair_0{hair_index}_v3.png').convert('RGBA')
            contact(f'{prefix}-face-0{index}-hair-0{hair_index}', Image.alpha_composite(with_face,hair))
print(f'Face audit sheets: {OUT}')
