"""Generate 16-frame source/body/hair contact sheets and per-frame geometry."""
from __future__ import annotations
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'apps/admin/public/scene-layers/baishi/formal'
LAYERS=SOURCE/'hair-v3'
OUT=ROOT/'tmp/hair-alignment'
OUT.mkdir(parents=True,exist_ok=True)

def bounds(im:Image.Image):
    box=im.getchannel('A').getbbox()
    return list(box) if box else None

def contact(name:str,image:Image.Image,scale=4):
    canvas=Image.new('RGBA',(256,256),(239,231,218,255))
    for row in range(4):
        for col in range(4):
            cell=Image.new('RGBA',(64,64),(239,231,218,255))
            cell.alpha_composite(image.crop((col*64,row*64,(col+1)*64,(row+1)*64)))
            canvas.paste(cell,(col*64,row*64))
    overlay=ImageDraw.Draw(canvas)
    for edge in (64,128,192):
        overlay.line((edge,0,edge,255),fill=(210,50,30,160))
        overlay.line((0,edge,255,edge),fill=(210,50,30,160))
    for row in range(4):
        for col in range(4):
            x,y=col*64+32,row*64+59
            overlay.line((x-2,y,x+2,y),fill=(25,110,240,255))
            overlay.line((x,y-2,x,y+2),fill=(25,110,240,255))
    target=OUT/f'{name}.png';canvas.resize((256*scale,256*scale),Image.Resampling.NEAREST).save(target)
    return str(target)

records=[]
for gender,prefix in [('male','m'),('female','f')]:
    original=Image.open(SOURCE/f'player_{gender}_base.png').convert('RGBA')
    body=Image.open(LAYERS/f'player_{gender}_body_v3.png').convert('RGBA')
    contact(f'{gender}-original',original)
    contact(f'{gender}-neutral',body)
    for index in (1,2,3):
        hair=Image.open(LAYERS/f'{prefix}_hair_0{index}_v3.png').convert('RGBA')
        combined=Image.alpha_composite(body,hair)
        contact(f'{prefix}-hair-0{index}-composed',combined)
        contact(f'{prefix}-hair-0{index}-only',hair)
        for row in range(4):
            for col in range(4):
                box=(col*64,row*64,(col+1)*64,(row+1)*64)
                skin=[]
                face=original.crop(box)
                for y in range(14,33):
                    for x in range(64):
                        r,g,b,a=face.getpixel((x,y))
                        if a>180 and r>165 and g>110 and r-g>12 and g-b>10:skin.append((x,y))
                hb=bounds(hair.crop(box))
                sb=[min(x for x,y in skin),min(y for x,y in skin),max(x for x,y in skin)+1,max(y for x,y in skin)+1] if skin else None
                records.append(dict(gender=gender,hairId=f'{prefix.upper()}_HAIR_0{index}',row=row,col=col,skinBounds=sb,hairBounds=hb))

print(json.dumps(records,ensure_ascii=False,indent=2))
