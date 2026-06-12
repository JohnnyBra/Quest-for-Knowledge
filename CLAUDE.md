# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev (runs Express + Vite middleware together on port 3030)
npm run dev

# Type-check (no build output)
npm run lint

# Production build (frontend only — Vite)
npm run build

# Serve production build
npm start
```

Set `GEMINI_API_KEY` in `.env.local` before running. (The key is injected via `vite.config.ts` as `process.env.GEMINI_API_KEY`, but the Gemini API is not currently called — all questions come from the static bank in `data/questions.ts`.)

There are no automated tests.

## Architecture

**Browser-based educational RPG** ("Quest for Knowledge: Grade 5 Heroes") for Spanish-speaking 5th graders. React 19 + Vite frontend; thin Express server for the leaderboard API.

### Data flow

```
App.tsx (root state machine)
  ├── GameState enum drives which screen renders
  │     START_SCREEN → LoginScreen (name entry, not persisted)
  │     NARRATIVE    → two-panel story text
  │     MAP          → CanvasMapView + sidebar HUD
  │     BATTLE       → Battle component
  │     GAME_OVER / VICTORY → result screens
  └── Player, mapData, activeEnemies all live in App.tsx state
```

**`App.tsx`** is the central state machine and owns all game state. Nothing is stored in a global store — `zustand` is listed as a dependency but is not used. State flows down via props; events flow up via callbacks.

### Key files

| File | Role |
|---|---|
| `types.ts` | All shared enums and interfaces (`GameState`, `TileType`, `Player`, `Enemy`, `Item`, `Question`, etc.) |
| `constants.ts` | Map generators (`generateMap1`–`generateMap5`), `LEVELS` config array, `ENEMY_TEMPLATES`, `BOSS_TEMPLATE`, item templates, tile constants |
| `services/geminiService.ts` | Question picker — filters `STATIC_QUESTIONS` by subject + difficulty, tracks asked questions globally |
| `data/questions.ts` | Static bank of educational questions (Math, Lengua, C. del Medio, Inglés, Ed. Física) with `explorer`/`boss` difficulty tiers |
| `data/narrative.ts` | Story text shown in the NARRATIVE state |
| `server.ts` | Express server: `/api/leaderboard` (GET) and `/api/score` (POST) backed by `db.json` flat-file; also mounts Vite dev middleware |
| `components/CanvasMapView.tsx` | Active canvas renderer for the 32×22 tile map with fog-of-war, sprite caching, and arrow-key + touch controls |
| `components/MapView.tsx` | Legacy CSS/DOM-based renderer — not used by `App.tsx`, kept for reference |
| `components/Battle.tsx` | Turn-based battle UI: subject selection → question fetch → ATB timer → damage calculation |
| `components/Gallery.tsx` | Monster bestiary (shows defeated enemies) |
| `components/RetroUI.tsx` | Shared retro-styled `RetroBox` and `RetroButton` primitives |

### Level system

`LEVELS` in `constants.ts` is an array of `LevelConfig` objects. Each entry has:
- `generateMap()` — procedural map generator returning `TileType[][]` (regenerated fresh each load)
- `start`, `bossPos`, `portalPos` — fixed coordinates (boss and portal are placed after generation; a `freeArea()` pass clears walls around them)
- `theme` — `'CLASSROOM' | 'GARDEN' | 'DUNGEON' | 'SNOW'` (controls canvas tile colors in `CanvasMapView`)
- `enemyCount`, `chestCount`

There are 5 levels. On level 1, enemy weaknesses are restricted to Math/Lengua/C. del Medio only; Inglés and Ed. Física unlock from level 2 onward.

### Stale-closure pattern in enemy AI

Enemy movement runs on a `setInterval` inside a `useEffect`. To read current player position and map state without resetting the interval on every render, `App.tsx` maintains `playerRef` and `mapDataRef` that sync to their state counterparts via `useEffect`. The interval reads from refs; React state is only written via `setActiveEnemies(prev => ...)` updaters.

### Battle system

Battles are triggered in `App.tsx` and handed off to `Battle.tsx`. The flow:
1. Player selects a **subject** (enemies have a `weakness: Subject` for bonus damage)
2. `generateEducationalContent()` picks a question from `STATIC_QUESTIONS` filtered by subject + difficulty (`explorer` for regular enemies, `boss` for boss). A module-level `globalAskedQuestions` Set tracks seen questions across the whole session (never reset between battles).
3. 15 s ATB countdown — timeout counts as wrong
4. Correct answer → player attacks enemy; wrong → enemy attacks player
5. If `player.stats.critChance > 0`, a second harder question is posed before the crit resolves

### Score formula

- Regular enemy defeated: +200 pts; boss: +2000 pts
- Each correct answer: +50 pts; each wrong: −20 pts
- Super-effective answer: +50 pts extra
- Time bonus per answer is accumulated during the battle
- Flawless battle (0 wrong): +100 pts (regular) / +1500 pts (boss)
- Untouched (no HP lost during battle): +50 pts (regular) / +1000 pts (boss)
- On save: `max(0, 3000 − elapsed_seconds × 3)` speed bonus added to final score

### Map mechanics

- **Spikes** (`SPIKE_UP` / `SPIKE_DOWN`): toggle globally on every valid player move. Stepping onto `SPIKE_UP` deals 15 HP damage.
- **Boulders + Buttons**: pushing all boulders onto `BUTTON` tiles converts them to `BUTTON_PRESSED`; when no bare `BUTTON` tiles remain, all `DOOR_CLOSED` tiles open.
- **Chests**: 25% chance of spawning a Mimic (forced battle) instead of an item.
- **Secret walls** (`SECRET_WALL`): revealed on contact, drop a special item.
- **Trap walls** (`TRAP_WALL`): invisible until stepped on, trigger an immediate battle.
- **Teleporters**: stepping on one `TELEPORT_PAD` moves the player to the other.
- **Ice** (`ICE`): player slides in the movement direction until hitting a blocking tile.

### Player progression

- XP from battles → level-up at `level × 100` XP threshold
- Levels 1–3: Gallade sprite, 4–6: Blaziken, 7+: Garchomp (`getPlayerSpriteUrl()` in `constants.ts`)
- On level-up: +20 max HP (restored to full), +5 attack
- Evolution animation fires at levels 4 and 7; after animation a shockwave pushes nearby enemies 3 tiles away

### Enemy HP scaling

- Regular enemies: `40 + (levelIndex + 1) × 20` HP
- Trap/mimic enemies: `80–100 + (levelIndex + 2) × 50–60` HP
- Boss: `300 + (levelIndex + 1) × 50` HP

### Leaderboard / persistence

- Scores saved to `db.json` (flat file) via `/api/score` POST on defeat or victory
- Only personal best is kept per player name
- `/api/leaderboard` returns all scores sorted descending

### Environment

`GEMINI_API_KEY` is read from `.env.local` and injected at build time by `vite.config.ts`. The `@google/genai` SDK is imported in `geminiService.ts` but the API is never called — questions are served entirely from `STATIC_QUESTIONS`.
