import unittest
from pathlib import Path
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[1]
FORMAL=ROOT/'apps/admin/public/scene-layers/baishi/formal'
TONES=((245,210,179),(234,194,158),(240,202,174))
FEATURE_COLORS={(64,51,53),(70,48,57),(194,143,121),(226,156,146),(255,245,230),(255,244,226),(224,170,143)}


class FaceAssetTest(unittest.TestCase):
    def test_six_face_atlases_and_transparency(self):
        for gender,prefix in [('male','m'),('female','f')]:
            faces=[]
            for index in (1,2,3):
                image=Image.open(FORMAL/'face-v2'/f'{prefix}_face_0{index}_v2.png').convert('RGBA')
                self.assertEqual(image.size,(256,256))
                self.assertLess((FORMAL/'face-v2'/f'{prefix}_face_0{index}_v2.png').stat().st_size,80*1024)
                self.assertTrue(all((r,g,b)==(0,0,0) for r,g,b,a in image.get_flattened_data() if a==0))
                for row in range(4):
                    for col in range(4):
                        cell=image.crop((col*64,row*64,(col+1)*64,(row+1)*64))
                        self.assertIsNotNone(cell.getchannel('A').getbbox())
                        self.assertTrue(any(cell.getpixel((x,34))[3]>0 for x in range(64)))
                faces.append(image)
            self.assertIsNotNone(ImageChops.difference(faces[0],faces[1]).getbbox())
            self.assertIsNotNone(ImageChops.difference(faces[1],faces[2]).getbbox())

    def test_face_palette_and_opaque_skin(self):
        for gender,prefix in [('male','m'),('female','f')]:
            for index,tone in enumerate(TONES,1):
                image=Image.open(FORMAL/'face-v2'/f'{prefix}_face_0{index}_v2.png').convert('RGBA')
                for row in range(4):
                    for col in range(4):
                        cell=image.crop((col*64,row*64,(col+1)*64,(row+1)*64))
                        opaque=[pixel for pixel in cell.get_flattened_data() if pixel[3]]
                        self.assertTrue(opaque)
                        self.assertTrue(all(pixel[3]==255 for pixel in opaque),(gender,index,row,col))
                        self.assertTrue(all(pixel[:3]==tone or pixel[:3] in FEATURE_COLORS for pixel in opaque),(gender,index,row,col))
                        self.assertGreater(sum(pixel[:3]==tone for pixel in opaque),200)
                        skin={(x,y) for y in range(64) for x in range(64) if cell.getpixel((x,y))[:3]==tone and cell.getpixel((x,y))[3]==255}
                        surface=skin|{(x,y) for y in range(64) for x in range(64) if cell.getpixel((x,y))[:3]==(194,143,121) and cell.getpixel((x,y))[3]==255}
                        seen={next(iter(skin))}
                        frontier=list(seen)
                        while frontier:
                            x,y=frontier.pop()
                            for neighbor in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                                if neighbor in surface and neighbor not in seen:
                                    seen.add(neighbor)
                                    frontier.append(neighbor)
                        self.assertTrue(skin<=seen,(gender,index,row,col,'isolated skin pixel'))

    def test_face_width_increased_without_height_change(self):
        for gender,prefix in [('male','m'),('female','f')]:
            for index in (1,2,3):
                old=Image.open(FORMAL/'face-v1'/f'{prefix}_face_0{index}_v1.png').convert('RGBA')
                new=Image.open(FORMAL/'face-v2'/f'{prefix}_face_0{index}_v2.png').convert('RGBA')
                for row in range(4):
                    for col in range(4):
                        x0,y0=col*64,row*64
                        old_width=sum(old.getpixel((x0+x,y0+21))[3]>0 for x in range(64))
                        new_width=sum(new.getpixel((x0+x,y0+21))[3]>0 for x in range(64))
                        self.assertGreaterEqual(new_width,old_width+1,(gender,index,row,col))
                        self.assertEqual(old.crop((x0,y0,x0+64,y0+30)).getchannel('A').getbbox()[1],new.crop((x0,y0,x0+64,y0+30)).getchannel('A').getbbox()[1])

    def test_body_foot_and_outfit_unchanged(self):
        for gender in ('male','female'):
            old=Image.open(FORMAL/'hair-v3'/f'player_{gender}_body_v3.png').convert('RGBA')
            new=Image.open(FORMAL/'face-v2'/f'player_{gender}_body_v5.png').convert('RGBA')
            self.assertEqual(new.size,(256,256))
            for row in range(4):
                for col in range(4):
                    cell=(col*64,row*64,(col+1)*64,(row+1)*64)
                    self.assertEqual(old.crop((cell[0],cell[1]+43,cell[2],cell[3])).tobytes(),new.crop((cell[0],cell[1]+43,cell[2],cell[3])).tobytes())
                    self.assertIsNone(new.crop((cell[0],cell[1],cell[2],cell[1]+34)).getchannel('A').getbbox())
                    for y in range(cell[1]+34,cell[1]+39):
                        for x in range(cell[0],cell[2]):
                            r,g,b,a=new.getpixel((x,y))
                            self.assertFalse(a>160 and r>155 and g>105 and r-g>13 and g-b>8,(gender,row,col,x,y,'old skin residue'))


if __name__=='__main__':unittest.main()
