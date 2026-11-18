import type { HeroChoice } from '../heroes';
import type { Curso } from '../data/preguntas/index';

export class ErrorApi extends Error { constructor(mensaje: string, public estado: number) { super(mensaje); } }

export type Yo =
  | { rol: 'alumno'; nombre: string; usuario: string; clase: string; curso: Curso; heroe: HeroChoice | null; pendientes: string[] }
  | { rol: 'docente'; nombre: string; usuario: string };

export async function api<T = any>(ruta: string, cuerpo?: unknown, metodo = cuerpo === undefined ? 'GET' : 'POST'): Promise<T> {
  let r: Response;
  try {
    r = await fetch(ruta, {
      method: metodo, credentials: 'same-origin',
      headers: cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch { throw new ErrorApi('No se puede conectar con el servidor. Revisa la conexión.', 0); }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorApi(datos.error ?? 'Algo ha fallado. Inténtalo otra vez.', r.status);
  return datos as T;
}
