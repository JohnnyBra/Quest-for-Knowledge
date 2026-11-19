// Cuentas comunes del Gremio (el portal juegos.bibliohispa.es): Quest no guarda contraseñas; pregunta al portal quién
// es cada cookie y lleva una copia de docentes, clases y alumnos (cuenta_id) para que partidas y respuestas sigan igual.
// Es el mismo modo cliente que el de las apps del núcleo (plataforma-cole-juegos, servidor/gremio.js).
import type { Request } from 'express';
import type { Db } from './db.ts';

export const COOKIE = 'gremio_sesion';
export type Gremio = ReturnType<typeof clienteGremio>;
type Respuesta = { estado: number; datos: any };

export class SinGremio extends Error {
  constructor() { super('No hay conexión con el Gremio del Saber. Inténtalo dentro de un momento.'); }
}

const cookieDe = (req: Request) => req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`))?.[1] ?? '';

export function clienteGremio(db: Db, urlPortal: string) {
  const url = urlPortal.replace(/\/+$/, '');
  const transaccion = <T>(fn: () => T): T => {
    db.exec('BEGIN');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  };

  // La cookie del navegador va tal cual: el portal decide (dueño, caducidad…).
  async function pedir(req: Request, metodo: string, ruta: string, cuerpo?: unknown): Promise<Respuesta> {
    let r: globalThis.Response;
    try {
      r = await fetch(url + ruta, {
        method: metodo,
        headers: { cookie: `${COOKIE}=${cookieDe(req)}`, ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }) },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      });
    } catch { throw new SinGremio(); }
    const datos = await r.json().catch(() => null);
    if (r.status >= 500 || !datos) throw new SinGremio();
    return { estado: r.status, datos };
  }

  // Un valor único (usuario, código) que ya tiene otra fila se le cambia a esa: el portal manda.
  const apartar = (tabla: string, columna: string, valor: string, cuentaId: number) =>
    db.prepare(`UPDATE ${tabla} SET ${columna} = ${columna} || ' ~' || id WHERE ${columna} = ? AND cuenta_id IS NOT ?`).run(valor, cuentaId);
  const idLocal = (tabla: string, cuentaId: number) => (db.prepare(`SELECT id FROM ${tabla} WHERE cuenta_id = ?`).get(cuentaId) as { id: number }).id;

  function copiarDocente(p: { id: number; nombre: string }) {
    apartar('docentes', 'usuario', p.nombre, p.id);
    db.prepare(`INSERT INTO docentes (cuenta_id, nombre, usuario, clave) VALUES (?, ?, ?, '')
      ON CONFLICT (cuenta_id) DO UPDATE SET nombre = excluded.nombre, usuario = excluded.usuario`).run(p.id, p.nombre, p.nombre);
    return idLocal('docentes', p.id);
  }
  function copiarClase(c: { id: number; nombre: string; codigo: string; curso: number }, docente: number) {
    apartar('clases', 'codigo', c.codigo, c.id);
    db.prepare(`INSERT INTO clases (cuenta_id, docente_id, nombre, curso, codigo) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (cuenta_id) DO UPDATE SET docente_id = excluded.docente_id, nombre = excluded.nombre, curso = excluded.curso, codigo = excluded.codigo`)
      .run(c.id, docente, c.nombre, c.curso, c.codigo);
    return idLocal('clases', c.id);
  }
  // En Quest el «nombre» sale en la clasificación: es el alias del Gremio (el nombre real solo lo ve el docente en el portal).
  function copiarAlumno(a: { id: number; alias: string }, clase: number) {
    apartar('alumnos', 'usuario', a.alias, a.id);
    db.prepare(`INSERT INTO alumnos (cuenta_id, clase_id, nombre, usuario, clave) VALUES (?, ?, ?, ?, '')
      ON CONFLICT (cuenta_id) DO UPDATE SET clase_id = excluded.clase_id, nombre = excluded.nombre, usuario = excluded.usuario`).run(a.id, clase, a.alias, a.alias);
    return idLocal('alumnos', a.id);
  }

  // Quién es (una consulta al portal por petición; está en la misma máquina). null = sin sesión; 'cerrado' = alumno
  // de una clase que aún no tiene Quest abierto.
  // ponytail: sin caché; una por token si algún día se nota.
  async function quienEs(req: Request): Promise<{ rol: 'docente' | 'alumno'; id: number } | null | 'cerrado'> {
    if (!cookieDe(req)) return null;
    const { estado, datos: yo } = await pedir(req, 'GET', '/api/yo?juego=quest');
    if (estado !== 200) return null;
    if (yo.tipo === 'profe') return { rol: 'docente', id: transaccion(() => copiarDocente(yo)) };
    if (!yo.abierto) return 'cerrado';
    return { rol: 'alumno', id: transaccion(() => copiarAlumno(yo, copiarClase(yo.clase, copiarDocente(yo.clase.profesor)))) };
  }

  // Las clases y alumnos del docente tal como están en el portal; lo que ya no está allí se borra de Quest
  // (con sus partidas y respuestas, como al quitar un alumno). Lo que no vino del portal no se toca.
  async function sincronizar(req: Request, docente: number) {
    const { estado, datos: clases } = await pedir(req, 'GET', '/api/clases');
    if (estado !== 200 || !Array.isArray(clases)) throw new SinGremio();
    transaccion(() => {
      const vivas = new Set<number>(), vivos = new Set<number>();
      for (const c of clases) {
        const clase = copiarClase(c, docente);
        vivas.add(clase);
        for (const a of c.alumnos) vivos.add(copiarAlumno(a, clase));
      }
      for (const c of db.prepare('SELECT id, cuenta_id FROM clases WHERE docente_id = ?').all(docente) as any[]) {
        for (const a of db.prepare('SELECT id FROM alumnos WHERE clase_id = ? AND cuenta_id IS NOT NULL').all(c.id) as any[]) {
          if (!vivos.has(a.id)) db.prepare('DELETE FROM alumnos WHERE id = ?').run(a.id);
        }
        if (c.cuenta_id !== null && !vivas.has(c.id) && !db.prepare('SELECT 1 FROM alumnos WHERE clase_id = ?').get(c.id)) db.prepare('DELETE FROM clases WHERE id = ?').run(c.id);
      }
    });
  }

  return { pedir, quienEs, sincronizar };
}
