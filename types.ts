
export enum GameState {
  START_SCREEN,
  NARRATIVE,
  MAP,
  BATTLE,
  PUZZLE,
  GAME_OVER,
  VICTORY
}

export enum TileType {
  GRASS = 0,
  WALL = 1,
  PATH = 2,
  CHEST = 3,
  ENEMY = 4, // Legacy, mostly unused now as enemies are entities
  PORTAL = 5,
  NPC = 6,
  HIDDEN_ENEMY = 7,
  BOSS = 8,
  LOCKED_DOOR = 9,
  SECRET_WALL = 10, // New breakable wall
  TRAP_WALL = 11, // Invisible trap inside a wall
  ICE = 12, // Slide until wall
  BOULDER = 13, // Pushable block
  BUTTON = 14, // Pressure plate
  BUTTON_PRESSED = 15, // Pressure plate with boulder on it
  DOOR_CLOSED = 16, // Blocking door
  DOOR_OPEN = 17, // Passed door
  SPIKE_UP = 18, // Dangerous spike
  SPIKE_DOWN = 19, // Safe spike, alternates when moving
  TELEPORT_PAD = 20, // Teleport to another pad
  KEY_ITEM_TILE = 21 // A key sitting on the floor
}

export enum ItemType {
  WEAPON,
  ARMOR,
  POTION,
  KEY,
  BOMB,
  CRIT_UP
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  value: number; // Attack bonus, HP heal, or 0 for key
  description: string;
  icon: string;
}

export interface Entity {
  x: number;
  y: number;
}

export interface Player extends Entity {
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  inventory: Item[];
  name: string;
  stats: {
    attack: number;
    defense: number;
    critChance: number;
  };
  score: number;
  correctAnswers: number;
  incorrectAnswers: number;
  superEffectiveAnswers: number;
  startTime: number;
  isSliding?: boolean;
  defeatedEnemies: string[];
}

export interface Enemy {
  id: string;
  name: string;
  maxHp: number;
  hp: number;
  difficulty: number;
  sprite: string;
  weakness: Subject;
  isBoss?: boolean;
}

// New interface for enemies on the map
export interface ActiveEnemy extends Entity {
  id: string;
  templateIndex: number; // Index in ENEMY_TEMPLATES
  hp: number;
  maxHp: number;
}

export interface GameMap {
  tiles: TileType[][];
  width: number;
  height: number;
  visited: boolean[][]; // For Fog of War
}

export interface Question {
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  subject: string;
  difficulty: 'explorer' | 'boss';
}

export enum Subject {
  MATH = "Matemáticas",
  LANGUAGE = "Lengua",
  KNOWLEDGE = "C. del Medio",
  ENGLISH = "Inglés",
  PHYSICAL_ED = "Ed. Física"
}
