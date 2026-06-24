import os
from PIL import Image
OUT = os.path.join('assets', 'sprites', 'town')
src1 = Image.open(os.path.join(OUT, 'sheet_3771.png')).convert('RGBA')
src2 = Image.open(os.path.join(OUT, 'sheet_3724.png')).convert('RGBA')
def trim(im):
    bb = im.getbbox(); return im.crop(bb) if bb else im
JOBS = [
    ('int_house',  src1, (392, 22, 602, 182)),    # Player House (1F)
    ('int_house2', src1, (392, 198, 602, 358)),   # Rival House
    ('int_trade',  src2, (6, 384, 198, 528)),      # Trade Center
]
for name, src, box in JOBS:
    crop = trim(src.crop(box))
    crop.save(os.path.join(OUT, name + '.png'))
    print(f'  {name:12s} {crop.size}')
print('listo')
