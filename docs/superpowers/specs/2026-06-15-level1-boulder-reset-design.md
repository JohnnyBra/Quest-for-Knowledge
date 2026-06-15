# Nivel 1: la roca vuelve a su sitio si pierdes el progreso

## Contexto

En `generateMap1` (`constants.ts`), hay una roca empujable (`TileType.BOULDER`) colocada en `(24, 5)` y un botón (`TileType.BUTTON`) en `(26, 5)`. Empujar la roca dos casillas a la derecha la coloca sobre el botón (`BUTTON_PRESSED`), lo cual abre la puerta cerrada (`DOOR_CLOSED` → `DOOR_OPEN`) en `(28, 15)` que da acceso a la zona del jefe y el portal.

Actualmente, una vez que el jugador empuja la roca a cualquier posición, se queda ahí para siempre — no hay penalización ni mecanismo de "reinicio".

## Comportamiento nuevo

Cada vez que el jugador gana **cualquier batalla no-jefe** estando en el Nivel 1 (`currentLevelIndex === 0`):

- Si la roca **ya está sobre el botón** (acertijo resuelto, la celda es `BUTTON_PRESSED` y no queda ningún `BOULDER` en el mapa) → no se hace nada. El progreso queda fijo permanentemente.
- Si la roca **no está sobre el botón** (sigue siendo `BOULDER`, en su posición inicial o en cualquier otra donde el jugador la haya empujado) → la roca vuelve automáticamente a su posición inicial `(24, 5)`.

El cambio es **silencioso**: no se muestra ninguna notificación en pantalla. El jugador lo descubre al ver el mapa.

Esto aplica a **cualquier** victoria no-jefe: enemigos que patrullan el mapa, Mimics de cofres, y enemigos de trampas invisibles (Trap Walls) — los tres pasan por la misma rama `!isBoss` en `handleBattleVictory`.

## Implementación

### 1. `constants.ts`

- Exportar una nueva constante `MAP1_BOULDER_START = { x: 24, y: 5 }`.
- En `generateMap1`, reemplazar el literal `map[5][24] = TileType.BOULDER;` por `map[MAP1_BOULDER_START.y][MAP1_BOULDER_START.x] = TileType.BOULDER;` para que la posición inicial tenga una única fuente de verdad.

### 2. `App.tsx`

Nueva función `resetMap1BoulderIfNeeded()`:

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

En `handleBattleVictory`, dentro de la rama existente `else` (enemigo no-jefe derrotado, junto a `setActiveEnemies(prev => prev.filter(...))`), añadir:

```ts
if (currentLevelIndex === 0) {
  resetMap1BoulderIfNeeded();
}
```

## Casos cubiertos

- **Acertijo no resuelto + roca movida** → al ganar cualquier batalla, la roca vuelve a `(24,5)`.
- **Acertijo no resuelto + roca aún en su sitio** → no-op (devuelve `prev`, sin re-render).
- **Acertijo resuelto (roca sobre el botón, puerta abierta)** → no-op permanente; seguir derrotando enemigos no afecta la roca ni la puerta.
- **Mimics y enemigos de trampa** → también disparan el reinicio, porque comparten la rama `!isBoss`.

## Fuera de alcance

- Otros niveles con rocas/botones (Nivel 4) no se ven afectados — el reinicio está condicionado a `currentLevelIndex === 0`.
- No hay notificación visual para este evento.
- No se contempla el caso (muy improbable dado el layout del Nivel 1) de que el jugador esté físicamente parado sobre `(24,5)` cuando ocurre el reinicio.
