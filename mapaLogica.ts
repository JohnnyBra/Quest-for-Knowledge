// Lógica pura del dibujo del mapa: qué casillas parecen muro, dónde va la cara frontal y las antorchas,
// y cuánto tapa la niebla cada casilla (con fundido al descubrirla).
import { TileType } from './types';
import type { LevelTheme } from './constants';

export type Particula = 'polvo' | 'nieve' | 'ascua' | 'luciernaga';
export interface Tema { suelo: string; pared: string; techo: string; luz: string; brillo: number; niebla: string; nube: string; particula: Particula }

// Un tema por nivel: biblioteca (1), patio nevado (2), sótano (3), ruinas de piedra (4), calabozo (5).
export const TEMAS: Record<LevelTheme, Tema> = {
  CLASSROOM: { suelo: 'biblioteca-suelo', pared: 'biblioteca-pared', techo: '#2b1a12', luz: '255,186,104', brillo: 0.16, niebla: '14,10,26', nube: '150,130,210', particula: 'polvo' },
  SNOW: { suelo: 'nieve-suelo', pared: 'nieve-pared', techo: '#26324a', luz: '214,232,255', brillo: 0.05, niebla: '26,32,50', nube: '170,190,225', particula: 'nieve' },
  CELLAR: { suelo: 'sotano-suelo', pared: 'sotano-pared', techo: '#24140e', luz: '255,160,80', brillo: 0.18, niebla: '16,10,8', nube: '150,110,90', particula: 'ascua' },
  GARDEN: { suelo: 'ruinas-suelo', pared: 'ruinas-pared', techo: '#1b2418', luz: '220,240,170', brillo: 0.1, niebla: '10,18,16', nube: '130,170,150', particula: 'luciernaga' },
  DUNGEON: { suelo: 'mazmorra-suelo', pared: 'mazmorra-pared', techo: '#11101f', luz: '255,146,72', brillo: 0.2, niebla: '9,8,18', nube: '120,100,190', particula: 'ascua' },
};

export const FUNDIDO_MS = 600;

export const esMuro = (t: TileType) => t === TileType.WALL || t === TileType.SECRET_WALL || t === TileType.TRAP_WALL;

export const caraFrontal = (tiles: TileType[][], x: number, y: number) =>
  esMuro(tiles[y][x]) && y + 1 < tiles.length && !esMuro(tiles[y + 1][x]);

const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

export const variante = (x: number, y: number, n: number) => hash(x, y) % n;

export const hayAntorcha = (tiles: TileType[][], x: number, y: number) =>
  tiles[y][x] === TileType.WALL && caraFrontal(tiles, x, y) && hash(x, y) % 6 === 0;

/** Recuerda cuándo se descubrió cada casilla para fundir la niebla. */
export class RevelarNiebla {
  private cuando = new Map<number, number>();
  private primera = true;
  actualizar(visited: boolean[][], ahora: number) {
    // La primera vez (p. ej. al volver de una batalla) lo ya explorado aparece sin fundido.
    const desde = this.primera ? ahora - FUNDIDO_MS : ahora;
    this.primera = false;
    // Una casilla que deja de estar visitada = nivel nuevo: se olvida todo.
    for (const k of this.cuando.keys()) {
      if (!visited[Math.floor(k / 4096)]?.[k % 4096]) { this.cuando.clear(); break; }
    }
    visited.forEach((fila, y) => fila.forEach((v, x) => {
      if (v && !this.cuando.has(y * 4096 + x)) this.cuando.set(y * 4096 + x, desde);
    }));
  }
  desde(x: number, y: number) { return this.cuando.get(y * 4096 + x); }
}

export function alphaNiebla(visited: boolean[][], r: RevelarNiebla, x: number, y: number, ahora: number) {
  if (!visited[y]?.[x]) return 1;
  const t = r.desde(x, y);
  if (t === undefined) return 1;
  return Math.min(1, Math.max(0, 1 - (ahora - t) / FUNDIDO_MS));
}
