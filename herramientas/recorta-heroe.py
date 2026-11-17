# Recorta un personaje exportado de Canva: el PNG «transparente» llega opaco con el damero pintado.
# Se rellena el damero desde los bordes (lo que se alcanza es fondo), se cuadra con los pies abajo y se guarda a 640 px.
# Además, las zonas blancas encerradas grandes (entre arco y cuerda) también son fondo.
# Uso: python3 herramientas/recorta-heroe.py <export.png> <salida.webp> [--solo-bordes]
# --solo-bordes: no quita blancos encerrados (para personajes con blanco propio, como la cara del mimo).
# --solo-grandes: solo quita blancos encerrados muy grandes (huecos de fondo, no rombos ni brillos).
# Después mira el resultado sobre fondo oscuro: Canva a veces exporta OTRA imagen distinta de la pedida.
import sys
from PIL import Image, ImageFilter, ImageChops as C, ImageDraw

entrada, salida = sys.argv[1:3]
solo_bordes = '--solo-bordes' in sys.argv[3:]
g = Image.open(entrada).convert('RGB')
W, H = g.size
r, v, b = g.split()
minimo, maximo = C.darker(r, C.darker(v, b)), C.lighter(r, C.lighter(v, b))
claro = C.multiply(minimo.point(lambda x: 255 if x > 195 else 0), C.subtract(maximo, minimo).point(lambda x: 255 if x < 16 else 0))
for x in range(0, W, 8):
    for y in (0, H - 1):
        if claro.getpixel((x, y)) == 255: ImageDraw.floodfill(claro, (x, y), 128)
for y in range(0, H, 8):
    for x in (0, W - 1):
        if claro.getpixel((x, y)) == 255: ImageDraw.floodfill(claro, (x, y), 128)
minimo_area = W * H if solo_bordes else W * H // 120 if '--solo-grandes' in sys.argv[3:] else W * H // 1500
for y in range(0, H, 4):
    for x in range(0, W, 4):
        if claro.getpixel((x, y)) == 255:
            ImageDraw.floodfill(claro, (x, y), 100)
            area = claro.histogram()[100]
            claro = claro.point(lambda v, a=area: (128 if a > minimo_area else 50) if v == 100 else v)
fondo = claro.point(lambda x: 255 if x == 128 else 0)
g.putalpha(C.invert(fondo).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8)))
g = g.crop(g.getbbox())
lado = max(g.size)
lienzo = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
lienzo.paste(g, ((lado - g.width) // 2, lado - g.height))
lienzo.resize((640, 640), Image.LANCZOS).save(salida, 'WEBP', quality=88)
# Aviso: si la última fila tiene mucho opaco, la figura venía cortada por abajo (pies fuera del encuadre).
alfa = g.split()[3]
ancho_abajo = sum(1 for x in range(g.width) if alfa.getpixel((x, g.height - 1)) > 128)
if ancho_abajo > lado * 0.15:
    print(f'AVISO {salida}: la figura toca el borde inferior en {ancho_abajo}px; ¿pies cortados en la exportación?')
