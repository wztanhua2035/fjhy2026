"""Validate all Face × Hair × Outfit walk combinations without modifying art."""
from pathlib import Path
from PIL import Image

ROOT=Path('apps/admin/public/scene-layers/baishi/formal')
for gender,prefix in (('male','m'),('female','f')):
    body=Image.open(ROOT/'outfit-v1'/f'player_{gender}_body_v6.png').convert('RGBA')
    source=Image.open(ROOT/'face-v2'/f'player_{gender}_body_v5.png').convert('RGBA')
    outfits=[Image.open(ROOT/'outfit-v1'/f'{prefix}_outfit_0{n}_v1.png').convert('RGBA') for n in (1,2,3)]
    faces=[Image.open(ROOT/'face-v2'/f'{prefix}_face_0{n}_v2.png').convert('RGBA') for n in (1,2,3)]
    hairs=[Image.open(ROOT/'hair-v3'/f'{prefix}_hair_0{n}_v3.png').convert('RGBA') for n in (1,2,3)]
    for image in [body,source,*outfits,*faces,*hairs]:
        assert image.size==(256,256),image.size
    assert list(Image.alpha_composite(body,outfits[0]).getdata())==list(source.getdata()),f'{gender}: starter look differs'
    assert all(outfits[0].getpixel((x,y))[3]==0 or body.getpixel((x,y))[3]==0 for y in range(256) for x in range(256)),f'{gender}: body and outfit overlap'
    for face in faces:
        for hair in hairs:
            for outfit in outfits:
                combined=Image.alpha_composite(Image.alpha_composite(Image.alpha_composite(body,outfit),face),hair)
                for frame in range(16):
                    ox,oy=frame%4*64,frame//4*64
                    tile=combined.crop((ox,oy,ox+64,oy+64))
                    assert tile.getbbox(),(gender,frame)
                    assert tile.getbbox()[3]<=60,(gender,frame,'foot overflow')
    print(f'{gender}: 27 Face×Hair×Outfit combinations × 16 frames verified',flush=True)
