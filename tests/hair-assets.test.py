import unittest
from pathlib import Path
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[1]
FORMAL=ROOT/'apps/admin/public/scene-layers/baishi/formal'

class HairAssets(unittest.TestCase):
    def test_runtime_budget_dimensions_and_transparency(self):
        files=list((FORMAL/'hair-v3').glob('*.png'))
        self.assertEqual(len(files),8)
        for file in files:
            with self.subTest(file=file.name):
                image=Image.open(file);image.load()
                self.assertEqual(image.size,(256,256));self.assertEqual(image.mode,'RGBA')
                self.assertLess(file.stat().st_size,80*1024)
                self.assertEqual(image.getchannel('A').getextrema(),(0,255))
                self.assertFalse(any(a==0 and (r or g or b) for r,g,b,a in image.get_flattened_data()),'transparent matte carries dirty RGB')
                for row in range(4):
                    for col in range(4):self.assertIsNotNone(image.crop((col*64,row*64,col*64+64,row*64+64)).getbbox())

    def test_existing_outfit_body_and_feet_are_pixel_identical(self):
        for gender in ['male','female']:
            original=Image.open(FORMAL/f'player_{gender}_base.png').convert('RGBA')
            body=Image.open(FORMAL/'hair-v3'/f'player_{gender}_body_v3.png').convert('RGBA')
            for row in range(4):
                box=(0,row*64+43,256,row*64+64)
                self.assertEqual(body.crop(box).tobytes(),original.crop(box).tobytes())
                for y in range(32,43):
                    for x in range(256):
                        px=(x,row*64+y)
                        if body.getpixel(px)!=original.getpixel(px):
                            self.assertEqual(gender,'female')
                            self.assertLess(y,39)
                            self.assertEqual(body.getpixel(px),(0,0,0,0))

    def test_three_hairstyles_are_distinct_in_every_direction(self):
        for prefix in ['m','f']:
            images=[Image.open(FORMAL/'hair-v3'/f'{prefix}_hair_0{i}_v3.png') for i in range(1,4)]
            for row in range(4):self.assertEqual(len({im.crop((0,row*64,64,row*64+64)).tobytes() for im in images}),3)

    def test_neutral_scalp_uses_one_original_face_tone_per_frame(self):
        for gender in ['male','female']:
            body=Image.open(FORMAL/'hair-v3'/f'player_{gender}_body_v3.png').convert('RGBA')
            for row in range(4):
                for col in range(4):
                    frame=body.crop((col*64,row*64,(col+1)*64,(row+1)*64))
                    tones={frame.getpixel((x,y)) for y in range(10,18) for x in range(64) if frame.getpixel((x,y))[3]>0}
                    self.assertEqual(len(tones),1,(gender,row,col,tones))

    def test_every_hair_frame_covers_the_original_head_without_moving_feet(self):
        for gender,prefix in [('male','m'),('female','f')]:
            original=Image.open(FORMAL/f'player_{gender}_base.png').convert('RGBA')
            body=Image.open(FORMAL/'hair-v3'/f'player_{gender}_body_v3.png').convert('RGBA')
            for style in range(1,4):
                layer=Image.open(FORMAL/'hair-v3'/f'{prefix}_hair_0{style}_v3.png').convert('RGBA')
                composed=Image.alpha_composite(body,layer)
                for row in range(4):
                    for col in range(4):
                        box=(col*64,row*64,col*64+64,row*64+64)
                        head=layer.crop(box).crop((0,0,64,36)).getchannel('A').getbbox()
                        self.assertIsNotNone(head)
                        self.assertLessEqual(head[1],6)
                        self.assertGreaterEqual(head[3],24)
                        foot=(col*64+32,row*64+59)
                        self.assertEqual(composed.getpixel(foot),original.getpixel(foot))

if __name__=='__main__':unittest.main()
