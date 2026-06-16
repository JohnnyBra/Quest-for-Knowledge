# Nivel 1: Reinicio de la roca del acertijo - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Si el jugador gana una batalla no-jefe en el Nivel 1 y la roca del acertijo todavía no está sobre el botón, la roca vuelve automáticamente a su posición inicial `(24, 5)`.

**Architecture:** Extraer la posición inicial de la roca a una constante exportada en `constants.ts` y usarla tanto al generar el mapa (`generateMap1`) como en una nueva función de `App.tsx` (`resetMap1BoulderIfNeeded`) que se llama desde la rama no-jefe de `handleBattleVictory`. La función escanea `mapData.tiles` buscando una celda `BOULDER`; si no existe (acertijo resuelto) o ya está en su sitio, no hace nada; si está en otra posición, la mueve de vuelta.

**Tech Stack:** React 19 + TypeScript + Vite (sin framework de tests; verificación vía `npm run lint` para type-check y prueba manual con el servidor de dev).

Spec de referencia: `docs/superpowers/specs/2026-06-15-level1-boulder-reset-design.md`

---

### Task 1: Extraer `MAP1_BOULDER_START` en `constants.ts`

**Files:**
- Modify: `constants.ts:9-11` (constantes exportadas)
- Modify: `constants.ts:54-56` (dentro de `generateMap1`)

- [ ] **Step 1: Añadir la constante exportada `MAP1_BOULDER_START`**

En `constants.ts`, justo después de las constantes `TILE_SIZE`/`MAP_WIDTH`/`MAP_HEIGHT`, el bloque actual es:

```ts
export const TILE_SIZE = 48; // pixels
export const MAP_WIDTH = 32;
export const MAP_HEIGHT = 22;
```

Reemplázalo por:

```ts
export const TILE_SIZE = 48; // pixels
export const MAP_WIDTH = 32;
export const MAP_HEIGHT = 22;

// Posición inicial de la roca empujable del Nivel 1 (ver generateMap1)
export const MAP1_BOULDER_START = { x: 24, y: 5 };
```

- [ ] **Step 2: Usar la constante en `generateMap1`**

Dentro de `generateMap1`, el bloque actual es:

```ts
  // Botón y Roca para el puzle
  map[5][26] = TileType.BUTTON;
  map[5][24] = TileType.BOULDER;
```

Reemplázalo por:

```ts
  // Botón y Roca para el puzle
  map[5][26] = TileType.BUTTON;
  map[MAP1_BOULDER_START.y][MAP1_BOULDER_START.x] = TileType.BOULDER;
```

- [ ] **Step 3: Type-check**

Run: `npm run lint`
Expected: termina sin errores (mismo resultado que antes del cambio — esto es un refactor puro, no debería alterar el comportamiento).

- [ ] **Step 4: Commit**

```bash
git add constants.ts
git commit -m "$(cat <<'EOF'
refactor: extract MAP1_BOULDER_START constant for Level 1 boulder

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Reiniciar la roca al ganar una batalla no-jefe en el Nivel 1

**Files:**
- Modify: `App.tsx:3` (import de constantes)
- Modify: `App.tsx` (nueva función `resetMap1BoulderIfNeeded`, justo antes de `handleBattleVictory`)
- Modify: `App.tsx` (rama `else` de `handleBattleVictory`, enemigo no-jefe)

- [ ] **Step 1: Importar `MAP1_BOULDER_START`**

En `App.tsx`, la línea de import de `./constants` es actualmente:

```ts
import { LEVELS, MAP_HEIGHT, MAP_WIDTH, ENEMY_TEMPLATES, BOSS_TEMPLATE, GAME_ITEMS, GAME_ITEMS_SPECIAL, getPlayerSpriteUrl } from './constants';
```

Reemplázala por:

```ts
import { LEVELS, MAP_HEIGHT, MAP_WIDTH, ENEMY_TEMPLATES, BOSS_TEMPLATE, GAME_ITEMS, GAME_ITEMS_SPECIAL, getPlayerSpriteUrl, MAP1_BOULDER_START } from './constants';
```

- [ ] **Step 2: Añadir `resetMap1BoulderIfNeeded` justo antes de `handleBattleVictory`**

Localiza la definición de `handleBattleVictory`, que empieza así:

```ts
  const handleBattleVictory = (xpGained: number, remainingHp: number, stats: { correct: number, incorrect: number, superEffective: number, timeBonus: number }) => {
```

Inserta la siguiente función justo **antes** de esa línea (deja `handleBattleVictory` tal cual, debajo):

```ts
  const resetMap1BoulderIfNeeded = () => {
    setMapData(prev => {
      let boulderPos: { x: number, y: number } | null = null;
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (prev.tiles[y][x] === TileType.BOULDER) {
            boulderPos = { x, y };
          }
        }
      }

      // No hay roca en el mapa => el acertijo ya está resuelto (BUTTON_PRESSED). No tocar.
      if (!boulderPos) return prev;

      // La roca ya está en su sitio inicial. No tocar.
      if (boulderPos.x === MAP1_BOULDER_START.x && boulderPos.y === MAP1_BOULDER_START.y) return prev;

      const newTiles = prev.tiles.map(row => [...row]);
      newTiles[boulderPos.y][boulderPos.x] = TileType.GRASS;
      newTiles[MAP1_BOULDER_START.y][MAP1_BOULDER_START.x] = TileType.BOULDER;
      return { ...prev, tiles: newTiles };
    });
  };

