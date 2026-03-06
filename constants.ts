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

// --- PROCEDURAL GENERATORS ---
const generateMap1 = (): TileType[][] => {
  const map = createEmptyMap();
  const cols = [4, 8, 12, 16, 20, 24, 28];
  
  cols.forEach(colX => {
    // A single random gap of size 4 in each column
    const gapStart = 1 + Math.floor(Math.random() * (MAP_HEIGHT - 6));
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      if (y < gapStart || y > gapStart + 3) {
        map[y][colX] = Math.random() < 0.05 ? TileType.SECRET_WALL : TileType.WALL;
      }
    }
  });
  return map;
};

const generateMap2 = (): TileType[][] => {
  const map = createEmptyMap();
  // Transmute to ICE
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (map[y][x] === TileType.GRASS) {
        map[y][x] = TileType.ICE;
      }
    }
  }

  const rows = [4, 8, 12, 16, 20];
  rows.forEach(rowY => {
    if (rowY >= MAP_HEIGHT - 1) return;
    // A single random gap of size 4 in each row
    const gapStart = 1 + Math.floor(Math.random() * (MAP_WIDTH - 6));
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      if (x < gapStart || x > gapStart + 3) {
        map[rowY][x] = Math.random() < 0.05 ? TileType.TRAP_WALL : TileType.WALL;
      }
    }
  });
  return map;
};

const generateMap3 = (): TileType[][] => {
  const map = createEmptyMap();
  const tightRows = [3, 6, 9, 12, 15, 18];
  
  tightRows.forEach(rowY => {
    // Two random gaps of size 3 in each row for a maze-like experience
    const gap1 = 1 + Math.floor(Math.random() * (MAP_WIDTH / 2 - 4));
    const gap2 = Math.floor(MAP_WIDTH / 2) + Math.floor(Math.random() * (MAP_WIDTH / 2 - 4));
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      const isGap = (x >= gap1 && x <= gap1 + 2) || (x >= gap2 && x <= gap2 + 2);
      if (!isGap) {
        map[rowY][x] = Math.random() < 0.1 ? TileType.SECRET_WALL : TileType.WALL;
      }
    }
  });
  return map;
};

export type LevelTheme = 'CLASSROOM' | 'GARDEN' | 'DUNGEON' | 'SNOW';

interface LevelConfig {
  generateMap: () => TileType[][];
  start: { x: number, y: number };
  title: string;
  theme: LevelTheme;
  bossPos: { x: number, y: number };
  portalPos: { x: number, y: number };
  enemyCount: number;
  chestCount: number;
}

export const LEVELS: LevelConfig[] = [
  {
    generateMap: generateMap1,
    start: { x: 15, y: 11 },
    title: "NIVEL 1: LA BIBLIOTECA PERDIDA",
    theme: 'CLASSROOM',
    bossPos: { x: 30, y: 20 },
    portalPos: { x: 30, y: 21 },
    enemyCount: 20,
    chestCount: 2
  },
  {
    generateMap: generateMap2,
    start: { x: 16, y: 10 },
    title: "NIVEL 2: EL PATIO HELADO (¡Resbala!)",
    theme: 'SNOW',
    bossPos: { x: 1, y: 18 },
    portalPos: { x: 30, y: 19 },
    enemyCount: 28,
    chestCount: 3
  },
  {
    generateMap: generateMap3,
    start: { x: 16, y: 10 },
    title: "NIVEL 3: EL SÓTANO DEL CAOS",
    theme: 'DUNGEON',
    bossPos: { x: 3, y: 20 },
    portalPos: { x: 30, y: 20 },
    enemyCount: 40,
    chestCount: 4
  }
];

export const ENEMY_TEMPLATES = [
  // Original Enemies
  { name: "Goblin Numérico", weakness: Subject.LANGUAGE, spriteId: "goblin", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/302.gif", description: "Un pequeño pero molesto goblin que te ataca con fracciones y sumas." },
  { name: "Ogro de las Letras", weakness: Subject.MATH, spriteId: "ogre", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/68.gif", description: "Un enorme ogro que lanza verbos irregulares y faltas de ortografía." },
  { name: "Limo Tóxico", weakness: Subject.KNOWLEDGE, spriteId: "slime", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/88.gif", description: "Un residuo radiactivo que no sabe reciclar ni conoce el ciclo del agua." },
  { name: "Esqueleto Confuso", weakness: Subject.KNOWLEDGE, spriteId: "skeleton", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/105.gif", description: "Un esqueleto antiguo que ha olvidado de dónde vienen sus huesos." },

  // New Enemies
  { name: "Murciélago de la Duda", weakness: Subject.MATH, spriteId: "bat", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/41.gif", description: "En la oscuridad de la cueva, este murciélago se alimenta de tus dudas en las multiplicaciones." },
  { name: "Fantasma de la Ignorancia", weakness: Subject.LANGUAGE, spriteId: "ghost", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/92.gif", description: "Un ente aterrador que susurra palabras mal escritas para confundirte." },
  { name: "Serpiente Silbante", weakness: Subject.KNOWLEDGE, spriteId: "snake", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/23.gif", description: "Es rápida y venenosa, pero una buena comprensión del ecosistema puede detenerla." },
  { name: "Caballero Oscuro", weakness: Subject.MATH, spriteId: "knight", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/625.gif", description: "Un caballero acorazado con geometría; solo un buen matemático puede abrir una brecha en su armadura." }
];

export const BOSS_TEMPLATE = {
  name: "Director del Caos",
  weakness: Subject.MATH,
  spriteId: "boss",
  spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/491.gif",
  description: "El enemigo definitivo de la escuela, se dice que su poder proviene del fracaso escolar."
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
  },
  {
    id: 'bomb_basic',
    name: 'Bomba de Humo',
    type: ItemType.BOMB,
    value: 1,
    description: 'Destruye muros cercanos o revela secretos.',
    icon: 'bomb'
  }
];

export const GAME_ITEMS_SPECIAL: Item[] = [
  {
    id: 'potion_max',
    name: 'Elixir de Sabiduría',
    type: ItemType.POTION,
    value: 200,
    description: '+200 Vida Max. Curación total.',
    icon: 'potion'
  },
  {
    id: 'sword_epic',
    name: 'Excalibur del Saber',
    type: ItemType.WEAPON,
    value: 50,
    description: '+50 Ataque.',
    icon: 'sword'
  },
  {
    id: 'armor_epic',
    name: 'Manto de Erudito',
    type: ItemType.ARMOR,
    value: 80,
    description: '+80 Vida Máx.',
    icon: 'shield'
  }
];