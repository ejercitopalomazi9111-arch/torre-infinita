# crop_interiors.py — recorta los INTERIORES reales de FRLG (hoja 3724) usados al
# entrar a los edificios del pueblo: Centro Pokémon (1F) y Poké Mart.
import os
from PIL import Image
SRC = os.path.join('assets', 'sprites', 'town', 'sheet_3724.png')
OUT = os.path.join('assets', 'sprites', 'town')
img = Image.open(SRC).convert('RGBA')
print('hoja', img.size)
BOXES = {
    'int_center': (6, 24, 252, 182),    # Pokémon Center (1F)
    'int_mart':   (334, 600, 516, 744),  # Poké Mart
}
for name, box in BOXES.items():
    crop = img.crop(box)
    crop.save(os.path.join(OUT, name + '.png'))
    print(f'  {name:11s} {crop.size}')
print('listo')
