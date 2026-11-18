import { api } from './api';
import { crearCola } from './cola';
import { ErrorApi } from './api';

type Juego = { id: number | null; inicio: Promise<number | null> | null };
type Fin = { puntos: number; nivel_heroe: number; mapa: number };

// La partida se crea en el servidor al empezar; si no hay red, se vuelve a intentar con la siguiente respuesta.
// Cada respuesta va con su propio juego, así una respuesta atrasada nunca se cuela en la partida siguiente.
export function crearPartida(llamar: <T>(ruta: string, cuerpo?: unknown) => Promise<T> = api) {
  let actual: Juego | null = null;
  const idDe = async (j: Juego) => {
    if (j.id === null) {
      j.inicio ??= llamar<{ id: number }>('/api/partidas', {}).then(r => r.id, () => null);
      j.id = await j.inicio;
      if (j.id === null) j.inicio = null;
    }
    return j.id;
  };
  const cola = crearCola<{ juego: Juego; datos: object }>(async ({ juego, datos }) => {
    const id = await idDe(juego);
    if (id === null) throw new ErrorApi('Sin conexión', 0);
    return llamar('/api/respuestas', { partida_id: id, ...datos });
  });

  return {
    empezar: async () => { actual = { id: null, inicio: null }; await idDe(actual); },
    responder: (pregunta_id: string, correcta: boolean, ms: number) =>
      actual ? cola.poner({ juego: actual, datos: { pregunta_id, correcta, ms: Math.round(ms) } }) : Promise.resolve(),
    terminar: async (d: Fin) => {
      const j = actual; actual = null;
      if (!j) return;
      await cola.vaciar();
      const id = await idDe(j);
      if (id !== null) await llamar(`/api/partidas/${id}/fin`, d).catch(() => { /* sin red: la partida queda sin puntos */ });
    },
    vaciar: () => cola.vaciar(),
  };
}

const partida = crearPartida();
export const empezarPartida = partida.empezar;
export const enviarRespuesta = (pregunta_id: string, correcta: boolean, ms: number) => { void partida.responder(pregunta_id, correcta, ms); };
export const terminarPartida = partida.terminar;
