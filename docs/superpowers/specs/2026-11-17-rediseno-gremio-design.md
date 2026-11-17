# Rediseño gráfico de Quest al estilo «Gremio»

Acordado con Javi en el chat el 2026-11-17. Opción 3: todo el arte nuevo, hecho en Canva.

## Objetivo

Quest pasa de arcade retro (Press Start 2P, cajas blancas, scanlines, sprites de Pokémon) al
sistema visual de la Mina y la Forja: fantasía pintada, filete dorado, Aclonica + Rubik.
Calidad «nivel Mina» desde la primera pantalla. Las mecánicas, preguntas, puntos y niveles no cambian.
Se mantiene «Creado por Javi Barrero» en el login y en el juego.

## Decisiones

- **Arte:** todo en Canva (receta de la Forja: generate-image con referencia de estilo, quitar fondo,
  exportar a tamaño real, recortar). Nada de Pokémon ni marcas protegidas.
- **Héroes:** 4 skins × chico/chica = 8 héroes, cada uno con 3 formas (niveles 1-3, 4-6, 7+) = 24 ilustraciones.
  1. Paladín del Saber: escudero → caballero con escudo-libro → paladín dorado con alas de luz.
  2. Hechicero/a de las Runas: aprendiz con farol → mago/a con báculo de runas → archimago/a con letras de fuego.
  3. Explorador/a del Bosque: montaraz con arco → cazador/a con capa de hojas → señor/a de las bestias con lobo espiritual.
  4. Jinete de Dragón: con cría de dragón → con dragón joven → montado/a en el dragón adulto.
  El alumno elige skin y chico/chica tras el login; se recuerda en `localStorage` por nombre.
- **Monstruos:** 17 + Director del Caos, dibujados según su nombre, traviesos y no terroríficos.
- **Animación:** procedural sobre las ilustraciones recortadas (no fotogramas): respiración en reposo,
  embestida al atacar, sacudida + destello rojo + número flotante al recibir daño, ceniza dorada al morir,
  aura del jefe, evolución con silueta blanca + columna de luz + onda. Respeta `prefers-reduced-motion`.
- **Mapa:** suelo y pared pintados por tema (biblioteca, jardín, mazmorra, nieve) como texturas grandes en
  patrón continuo; relieve de pared por código (sombra, borde de luz). Objetos pintados (cofre, portal,
  puertas, llave, roca, botón, pinchos, teletransporte, hielo, antorchas) con animación.
- **Niebla:** tres capas — luz cálida del farol alrededor del héroe; zona explorada visible pero apagada y
  desaturada; zona sin descubrir con niebla pintada que se mueve, bordes suaves (máscara a baja resolución
  escalada con suavizado) y fundido al revelarse. Sin scanlines.
- **Interfaz:** fondo pintado con velo y chispas, paneles con filete dorado, botón dorado principal y de cuero
  secundario, iconos pintados en medallones, HUD con barras de vida/XP con estilo, cruceta táctil grande.
  Tokens y CSS del gremio de `plataforma-cole-juegos/cliente/gremio.css`, adaptados (Quest es React + Tailwind CDN).

## Fases (cada una jugable, con capturas)

1. **Interfaz Gremio** — login, elegir héroe, portada, historia, HUD, batalla, mochila, bestiario, ranking,
   victoria/derrota. Fondo e iconos de Canva; un primer héroe (Paladín chico y chica) para probar.
2. **Mapa y niebla** — texturas por tema, objetos pintados, niebla nueva.
3. **Héroes** — los 24 dibujos, selector completo, evoluciones y animaciones de batalla.
4. **Monstruos, jefe y objetos** — 18 criaturas y los iconos de la mochila.

## Comprobación

No hay tests automáticos en Quest; `npm run lint` (tsc) debe pasar. Cada fase se recorre en un navegador real
(Brave + playwright-core) a 1280×800, 820×1180 y 390×844: sin errores JS, sin scroll horizontal, sin imágenes
rotas, controles ≥ 44 px; capturas para Javi.
