# fetch-tiles.py — TILES de BIOMA REALES (GBA) desde pret/pokeemerald.
# Los tiles.png del decomp son indexados con paleta GRIS; el color real vive en
# los .pal (JASC). Aquí: descargo tiles.png + .pal oficiales, RECOLOREO con la
# paleta correcta y RECORTO metatiles de 16x16 (col,row) para cada bioma.
# Salida: assets/sprites/tiles/<bioma>/{floor0..4,wall0..4,decor_rock/crack/flora/crystal}.png
# NO dibujo nada: solo selecciono/recoloreo/recorto arte oficial (regla de assets).
import os, sys, urllib.request, ssl
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(ROOT, 'assets', 'sprites', 'tiles')
RAW  = 'https://raw.githubusercontent.com/pret/pokeemerald/master/data/tilesets'
CTX  = ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
CACHE = os.path.join(ROOT, '_tmp')
os.makedirs(CACHE, exist_ok=True)

def fetch(url, dst):
    if os.path.exists(dst) and os.path.getsize(dst) > 0: return dst
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=CTX, timeout=30) as r:
        open(dst, 'wb').write(r.read())
    return dst

def tileset(ts):
    """Descarga tiles.png de un tileset y devuelve la imagen indexada (mode P)."""
    p = fetch(f'{RAW}/{ts}/tiles.png', os.path.join(CACHE, ts.replace('/', '_') + '.png'))
    im = Image.open(p); im.load(); return im

def palette(ts, idx):
    """Descarga y parsea un .pal (JASC) -> lista de 16 (r,g,b)."""
    p = fetch(f'{RAW}/{ts}/palettes/{idx:02d}.pal', os.path.join(CACHE, ts.replace('/', '_') + f'_{idx:02d}.pal'))
    cols = []
    for ln in open(p).read().splitlines()[3:]:
        s = ln.split()
        if len(s) >= 3: cols.append((int(s[0]), int(s[1]), int(s[2])))
    return cols

def crop(im, pal, col, row, transparent0=False):
    """Recorta el metatile 16x16 en (col,row) y lo recolorea con pal."""
    box = im.crop((col*16, row*16, col*16+16, row*16+16))
    box.load()
    out = Image.new('RGBA', (16, 16))
    sp = box.load(); op = out.load()
    for y in range(16):
        for x in range(16):
            i = sp[x, y]
            if transparent0 and i == 0:
                op[x, y] = (0, 0, 0, 0)
            else:
                r, g, b = pal[i] if i < len(pal) else (255, 0, 255)
                op[x, y] = (r, g, b, 255)
    return out

# Coordenadas (col,row) en bloques de 16px, leídas de las hojas reales.
# Coords leídas de la hoja real (col,row en metatiles de 16px). floor/wall = tiles
# SÓLIDOS (0 px del índice0 transparente); decor = tiles con fondo transparente.
CAVE = {
    'floor': [(0,3),(1,3),(2,3),(3,3),(6,3)],   # suelo de roca uniforme (evita (4,3)/(5,3)=hoyos)
    'wall':  [(0,6),(2,6),(3,6),(5,6),(0,7)],   # pared de roca texturizada (evita (4,6)=plano)
    'decor': {'rock':(6,7),'crack':(7,7),'crystal':(6,8),'flora':(7,8)},
}
GRASS = {
    'floor': [(3,8),(4,8),(5,8),(3,8),(5,8)],   # pasto limpio (evita (3,9)/(4,9)=escalón/valla)
    'wall':  [(1,0),(4,0),(1,0),(4,0),(1,0)],   # copa de árbol (evita (0,5-7)=tiles oscuros tipo hoyo)
    'decor': {'flora':(6,3),'rock':(6,4),'crack':(7,3),'crystal':(7,4)},
}

# Bioma -> (tileset, paleta, layout, tinte-info-solo-doc). El tinte se aplica en
# el MOTOR (biomes.js BIOME_PROPS.tint), aquí solo recortamos el arte base.
BIOMES = {
    'cuevas':      ('secondary/cave', 6,  CAVE),
    'volcan':      ('secondary/cave', 8,  CAVE),
    'ruinas':      ('secondary/cave', 10, CAVE),
    'glaciar':     ('secondary/cave', 11, CAVE),
    'distorsion':  ('secondary/cave', 7,  CAVE),
    'laboratorio': ('secondary/cave', 7,  CAVE),
    'bosque':      ('primary/general', 2, GRASS),
    'cielo':       ('primary/general', 2, GRASS),
}

def main():
    done = []
    for bid, (ts, palidx, lay) in BIOMES.items():
        try:
            im = tileset(ts); pal = palette(ts, palidx)
            d = os.path.join(OUT, bid); os.makedirs(d, exist_ok=True)
            for i, (c, r) in enumerate(lay['floor']):
                crop(im, pal, c, r).save(os.path.join(d, f'floor{i}.png'))
            for i, (c, r) in enumerate(lay['wall']):
                crop(im, pal, c, r).save(os.path.join(d, f'wall{i}.png'))
            for kind, (c, r) in lay['decor'].items():
                crop(im, pal, c, r, transparent0=True).save(os.path.join(d, f'decor_{kind}.png'))
            done.append(bid)
            print(f'  OK {bid:12s} <- {ts} pal{palidx:02d}')
        except Exception as e:
            print(f'  XX {bid:12s} ({e})')
    # HIERBA ALTA compartida (zonas de encuentro) — tile de pasto denso del set
    # general, opaco. Se tiñe por bioma en el motor.
    try:
        im = tileset('primary/general'); pal = palette('primary/general', 2)
        sd = os.path.join(OUT, '_shared'); os.makedirs(sd, exist_ok=True)
        crop(im, pal, 6, 1, transparent0=True).save(os.path.join(sd, 'tallgrass.png'))   # MATA verde, fondo transparente
        print('  OK tallgrass <- general pal02 (6,1) transparente')
    except Exception as e:
        print('  XX tallgrass', e)

    # manifiesto para BootScene
    man = os.path.join(ROOT, 'data', 'tilemeta.generated.js')
    # IMPORTANTE: Carlos prefiere los tiles PROCEDURALES (los ripeados no teselan).
    # Por eso NO activamos los biomas reales (lista vacía). Solo usamos este script
    # para el sprite compartido de hierba alta. Cambiar a `done` si algún día se
    # implementa autotiling real.
    open(man, 'w').write(
        '// Tiles de bioma PROCEDURALES (texgen). fetch-tiles.py solo genera la hierba\n'
        '// compartida; los tilesets ripeados de Pokémon son autotiles y no teselan.\n'
        'export const REAL_TILE_BIOMES = [];\n')
    print(f'\n(tiles reales generados pero NO activados: {len(done)} biomas; se usan procedurales) -> {man}')

if __name__ == '__main__':
    main()
