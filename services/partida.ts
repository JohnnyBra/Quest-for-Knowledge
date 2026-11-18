import { api } from './api';
import { crearCola } from './cola';

let partida: number | null = null;
const cola = crearCola<object>(r => api('/api/respuestas', r));

export async function empezarPartida() {
  partida = null;
  try { partida = (await api<{ id: number }>('/api/partidas', {})).id; } catch { /* sin red: se juega sin guardar */ }
}

export function enviarRespuesta(pregunta_id: string, correcta: boolean, ms: number) {
  if (partida !== null) void cola.poner({ partida_id: partida, pregunta_id, correcta, ms: Math.round(ms) });
}

export async function terminarPartida(d: { puntos: number; nivel_heroe: number; mapa: number }) {
  const id = partida; partida = null;
  if (id === null) return;
  await cola.vaciar();
  try { await api(`/api/partidas/${id}/fin`, d); } catch { /* sin red: la partida queda sin puntos */ }
}
