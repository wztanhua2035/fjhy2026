import unittest
from pathlib import Path
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[1]
FORMAL=ROOT/'apps/admin/public/scene-layers/baishi/formal'


class FaceAssetTest(unittest.TestCase):
    def test_six_face_atlases_and_transparency(self):
        for gender,prefix in [('male','m'),('female','f')]:
            faces=[]
            for index in (1,2,3):
                image=Image.open(FORMAL/'face-v1'/f'{prefix}_face_0{index}_v1.png').convert('RGBA')
                self.assertEqual(image.size,(256,256))
                self.assertLess((FORMAL/'face-v1'/f'{prefix}_face_0{index}_v1.png').stat().st_size,80*1024)
                self.assertTrue(all((r,g,b)==(0,0,0) for r,g,b,a in image.getdata() if a==0))
                for row in range(4):
                    for col in range(4):
                        cell=image.crop((col*64,row*64,(col+1)*64,(row+1)*64))
                        self.assertIsNotNone(cell.getchannel('A').getbbox())
                        self.assertTrue(any(cell.getpixel((x,34))[3]>0 for x in range(64)))
                faces.append(image)
            self.assertIsNotNone(ImageChops.difference(faces[0],faces[1]).getbbox())
            self.assertIsNotNone(ImageChops.difference(faces[1],faces[2]).getbbox())

    def test_body_foot_and_outfit_unchanged(self):
        for gender in ('male','female'):
            old=Image.open(FORMAL/'hair-v3'/f'player_{gender}_body_v3.png').convert('RGBA')
            new=Image.open(FORMAL/'face-v1'/f'player_{gender}_body_v4.png').convert('RGBA')
            self.assertEqual(new.size,(256,256))
            for row in range(4):
                for col in range(4):
                    cell=(col*64,row*64,(col+1)*64,(row+1)*64)
                    self.assertEqual(old.crop((cell[0],cell[1]+43,cell[2],cell[3])).tobytes(),new.crop((cell[0],cell[1]+43,cell[2],cell[3])).tobytes())


if __name__=='__main__':unittest.main()
