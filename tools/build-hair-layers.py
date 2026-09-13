"""Engineer generated hair atlases into the existing 64px animation cells.

Source atlases: three styles across, down/left/right/up rows. Original base
sheets are never overwritten. Pillow required; all runtime outputs are PNG.
"""
import argparse
import json
from pathlib import Path
from statistics import median
from PIL import Image, ImageDraw, ImageChops

ROOT=Path(__file__).resolve().parents[1]
FORMAL=ROOT/'apps/admin/public/scene-layers/baishi/formal'
OUT=FORMAL/'hair-v3'

def old_hair_pixel(r,g,b,a):
    return a>0 and 24<r<170 and 18<g<150 and 15<b<145 and r>=g-7 and g>=b-7 and not (g>r+12 and g>b+10)

def extract(atlas,col,row,gender):
    w,h=atlas.size
    if gender=='male':
        # This source has uneven row margins. Explicit source regions
        # exclude adjacent hairstyles before fitting each runtime frame.
        left,right=[(45,385),(397,694),(705,1048)][col]
        top,bottom=[(100,415),(430,715),(755,1035),(1070,1365)][row]
        box=(round(left*w/1086),round(top*h/1448),round(right*w/1086),round(bottom*h/1448))
    else:box=(round(col*w/3),round(row*h/4),round((col+1)*w/3),round((row+1)*h/4))
    img=atlas.crop(box).convert('RGBA')
    # Some source generators bake a neutral checkerboard into RGB output.
    pixels=img.load()
    for y in range(img.height):
        for x in range(img.width):
            r,g,b,a=pixels[x,y]
            if min(r,g,b)>85 and max(r,g,b)-min(r,g,b)<12:pixels[x,y]=(0,0,0,0)
    alpha=img.getchannel('A').point(lambda a:255 if a>64 else 0)
    box=alpha.getbbox()
    if not box:raise ValueError('Empty hair source')
    return img.crop(box)

def frame_base(original,row,gender):
    skin=[]
    for y in range(14,34):
        for x in range(64):
            r,g,b,a=original.getpixel((x,y))
            if a>180 and r>165 and g>110 and r-g>12 and g-b>10:skin.append((x,y))
    head=original.crop((0,0,64,33)).getchannel('A').point(lambda a:255 if a>150 else 0).getbbox()
    if not head:raise ValueError('No head in frame')
    # Side/back hair can extend beyond the face. The scalp center follows the
    # original per-frame head, never a new world or foot anchor.
    cx=(head[0]+head[2])/2
    skin=[(x,y) for x,y in skin if abs(x-cx)<=13]
    if skin and row!=3:cx=(min(x for x,y in skin)+max(x for x,y in skin))/2+(2 if row==1 else -2 if row==2 else 0)
    base=original.copy()
    for y in range(34):
        for x in range(64):base.putpixel((x,y),(0,0,0,0))
    draw=ImageDraw.Draw(base)
    face_colors=[original.getpixel((x,y)) for x,y in skin if y>=22]
    tone=tuple(int(median([pixel[channel] for pixel in face_colors])) for channel in range(3)) if face_colors else (228,177,133)
    draw.ellipse((cx-10,9,cx+10,32),fill=(*tone,255))
    # Preserve real eyes/cheeks only below the forehead. Copying upper rows
    # also copied old bangs and pale hair ornaments into the neutral face.
    if row!=3:
        for y in range(22,34):
            xs=[x for x,sy in skin if sy==y and abs(x-cx)<=12]
            if xs:
                for x in range(min(xs),max(xs)+1):base.putpixel((x,y),original.getpixel((x,y)))
    else:
        # Keep ears, not the light-colored ornaments embedded in old hair.
        for x,y in skin:
            if y>=28:base.putpixel((x,y),original.getpixel((x,y)))
    # The collar starts above the lower half in a few poses. Retain its green
    # pixels too, then restore the entire lower half verbatim.
    for y in range(28,32):
        for x in range(64):
            r,g,b,a=original.getpixel((x,y))
            if a and g>r and g>b:base.putpixel((x,y),(r,g,b,a))
    base.paste(original.crop((0,32,64,64)),(0,32))
    # The original female sprites have loose fixed-hair strands below row 32.
    # Remove those pixels only beside the head; leave the outfit and limbs intact.
    for y in range(32,39 if gender=='female' else 32):
        for x in range(64):
            r,g,b,a=original.getpixel((x,y))
            if abs(x-cx)<21 and old_hair_pixel(r,g,b,a):
                if (row==0 and (x<cx-11 or x>cx+11)) or (row in (1,2) and (x<cx-12 or x>cx+12)):
                    base.putpixel((x,y),(0,0,0,0))
    return base,cx

def build(gender,atlas_path):
    original=Image.open(FORMAL/f'player_{gender}_base.png').convert('RGBA')
    assert original.size==(256,256)
    atlas=Image.open(atlas_path).convert('RGBA')
    base=Image.new('RGBA',(256,256));layers=[Image.new('RGBA',(256,256)) for _ in range(3)]
    for row in range(4):
        hairs=[extract(atlas,i,row,gender) for i in range(3)]
        for col in range(4):
            frame=original.crop((col*64,row*64,(col+1)*64,(row+1)*64))
            bald,cx=frame_base(frame,row,gender);base.paste(bald,(col*64,row*64))
            for style,hair in enumerate(hairs):
                width=(31 if gender=='male' else 33)+(2 if style==2 else 0)
                height=round(hair.height*width/hair.width)
                if height>38:width=round(width*38/height);height=38
                if row==3:height=max(height,34 if gender=='female' else 30)
                small=hair.resize((width,height),Image.Resampling.LANCZOS)
                x=round(cx-width/2)
                head=frame.crop((0,0,64,24)).getchannel('A').point(lambda a:255 if a>150 else 0).getbbox()
                y=max(0,min(5,(head[1] if head else 2)+(1 if row!=3 else 0)))
                # Never bleed a hairstyle into an adjacent animation cell.
                cell=Image.new('RGBA',(64,64));cell.alpha_composite(small,(max(0,min(64-width,x)),y))
                layers[style].paste(cell,(col*64,row*64))
    OUT.mkdir(parents=True,exist_ok=True)
    paths=[]
    for name,img in [(f'player_{gender}_body_v3',base),*[(f'{"m" if gender=="male" else "f"}_hair_0{i+1}_v3',img) for i,img in enumerate(layers)]]:
        target=OUT/f'{name}.png';img.save(target,optimize=True)
        assert Image.open(target).size==(256,256) and target.stat().st_size<80*1024
        paths.append({'file':str(target.relative_to(ROOT)),'bytes':target.stat().st_size})
    contact=Image.new('RGBA',(768,256))
    for i,layer in enumerate(layers):contact.paste(Image.alpha_composite(base,layer),(i*256,0))
    contact.resize((1536,512),Image.Resampling.NEAREST).save(ROOT/f'tmp/hair-{gender}-comparison.png')
    return paths

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--male',required=True);p.add_argument('--female',required=True);args=p.parse_args()
    print(json.dumps(build('male',args.male)+build('female',args.female),indent=2))
