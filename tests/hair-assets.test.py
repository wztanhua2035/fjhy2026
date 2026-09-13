import unittest
from pathlib import Path
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[1]
FORMAL=ROOT/'apps/admin/public/scene-layers/baishi/formal'

class HairAssets(unittest.TestCase):
    def test_runtime_budget_dimensions_and_transparency(self):
        files=list((FORMAL/'hair-v1').glob('*.png'))
        self.assertEqual(len(files),8)
        for file in files:
            with self.subTest(file=file.name):
                image=Image.open(file);image.load()
                self.assertEqual(image.size,(256,256));self.assertEqual(image.mode,'RGBA')
                self.assertLess(file.stat().st_size,80*1024)
                self.assertEqual(image.getchannel('A').getextrema(),(0,255))
                for row in range(4):
                    for col in range(4):self.assertIsNotNone(image.crop((col*64,row*64,col*64+64,row*64+64)).getbbox())

    def test_existing_outfit_body_and_feet_are_pixel_identical(self):
        for gender in ['male','female']:
            original=Image.open(FORMAL/f'player_{gender}_base.png').convert('RGBA')
            body=Image.open(FORMAL/'hair-v1'/f'player_{gender}_body_v1.png').convert('RGBA')
            for row in range(4):
                box=(0,row*64+32,256,row*64+64)
                self.assertEqual(body.crop(box).tobytes(),original.crop(box).tobytes())

    def test_three_hairstyles_are_distinct_in_every_direction(self):
        for prefix in ['m','f']:
            images=[Image.open(FORMAL/'hair-v1'/f'{prefix}_hair_0{i}_v1.png') for i in range(1,4)]
            for row in range(4):self.assertEqual(len({im.crop((0,row*64,64,row*64+64)).tobytes() for im in images}),3)

if __name__=='__main__':unittest.main()