```

- [ ] **Step 3: Llamar a la función desde la rama no-jefe de `handleBattleVictory`**

Dentro de `handleBattleVictory`, el bloque actual es:

```ts
    if (currentEnemy) {
      isBoss = !!currentEnemy.isBoss;
      baseEnemyName = currentEnemy.name.replace('Guardián Letal: ', '');
      if (currentEnemy.isBoss) {
        const newTiles = mapData.tiles.map(row => [...row]);
        const bossPos = LEVELS[currentLevelIndex].bossPos;
        newTiles[bossPos.y][bossPos.x] = TileType.GRASS;
        setMapData(prev => ({ ...prev, tiles: newTiles }));
        showNotification(`¡JEFE DERROTADO! ¡EL CAMINO ESTÁ LIBRE!`);
      } else {
        setActiveEnemies(prev => prev.filter(e => e.id !== currentEnemy?.id));
      }
    }
```

Reemplaza solo la rama `else` para que quede así:

```ts
    if (currentEnemy) {
      isBoss = !!currentEnemy.isBoss;
      baseEnemyName = currentEnemy.name.replace('Guardián Letal: ', '');
      if (currentEnemy.isBoss) {
        const newTiles = mapData.tiles.map(row => [...row]);
        const bossPos = LEVELS[currentLevelIndex].bossPos;
        newTiles[bossPos.y][bossPos.x] = TileType.GRASS;
        setMapData(prev => ({ ...prev, tiles: newTiles }));
        showNotification(`¡JEFE DERROTADO! ¡EL CAMINO ESTÁ LIBRE!`);
      } else {
        setActiveEnemies(prev => prev.filter(e => e.id !== currentEnemy?.id));
        if (currentLevelIndex === 0) {
          resetMap1BoulderIfNeeded();
        }
      }
    }
```

- [ ] **Step 4: Type-check**

Run: `npm run lint`
Expected: termina sin errores.

- [ ] **Step 5: Commit**

```bash
git add App.tsx
git commit -m "$(cat <<'EOF'
feat: reset Level 1 boulder puzzle on enemy defeat if unsolved

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Verificación manual con el servidor de desarrollo

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Arrancar el servidor de dev**

Run: `npm run dev`
Expected: el servidor arranca en `http://localhost:3030` sin errores en consola.

- [ ] **Step 2: Cargar el Nivel 1 y localizar la roca/botón**

En el navegador, inicia sesión (nombre cualquiera) y entra al Nivel 1 ("LA BIBLIOTECA PERDIDA"). Navega hacia el lado derecho del mapa (columna ~24-26) hasta encontrar la roca (`BOULDER`) y el botón (`BUTTON`), separados por dos casillas en la misma fila.

- [ ] **Step 3: Empujar la roca parcialmente (sin resolver el acertijo) y ganar una batalla**

Empuja la roca **una sola casilla** hacia el botón (de modo que quede entre su posición inicial y el botón, sin llegar a pisarlo). Luego busca un enemigo en el mapa y gánale la batalla (responde bien las preguntas).

Expected: tras volver al mapa, la roca ha desaparecido de la casilla intermedia y ha vuelto a aparecer en su posición inicial (la celda donde estaba al cargar el nivel).

- [ ] **Step 4: Resolver el acertijo y ganar otra batalla**

Empuja la roca las dos casillas hasta dejarla sobre el botón. Debe aparecer la notificación "¡Has resuelto el acertijo! La puerta se ha abierto." Luego gana otra batalla contra cualquier enemigo.

Expected: tras volver al mapa, la roca **sigue sobre el botón** (no se mueve) y la puerta sigue abierta.

- [ ] **Step 5: Confirmar que no hay errores en consola**

Revisa la consola del navegador durante los pasos 3-4.
Expected: sin errores ni warnings nuevos relacionados con `mapData` o `BOULDER`.

No se requiere commit para esta tarea (es solo verificación).
