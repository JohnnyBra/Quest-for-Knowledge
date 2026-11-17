# Fase 2 — Mapa y niebla — Plan (ejecutado inline)

**Goal:** mapa pintado por tema y niebla nueva de tres capas. **Spec:** `docs/superpowers/specs/2026-11-17-rediseno-gremio-design.md`.

Solo 3 temas en uso: CLASSROOM = biblioteca (niveles 1 y 4), SNOW = patio nevado (2), DUNGEON = mazmorra (3 y 5). GARDEN no lo usa ningún nivel → usa la biblioteca.

- [x] `mapaLogica.ts` + `tests/mapa.test.ts`: `esMuro`, `caraFrontal`, `hayAntorcha` (determinista), `RevelarNiebla` + `alphaNiebla` (fundido 600 ms, se reinicia al cambiar de nivel).
- [x] Arte de Canva en `public/arte/mapa/`: suelo y pared por tema; cofre, portal, rastrillo, puerta con candado, llave, roca, placa, pinchos, teletransporte, antorcha.
- [x] `CanvasMapView.tsx` reescrito: un solo bucle rAF que lee props por ref; nítido en retina; suelo como patrón continuo; muros con techo, cara frontal con textura, sombra al suelo y antorchas; objetos animados; héroe y monstruos con movimiento suave, sombra y orden por fila; luz (lo explorado apagado y sin color, farol y antorchas iluminan); niebla de nubes en movimiento con máscara suave; partículas por tema; viñeta; cruceta con medallones. Sin scanlines.
- [x] Verificado: 61 fps en los tres temas; recorrido completo a 1280×800, 820×1180 y 390×844 sin errores ni scroll lateral.
