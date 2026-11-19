// Cuentas comunes del Gremio (el portal juegos.bibliohispa.es): Quest no guarda contraseñas; pregunta al portal quién
// es cada cookie y lleva una copia de docentes, clases y alumnos (cuenta_id) para que partidas y respuestas sigan igual.
// Es el mismo modo cliente que el de las apps del núcleo (plataforma-cole-juegos, servidor/gremio.js).
import type { Request } from 'express';
import type { Db } from './db.ts';

export const COOKIE = 'gremio_sesion';
export type Gremio = ReturnType<typeof clienteGremio>;
type Respuesta = { estado: number; datos: any };

export class SinGremio extends Error {
  constructor(mensaje = 'No hay conexión con el Gremio del Saber. Inténtalo dentro de un momento.') { super(mensaje); }
}
// El portal ya no reconoce la sesión (caducó mientras se usaba): a entrar otra vez.
export class SinSesion extends Error {}

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
    // Un docente de Quest con ese nombre y sin unir: falta juntar las cuentas; apartarlo le escondería sus clases.
    if (db.prepare('SELECT 1 FROM docentes WHERE usuario = ? AND cuenta_id IS NULL').get(p.nombre)) {
      throw new SinGremio('Quest aún no tiene las cuentas unidas al Gremio. Avisa a Javi.');
    }
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
    const id = idLocal('clases', c.id);
    // Bajar el curso a un alumno solo vale por debajo del de su clase: si la clase baja, lo que ya no es menor se quita.
    db.prepare('UPDATE alumnos SET curso_propio = NULL WHERE clase_id = ? AND curso_propio >= ?').run(id, c.curso);
    return id;
  }
  // En Quest el «nombre» sale en la clasificación: es el alias del Gremio (el nombre real solo lo ve el docente en el portal).
  // El usuario es único en todo Quest, pero un alias solo lo es en su clase: si ya lo tiene otro, «alias ~cuenta», y
  // cada uno conserva el suyo (sin renombrarse el uno al otro en cada petición).
  function copiarAlumno(a: { id: number; alias: string }, clase: number) {
    const ya = db.prepare('SELECT usuario FROM alumnos WHERE cuenta_id = ?').get(a.id) as { usuario: string } | undefined;
    const conNumero = `${a.alias} ~${a.id}`;
    const usuario = ya && (ya.usuario === a.alias || ya.usuario === conNumero) ? ya.usuario
      : db.prepare('SELECT 1 FROM alumnos WHERE usuario = ? AND cuenta_id IS NOT ?').get(a.alias, a.id) ? conNumero : a.alias;
    db.prepare(`INSERT INTO alumnos (cuenta_id, clase_id, nombre, usuario, clave) VALUES (?, ?, ?, ?, '')
      ON CONFLICT (cuenta_id) DO UPDATE SET clase_id = excluded.clase_id, nombre = excluded.nombre, usuario = excluded.usuario`).run(a.id, clase, a.alias, usuario);
    const id = idLocal('alumnos', a.id);
    db.prepare('UPDATE alumnos SET curso_propio = NULL WHERE id = ? AND curso_propio >= (SELECT curso FROM clases WHERE id = ?)').run(id, clase);
    return id;
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
  // ponytail: pedir y aplicar no son atómicos; una lista lenta de antes de un alta puede quitar esa copia hasta la
  // siguiente sincronización (solo pierde algo si el alumno jugó justo entre medias; el portal está en esta máquina).
  async function sincronizar(req: Request, docente: number) {
    const { estado, datos: clases } = await pedir(req, 'GET', '/api/clases');
    if (estado === 401) throw new SinSesion();
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
