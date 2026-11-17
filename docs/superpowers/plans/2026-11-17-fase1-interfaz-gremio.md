# Fase 1 — Interfaz Gremio — Plan de implementación

> **Para agentes:** ejecución inline (elegida por Javi). Pasos con casillas `- [ ]`.

**Goal:** todas las pantallas fuera del mapa pasan al estilo Gremio, con selector de héroe (4 skins × chico/chica) y arte de Canva.

**Architecture:** una hoja `public/quest.css` con los tokens del gremio (paleta propia «academia arcana»: violeta noche + oro) y clases de componentes; los componentes React cambian sus clases Tailwind de colores por esas clases. Los héroes salen de un módulo `heroes.ts` (datos + `getHeroArt`) que sustituye a `getPlayerSpriteUrl`.

**Tech Stack:** React 19, Vite 6, Tailwind CDN (se mantiene para layout), Aclonica + Rubik (Google Fonts), `tsx --test` para las pruebas.

**Spec:** `docs/superpowers/specs/2026-11-17-rediseno-gremio-design.md`

## Global Constraints

- Mecánicas, preguntas, puntos y niveles sin cambios.
- «Creado por Javi Barrero» visible en login y en el juego.
- Nada de arte de Pokémon nuevo; el arte nuevo sale de Canva a `public/arte/`.
- Controles ≥ 44 px; sin scroll horizontal a 390 px; `prefers-reduced-motion` respetado.
- `npm run lint` pasa.

## Review Focus

- Nombre con skin guardada de otra partida: al volver a entrar, el selector muestra la elegida.
- `localStorage` bloqueado (modo privado): el juego sigue funcionando (try/catch).
- Niveles 4 y 7: la imagen de evolución cambia sin romperse si la forma 2/3 aún no existe (fase 3) → cae a la forma 1.
- Mochila y bestiario con muchos objetos a 390 px: se desplazan dentro del modal, no la página.
- Batalla a 390 px: las 5 materias caben (rejilla que salta de línea).

---

### Task 1: Módulo de héroes

**Files:** Create `heroes.ts`, `tests/heroes.test.ts`; Modify `types.ts` (Player.hero), `package.json` (script test).

**Interfaces:** Produces `SKINS: Skin[]`, `type Genero = 'chico'|'chica'`, `type HeroChoice = { skin: SkinId; genero: Genero }`, `getHeroArt(hero: HeroChoice, level: number): string`, `formaDe(level): 1|2|3`, `cargarHeroe(nombre): HeroChoice|null`, `guardarHeroe(nombre, hero)`.

- [ ] Test: `formaDe(1..3)=1, (4..6)=2, (7+)=3`; `getHeroArt({skin:'paladin',genero:'chica'}, 5)` → `/arte/heroes/paladin-chica-2.webp` si existe la forma 2, si no `-1`; `cargarHeroe` devuelve null con storage que lanza.
- [ ] Ver que falla, implementar, ver que pasa, commit.

### Task 2: Hoja de estilos y fondo

**Files:** Create `public/quest.css`, `public/arte/fondo.webp`, `public/arte/iconos/*` (copiados de la plataforma), `public/arte/emblema-cole.png`; Modify `index.html` (fuentes, quitar Press Start/scanlines, enlazar quest.css).

- [ ] Tokens, fondo con velo y chispas, panel con filete, botón dorado, botón cuero, medallón, barras de vida/XP, modal, estandarte del cole.

### Task 3: Login y selector de héroe

**Files:** Modify `components/LoginScreen.tsx`; Create `components/HeroSelect.tsx`; Modify `App.tsx` (estado `hero`, pantalla tras login).

### Task 4: Portada, historia, finales, HUD

**Files:** Modify `App.tsx` (START_SCREEN, NARRATIVE, GAME_OVER, VICTORY, cabecera fija con HUD, toast, evolución, mochila), `components/RetroUI.tsx` (RetroBox/RetroButton → panel/botón gremio).

### Task 5: Batalla, bestiario, ranking

**Files:** Modify `components/Battle.tsx`, `components/Gallery.tsx`, `components/Leaderboard.tsx`; héroe con `getHeroArt`; animaciones de reposo/ataque/daño nuevas en `quest.css`.

### Task 6: Recorrido en navegador y capturas

- [ ] Script playwright: login → selector → portada → historia → mapa → batalla (forzada) → mochila → bestiario → ranking, a 1280×800, 820×1180, 390×844; sin errores JS, sin scroll horizontal, sin imágenes rotas. Capturas para Javi.
