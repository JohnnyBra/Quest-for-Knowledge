import { ErrorApi } from './api';

// Envía en orden; si no hay red, guarda y reintenta en el siguiente envío. Lo que el servidor rechaza (4xx) se descarta.
export function crearCola<T>(enviar: (x: T) => Promise<unknown>) {
  const cola: T[] = [];
  let enCurso: Promise<void> | null = null;
  const vaciar = (): Promise<void> => (enCurso ??= (async () => {
    try {
      while (cola.length) {
        try { await enviar(cola[0]); }
        catch (e) { if (!(e instanceof ErrorApi && e.estado >= 400 && e.estado < 500)) return; }
        cola.shift();
      }
    } finally { enCurso = null; }
  })());
  return {
    poner: (x: T) => { cola.push(x); return vaciar(); },
    vaciar,
    pendientes: () => cola.length,
  };
}
