#!/bin/sh
# Hace continua (sin costuras al repetir) una textura de Canva: mezcla la imagen con su versión desplazada
# media vuelta usando una máscara que es 1 en el centro y 0 en los bordes. Uso: textura-continua.sh entrada salida.webp [tamaño]
set -e
T=${3:-512}
DIR=$(mktemp -d)
magick "$1" -resize ${T}x${T}! "$DIR/a.png"
magick "$DIR/a.png" -roll +$((T/2))+$((T/2)) "$DIR/b.png"
magick -size ${T}x${T} radial-gradient:white-black -level 0,70% "$DIR/m.png"
magick "$DIR/b.png" "$DIR/a.png" "$DIR/m.png" -composite -quality 85 "$2"
rm -r "$DIR"
