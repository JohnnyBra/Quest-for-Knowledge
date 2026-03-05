import { TileType, Subject, Item, ItemType } from './types';

export const TILE_SIZE = 48; // pixels
export const MAP_WIDTH = 32; 
export const MAP_HEIGHT = 22;

// Helper to create an empty map with borders
const createEmptyMap = (): TileType[][] => {
  const map: TileType[][] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: TileType[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
       // Borders
       if (y === 0 || y === MAP_HEIGHT - 1 || x === 0 || x === MAP_WIDTH - 1) {
        row.push(TileType.WALL);
      } else {
        row.push(TileType.GRASS);
      }
    }
    map.push(row);
  }
  return map;
};

// --- LEVEL 1: LA BIBLIOTECA (Vertical Snake - 3 tiles wide) ---
const MAP_1 = createEmptyMap();

// Columns of books at x = 4, 8, 12, 16, 20, 24, 28
const cols = [4, 8, 12, 16, 20, 24, 28];
cols.forEach((colX, index) => {
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
        const isGap = index % 2 === 0 
            ? y >= MAP_HEIGHT - 4 // Gap at bottom
            : y <= 3;             // Gap at top
        
        if (!isGap) {
            MAP_1[y][colX] = TileType.WALL;
        }
    }
});

MAP_1[1][1] = TileType.CHEST; 
MAP_1[2][1] = TileType.SECRET_WALL; 
MAP_1[2][2] = TileType.WALL; 


// --- LEVEL 2: EL JARDÍN (Horizontal Snake - 3 tiles high) ---
const MAP_2 = createEmptyMap();

const rows = [4, 8, 12, 16, 20]; 
rows.forEach((rowY, index) => {
    if (rowY >= MAP_HEIGHT -1) return;
    
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
        const isGap = index % 2 === 0
            ? x >= MAP_WIDTH - 4
            : x <= 3;

        if (!isGap) {
             MAP_2[rowY][x] = TileType.WALL;
        }
    }
});

MAP_2[12][15] = TileType.SECRET_WALL;
MAP_2[12][16] = TileType.SECRET_WALL;
MAP_2[11][15] = TileType.CHEST;


// --- LEVEL 3: EL SÓTANO (Tight Snake - 2 tiles high - HARD MODE) ---
const MAP_3 = createEmptyMap();

const tightRows = [3, 6, 9, 12, 15, 18];
tightRows.forEach((rowY, index) => {
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
        const isGap = index % 2 === 0
            ? x >= MAP_WIDTH - 3 // Gap Right
            : x <= 2;            // Gap Left

        if (!isGap) {
             MAP_3[rowY][x] = TileType.WALL;
        }
    }
});

MAP_3[20][15] = TileType.WALL; 
MAP_3[20][14] = TileType.SECRET_WALL;
MAP_3[20][13] = TileType.CHEST;


export type LevelTheme = 'CLASSROOM' | 'GARDEN' | 'DUNGEON';

interface LevelConfig {
    map: TileType[][];
    start: {x: number, y: number};
    title: string;
    theme: LevelTheme;
    bossPos: {x: number, y: number};
    portalPos: {x: number, y: number};
    enemyCount: number;
    chestCount: number;
}

export const LEVELS: LevelConfig[] = [
  { 
    map: MAP_1, 
    start: { x: 1, y: 1 }, 
    title: "NIVEL 1: LA BIBLIOTECA PERDIDA",
    theme: 'CLASSROOM',
    bossPos: { x: 30, y: 20 }, 
    portalPos: { x: 30, y: 21 }, 
    enemyCount: 20, // Increased from 12
    chestCount: 2
  },
  { 
    map: MAP_2, 
    start: { x: 1, y: 2 }, 
    title: "NIVEL 2: EL PATIO DEL OLVIDO",
    theme: 'GARDEN',
    bossPos: { x: 1, y: 18 }, 
    portalPos: { x: 30, y: 19 }, 
    enemyCount: 28, // Increased from 15
    chestCount: 3
  },
  { 
    map: MAP_3, 
    start: { x: 1, y: 1 }, 
    title: "NIVEL 3: EL SÓTANO DEL CAOS",
    theme: 'DUNGEON',
    bossPos: { x: 3, y: 20 }, 
    portalPos: { x: 30, y: 20 }, 
    enemyCount: 40, // Increased from 20 (Very crowded!)
    chestCount: 4
  }
];

export const ENEMY_TEMPLATES = [
  // Original Enemies
  { name: "Goblin Numérico", weakness: Subject.LANGUAGE, spriteId: "goblin" },
  { name: "Ogro de las Letras", weakness: Subject.MATH, spriteId: "ogre" },
  { name: "Limo Tóxico", weakness: Subject.KNOWLEDGE, spriteId: "slime" },
  { name: "Esqueleto Confuso", weakness: Subject.KNOWLEDGE, spriteId: "skeleton" },
  
  // New Enemies
  { name: "Murciélago de la Duda", weakness: Subject.MATH, spriteId: "bat" },
  { name: "Fantasma de la Ignorancia", weakness: Subject.LANGUAGE, spriteId: "ghost" },
  { name: "Serpiente Silbante", weakness: Subject.KNOWLEDGE, spriteId: "snake" },
  { name: "Caballero Oscuro", weakness: Subject.MATH, spriteId: "knight" }
];

export const BOSS_TEMPLATE = {
  name: "Director del Caos",
  weakness: Subject.MATH, 
  spriteId: "boss"
};

export const GAME_ITEMS: Item[] = [
  {
    id: 'potion_small',
    name: 'Manzana Roja',
    type: ItemType.POTION,
    value: 30,
    description: '+30 Vida.',
    icon: 'potion'
  },
  {
    id: 'potion_large',
    name: 'Bocadillo Mágico',
    type: ItemType.POTION,
    value: 60,
    description: '+60 Vida.',
    icon: 'potion'
  },
  {
    id: 'sword_basic',
    name: 'Regla Afilada',
    type: ItemType.WEAPON,
    value: 5,
    description: '+5 Ataque.',
    icon: 'sword'
  },
  {
    id: 'sword_super',
    name: 'Compás de Destino',
    type: ItemType.WEAPON,
    value: 12,
    description: '+12 Ataque.',
    icon: 'sword'
  },
  {
    id: 'armor_basic',
    name: 'Libro de Texto',
    type: ItemType.ARMOR,
    value: 20, 
    description: '+20 Vida Máx.',
    icon: 'shield'
  }
];