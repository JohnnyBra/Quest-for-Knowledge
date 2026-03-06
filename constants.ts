import { TileType, Subject, Item, ItemType } from './types';

export const getPlayerSpriteUrl = (level: number) => {
  if (level >= 7) return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/445.gif"; // Garchomp
  if (level >= 4) return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/257.gif"; // Blaziken
  return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/475.gif"; // Gallade
};

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
  const cols = [4, 8, 12, 16, 20, 24]; // En lugar de hasta 28, dejamos el final libre para el boss
  
  cols.forEach(colX => {
    // A single random gap of size 4 in each column
    const gapStart = 1 + Math.floor(Math.random() * (MAP_HEIGHT - 6));
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      if (y < gapStart || y > gapStart + 3) {
        map[y][colX] = Math.random() < 0.05 ? TileType.SECRET_WALL : TileType.WALL;
      }
    }
  });

  // Muro protector final para el portal y el jefe, con una puerta cerrada
  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    map[y][28] = TileType.WALL;
  }
  
  // Puerta de entrada a la zona del jefe
  map[15][28] = TileType.DOOR_CLOSED;

  // Botón y Roca para el puzle
  map[5][26] = TileType.BUTTON;
  map[5][24] = TileType.BOULDER;

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

const generateMap4 = (): TileType[][] => {
  const map = createEmptyMap();
  
  // A blocking wall near the right side to hide the portal
  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    map[y][27] = TileType.WALL;
  }
  
  // A single closed door to pass through the wall
  map[10][27] = TileType.DOOR_CLOSED;

  // Add buttons that need to be pressed
  map[5][20] = TileType.BUTTON;
  map[15][20] = TileType.BUTTON;

  // Add boulders to push onto buttons
  map[5][10] = TileType.BOULDER;
  map[15][10] = TileType.BOULDER;

  // Add a few scattered walls for obstacle
  map[4][15] = TileType.WALL;
  map[5][15] = TileType.WALL;
  map[6][15] = TileType.WALL;
  map[14][15] = TileType.WALL;
  map[15][15] = TileType.WALL;
  map[16][15] = TileType.WALL;

  return map;
};

const generateMap5 = (): TileType[][] => {
  const map = createEmptyMap();
  
  // Create a maze-like structure
  for (let x = 5; x < 25; x += 4) {
    for (let y = 3; y < MAP_HEIGHT - 3; y++) {
      map[y][x] = TileType.WALL;
    }
    // Gaps
    map[Math.floor(MAP_HEIGHT / 2)][x] = TileType.GRASS;
    map[Math.floor(MAP_HEIGHT / 2) + 1][x] = TileType.GRASS;
  }

  // Spikes zone
  for (let x = 6; x < 9; x++) {
    for (let y = 5; y < 15; y += 2) {
      map[y][x] = TileType.SPIKE_UP;
      map[y+1][x] = TileType.SPIKE_DOWN;
    }
  }

  // Teleporters
  map[2][2] = TileType.TELEPORT_PAD;
  map[MAP_HEIGHT - 3][26] = TileType.TELEPORT_PAD;

  // Key and Locked Door
  map[MAP_HEIGHT - 3][6] = TileType.KEY_ITEM_TILE;
  
  // Wall protecting Boss
  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    map[y][28] = TileType.WALL;
  }
  map[10][28] = TileType.LOCKED_DOOR;

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
    enemyCount: 10,
    chestCount: 2
  },
  {
    generateMap: generateMap2,
    start: { x: 16, y: 10 },
    title: "NIVEL 2: EL PATIO HELADO (¡Resbala!)",
    theme: 'SNOW',
    bossPos: { x: 1, y: 18 },
    portalPos: { x: 30, y: 19 },
    enemyCount: 14,
    chestCount: 3
  },
  {
    generateMap: generateMap3,
    start: { x: 16, y: 10 },
    title: "NIVEL 3: EL SÓTANO DEL CAOS",
    theme: 'DUNGEON',
    bossPos: { x: 3, y: 20 },
    portalPos: { x: 30, y: 20 },
    enemyCount: 20,
    chestCount: 4
  },
  {
    generateMap: generateMap4,
    start: { x: 5, y: 10 },
    title: "NIVEL 4: EL ENIGMA DE LAS ROCAS",
    theme: 'CLASSROOM',
    bossPos: { x: 29, y: 10 },
    portalPos: { x: 30, y: 10 },
    enemyCount: 15,
    chestCount: 3
  },
  {
    generateMap: generateMap5,
    start: { x: 2, y: 10 },
    title: "NIVEL 5: EL CALABOZO DE LAS TRAMPAS",
    theme: 'DUNGEON',
    bossPos: { x: 29, y: 10 },
    portalPos: { x: 30, y: 10 },
    enemyCount: 20,
    chestCount: 3
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
  { name: "Caballero Oscuro", weakness: Subject.MATH, spriteId: "knight", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/625.gif", description: "Un caballero acorazado con geometría; solo un buen matemático puede abrir una brecha en su armadura." },

  // Even More Enemies
  { name: "Gólem de la Piedra Angular", weakness: Subject.MATH, spriteId: "golem", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/76.gif", description: "Formado por rocas pesadísimas, solo unos buenos cálculos arquitectónicos pueden desmontarlo." },
  { name: "Bruja de la Caligrafía", weakness: Subject.LANGUAGE, spriteId: "witch", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/429.gif", description: "Vuela sobre una regla y maldice a quienes escriben sin acentos." },
  { name: "Mago del Tiempo", weakness: Subject.KNOWLEDGE, spriteId: "wizard", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/65.gif", description: "Intenta confundirte con fechas históricas erróneas y capitales de países perdidos." },
  { name: "Árbol Engañoso", weakness: Subject.KNOWLEDGE, spriteId: "tree", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/185.gif", description: "Finge ser una planta inofensiva, pero está lleno de preguntas sobre la fotosíntesis." },
  { name: "Sabueso Infernal", weakness: Subject.MATH, spriteId: "hound", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/229.gif", description: "Un perro fiero que persigue a los que no se saben la tabla del 7." },
  { name: "Mimo del Silencio", weakness: Subject.LANGUAGE, spriteId: "mime", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/122.gif", description: "Un mimo mudo que reta tus habilidades para identificar sinónimos y antónimos." },

  // Level 2+ Weaknesses (English & PE)
  { name: "Libro de Gramática Vivo", weakness: Subject.ENGLISH, spriteId: "english1", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/201.gif", description: "Mastica verbos irregulares y te escupe condicionales en inglés." },
  { name: "Tetera Espectral", weakness: Subject.ENGLISH, spriteId: "english2", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/854.gif", description: "Una tetera británica furiosa que exige la hora exacta en inglés." },
  { name: "Zapatilla Veloz", weakness: Subject.PHYSICAL_ED, spriteId: "pe1", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/106.gif", description: "Una zapatilla de deporte poseída que no para de hacer sprints." },
  { name: "Balón Prisionero", weakness: Subject.PHYSICAL_ED, spriteId: "pe2", spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/100.gif", description: "Lanza balonazos a quienes no conocen las reglas del juego y el calentamiento." }
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
  },
  {
    id: 'crit_basic',
    name: 'Gafas de Concentración',
    type: ItemType.CRIT_UP,
    value: 15,
    description: '+15% Prob. Crítico.',
    icon: 'zap'
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