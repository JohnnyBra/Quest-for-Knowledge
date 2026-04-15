# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev (runs Express + Vite middleware together on port 3000)
npm run dev

# Type-check (no build output)
npm run lint

# Production build
npm run build

# Serve production build
npm start
```

Set `GEMINI_API_KEY` in `.env.local` before running.

## Architecture

This is a **browser-based educational RPG** ("Quest for Knowledge: Grade 5 Heroes") for Spanish-speaking 5th graders. It uses React 19 + Vite on the frontend and a thin Express server for the leaderboard API.

### Data flow

```
App.tsx (root state machine)
  ├── GameState enum drives which screen renders
  │     START_SCREEN → LoginScreen
  │     NARRATIVE    → narrative text panels
  │     MAP          → CanvasMapView + sidebar HUD
  │     BATTLE       → Battle component
  │     PUZZLE       → inline puzzle UI in App.tsx
  │     GAME_OVER / VICTORY → result screens
  └── Player, mapData, activeEnemies all live in App.tsx state
```

**`App.tsx`** is the central state machine. It owns all game state (player, map, enemies, level index) and passes down callbacks. It handles:
- Level initialization and transitions (portal → next level)
- Player movement, tile interaction, fog-of-war updates
- Enemy movement AI (aggro/chase logic via `setInterval`)
- Item pickup, door/locked door logic, teleporters, spikes, boulders/buttons
- Triggering battles and puzzles when the player collides with an enemy or puzzle tile

### Key files

| File | Role |
|---|---|
| `types.ts` | All shared enums and interfaces (`GameState`, `TileType`, `Player`, `Enemy`, `Item`, `Question`, etc.) |
| `constants.ts` | Map generators (`generateMap1`–`generateMap5`), `LEVELS` config array, enemy/item templates, tile size constants |
| `services/geminiService.ts` | Question picker — filters `STATIC_QUESTIONS` by subject + difficulty, tracks asked questions globally |
| `data/questions.ts` | Static bank of educational questions (Math, Lengua, C. del Medio, Inglés, Ed. Física) with `explorer`/`boss` difficulty tiers |
| `data/narrative.ts` | Story text shown in the NARRATIVE state |
| `server.ts` | Express server: `/api/leaderboard` (GET) and `/api/score` (POST) backed by `db.json` flat-file store; also mounts Vite dev middleware |
| `components/CanvasMapView.tsx` | Canvas renderer for the 32×22 tile map with fog-of-war, sprite caching, and arrow-key + touch controls |
| `components/Battle.tsx` | Turn-based battle UI: subject selection → question fetch → ATB timer → damage calculation |
| `components/Gallery.tsx` | Monster bestiary (shows defeated enemies) |
| `components/Leaderboard.tsx` | Fetches and displays `/api/leaderboard` |
| `components/LoginScreen.tsx` | Player name entry |
| `components/RetroUI.tsx` | Shared retro-styled `RetroBox` and `RetroButton` primitives |

### Level system

`LEVELS` in `constants.ts` is an array of `LevelConfig` objects. Each entry has:
- `generateMap()` — procedural map generator returning `TileType[][]`
- `start`, `bossPos`, `portalPos` — fixed coordinates
- `theme` — one of `'CLASSROOM' | 'GARDEN' | 'DUNGEON' | 'SNOW'` (controls canvas tile colors)
- `enemyCount`, `chestCount`

There are 5 levels. Maps are regenerated fresh each time a level loads.

### Battle system

Battles are triggered in `App.tsx` and handed off to `Battle.tsx`. The flow is:
1. Player selects a **subject** (enemies have a `weakness: Subject` for bonus damage)
2. `generateEducationalContent()` picks a static question filtered by subject + difficulty
3. ATB countdown (15 s) — timeout counts as wrong
4. Correct answer → player attacks enemy; wrong → enemy attacks player
5. Critical hit path: if player has `critChance > 0`, a second harder question is posed before the crit resolves

### Player progression

- XP from battles → level-up thresholds in `App.tsx`
- Levels 1–3: Gallade sprite, levels 4–6: Blaziken, level 7+: Garchomp
- Stats: `attack`, `defense`, `critChance` increase on level-up

### Leaderboard / persistence

- Scores saved server-side in `db.json` (flat file, not a real DB)
- Only the personal best is kept per player name
- Score includes time bonus, level reached, and battle stats

### Environment

`GEMINI_API_KEY` is injected at build time via `vite.config.ts` → `process.env.GEMINI_API_KEY`. Despite the import from `geminiService.ts`, questions are served entirely from the static bank — the Gemini API is not currently called.
