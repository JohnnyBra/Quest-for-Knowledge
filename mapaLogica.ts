// Lógica pura del dibujo del mapa: qué casillas parecen muro, dónde va la cara frontal y las antorchas,
// y cuánto tapa la niebla cada casilla (con fundido al descubrirla).
import { TileType } from './types';

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
  actualizar(visited: boolean[][], ahora: number) {
    // Una casilla que deja de estar visitada = nivel nuevo: se olvida todo.
    for (const k of this.cuando.keys()) {
      if (!visited[Math.floor(k / 4096)]?.[k % 4096]) { this.cuando.clear(); break; }
    }
    visited.forEach((fila, y) => fila.forEach((v, x) => {
      if (v && !this.cuando.has(y * 4096 + x)) this.cuando.set(y * 4096 + x, ahora);
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
