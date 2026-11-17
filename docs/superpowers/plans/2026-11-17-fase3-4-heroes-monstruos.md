# Fases 3 y 4 — Héroes, monstruos y objetos — Plan (ejecutado inline)

**Spec:** `docs/superpowers/specs/2026-11-17-rediseno-gremio-design.md`.

## Fase 3 — héroes y animaciones
- [x] 16 evoluciones en Canva (formas 2 y 3 de los 8 héroes), cada una generada con su forma 1 como referencia.
- [x] `getHeroArt` usa las tres formas; nombres de forma en masculino y femenino (`formas[genero]`); tests.
- [x] Selector: fila con las tres formas del héroe elegido.
- [x] Batalla: destello de golpe, ceniza dorada al vencer, aura del jefe (más grande), números de daño.
- [x] Evolución: la forma vieja se vuelve silueta blanca y aparece la nueva bajo una columna de luz.

## Fase 4 — monstruos, jefe y objetos
- [x] 18 monstruos + Director del Caos en `public/arte/monstruos/`; fuera los sprites de Pokémon (y el `MapView.tsx` antiguo, sin uso).
- [x] En el mapa, los monstruos miran hacia el héroe; el jefe flota con aura.
- [x] Bestiario: los no vistos salen como silueta.
- [x] Mochila: cada objeto con su dibujo (`arteObjeto`).
- [x] Arreglo: la llave del nivel 5 no se añadía a la mochila (no había objeto llave) → `LLAVE_MAESTRA`.
- [x] `tests/arte.test.ts`: todo monstruo, objeto y héroe tiene su dibujo; la llave existe y no sale en cofres.
