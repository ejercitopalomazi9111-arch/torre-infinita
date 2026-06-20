# crop_buildings.py — recorta edificios EXTERIORES reales de la hoja "Buildings"
# de FireRed/LeafGreen (The Sounds/Spriters Resource, ripeada por EternalDarkWing)
# en sprites sueltos con fondo transparente, para los pueblos procedurales.
# Uso: py tools/crop_buildings.py [--probe]
import sys, os
from PIL import Image, ImageDraw

SRC = os.path.join('assets', 'sprites', 'town', 'sheet_3849.png')
OUT = os.path.join('assets', 'sprites', 'town')
img = Image.open(SRC).convert('RGBA')
W, H = img.size
print('hoja', W, 'x', H)

# El fondo de la hoja es BLANCO opaco. Lo volvemos transparente con relleno desde
# los bordes (solo el blanco conectado al borde; conserva blancos interiores como
# letreros/ventanas). Marcamos con un color centinela y luego lo pasamos a alpha 0.
MARK = (1, 254, 2)
rgb = img.convert('RGB')
for seed in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]:
    ImageDraw.floodfill(rgb, seed, MARK, thresh=24)
px_rgb = rgb.load(); px = img.load()
for y in range(H):
    for x in range(W):
        if px_rgb[x, y] == MARK:
            r, g, bb, _ = px[x, y]
            px[x, y] = (r, g, bb, 0)

# cajas aproximadas (x0,y0,x1,y1) de cada edificio; se auto-recorta el alpha dentro
BOXES = {
    'house_a': (6, 16, 118, 94),     # casa con tejado verde a dos aguas
    'house_b': (240, 16, 311, 94),   # casa 2 plantas tejado rojo/azul
    'house_c': (574, 16, 650, 94),   # casa tejado morado
    'house_d': (664, 16, 752, 94),   # casa gris de 2 plantas
    'mart':    (406, 244, 498, 322),
    'center':  (500, 240, 596, 322),
    'gym':     (420, 132, 542, 210),
}

def autotrim(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im

for name, box in BOXES.items():
    crop = autotrim(img.crop(box))
    crop.save(os.path.join(OUT, name + '.png'))
    print(f'  {name:9s} {crop.size[0]:>3}x{crop.size[1]:<3}')
print('listo')
