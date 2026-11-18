import express, { type Request, type Response, type NextFunction } from 'express';
import { scryptSync, randomBytes, timingSafeEqual, randomInt } from 'node:crypto';
import type { Db } from './db.ts';
import { esHeroeValido } from '../heroes.ts';

type Rol = 'docente' | 'alumno';
type Sesion = { rol: Rol; id: number; token: string };
type ConSesion = Request & { sesion: Sesion };

const cifrar = (clave: string) => {
  const sal = randomBytes(16).toString('hex');
  return `${sal}:${scryptSync(clave, sal, 32).toString('hex')}`;
};
const claveBuena = (clave: string, guardada: string) => {
  const [sal, hash] = guardada.split(':');
  const a = scryptSync(clave, sal, 32), b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
};
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I, O, 0, 1
const nuevoCodigo = () => Array.from({ length: 6 }, () => LETRAS[randomInt(LETRAS.length)]).join('');

const limpio = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const usuarioDe = (v: unknown) => limpio(v).toLocaleLowerCase('es');
export const entero = (v: unknown, min: number, max: number) =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : null;

class Fallo extends Error { constructor(public estado: number, mensaje: string) { super(mensaje); } }
const exigir = (cond: unknown, estado: number, mensaje: string) => { if (!cond) throw new Fallo(estado, mensaje); };

function validarCuenta(b: any) {
  const nombre = limpio(b.nombre), usuario = usuarioDe(b.usuario), clave = typeof b.clave === 'string' ? b.clave : '';
  exigir(nombre.length >= 1 && nombre.length <= 40, 400, 'Escribe tu nombre (máximo 40 letras).');
  exigir(/^[\p{L}\p{N}._-]{3,20}$/u.test(usuario), 400, 'El usuario debe tener de 3 a 20 letras o números, sin espacios.');
  exigir(clave.length >= 4 && clave.length <= 100, 400, 'La contraseña debe tener al menos 4 caracteres.');
  return { nombre, usuario, clave: cifrar(clave) };
}

export function crearApp(db: Db, opciones: { invitacion?: string } = {}) {
  const app = express();
  app.use(express.json({ limit: '20kb' }));

  const leerSesion = (req: Request): Sesion | undefined => {
    const token = req.headers.cookie?.match(/(?:^|;\s*)quest=([a-f0-9]{64})/)?.[1];
    if (!token) return undefined;
    const s = db.prepare('SELECT rol, usuario_id AS id FROM sesiones WHERE token = ?').get(token) as Omit<Sesion, 'token'> | undefined;
    return s && { rol: s.rol, id: s.id, token };
  };
  const solo = (rol: Rol) => (req: Request, _res: Response, next: NextFunction) => {
    const s = leerSesion(req);
    exigir(s, 401, 'Tienes que entrar primero.');
    exigir(s!.rol === rol, 403, 'No tienes permiso para esto.');
    (req as ConSesion).sesion = s!;
    next();
  };
  const abrirSesion = (res: Response, rol: Rol, id: number | bigint) => {
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sesiones (token, rol, usuario_id) VALUES (?, ?, ?)').run(token, rol, id);
    // ponytail: sin «Secure» porque en local va por http; el túnel del VPS ya sirve por https.
    res.setHeader('Set-Cookie', `quest=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${180 * 86400}`);
  };
  const libre = (tabla: 'docentes' | 'alumnos', usuario: string) =>
    exigir(!db.prepare(`SELECT 1 FROM ${tabla} WHERE usuario = ?`).get(usuario), 409, 'Ese usuario ya existe. Elige otro.');

  app.get('/api/salud', (_req, res) => { res.json({ ok: true }); });

  app.post('/api/docente/registro', (req, res) => {
    exigir(opciones.invitacion && limpio(req.body.invitacion) === opciones.invitacion, 403, 'El código de invitación no es correcto.');
    const c = validarCuenta(req.body);
    libre('docentes', c.usuario);
    const r = db.prepare('INSERT INTO docentes (nombre, usuario, clave) VALUES (?, ?, ?)').run(c.nombre, c.usuario, c.clave);
    abrirSesion(res, 'docente', r.lastInsertRowid);
    res.json({ ok: true });
  });

  app.post('/api/alumno/registro', (req, res) => {
    const codigo = limpio(req.body.codigo).toUpperCase().replace(/\s+/g, '');
    const clase = db.prepare('SELECT id FROM clases WHERE codigo = ?').get(codigo) as { id: number } | undefined;
    exigir(clase, 404, 'No hay ninguna clase con ese código. Pídeselo a tu maestro o maestra.');
    const c = validarCuenta(req.body);
    libre('alumnos', c.usuario);
    const r = db.prepare('INSERT INTO alumnos (clase_id, nombre, usuario, clave) VALUES (?, ?, ?, ?)').run(clase!.id, c.nombre, c.usuario, c.clave);
    abrirSesion(res, 'alumno', r.lastInsertRowid);
    res.json({ ok: true });
  });

  app.post('/api/entrar', (req, res) => {
    const rol: Rol = req.body.rol === 'docente' ? 'docente' : 'alumno';
    const fila = db.prepare(`SELECT id, clave FROM ${rol}s WHERE usuario = ?`).get(usuarioDe(req.body.usuario)) as { id: number; clave: string } | undefined;
    exigir(fila && claveBuena(String(req.body.clave ?? ''), fila.clave), 401, 'Usuario o contraseña incorrectos.');
    abrirSesion(res, rol, fila!.id);
    res.json({ ok: true });
  });

  app.post('/api/salir', (req, res) => {
    const s = leerSesion(req);
    if (s) db.prepare('DELETE FROM sesiones WHERE token = ?').run(s.token);
    res.setHeader('Set-Cookie', 'quest=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.json({ ok: true });
  });

  app.get('/api/yo', (req, res) => {
    const s = leerSesion(req);
    exigir(s, 401, 'Tienes que entrar primero.');
    if (s!.rol === 'docente') {
      const d = db.prepare('SELECT nombre, usuario FROM docentes WHERE id = ?').get(s!.id) as any;
      return res.json({ rol: 'docente', nombre: d.nombre, usuario: d.usuario });
    }
    const a = db.prepare(`SELECT a.nombre, a.usuario, c.nombre AS clase, COALESCE(a.curso_propio, c.curso) AS curso, a.heroe
      FROM alumnos a JOIN clases c ON c.id = a.clase_id WHERE a.id = ?`).get(s!.id) as any;
    const pendientes = (db.prepare(`SELECT pregunta_id FROM respuestas WHERE alumno_id = ?
      GROUP BY pregunta_id HAVING MAX(correcta) = 0 ORDER BY MIN(id)`).all(s!.id) as any[]).map(f => f.pregunta_id);
    res.json({ rol: 'alumno', nombre: a.nombre, usuario: a.usuario, clase: a.clase, curso: a.curso,
      heroe: a.heroe ? JSON.parse(a.heroe) : null, pendientes });
  });

  app.put('/api/yo/heroe', solo('alumno'), (req, res) => {
    exigir(esHeroeValido(req.body), 400, 'Ese héroe no existe.');
    db.prepare('UPDATE alumnos SET heroe = ? WHERE id = ?')
      .run(JSON.stringify({ skin: req.body.skin, genero: req.body.genero }), (req as ConSesion).sesion.id);
    res.json({ ok: true });
  });

  const clasesDe = (docente: number) => db.prepare(`SELECT c.id, c.nombre, c.curso, c.codigo, COUNT(a.id) AS alumnos
    FROM clases c LEFT JOIN alumnos a ON a.clase_id = c.id WHERE c.docente_id = ? GROUP BY c.id ORDER BY c.id`).all(docente);

  app.get('/api/clases', solo('docente'), (req, res) => { res.json(clasesDe((req as ConSesion).sesion.id)); });

  app.post('/api/clases', solo('docente'), (req, res) => {
    const nombre = limpio(req.body.nombre);
    exigir(nombre.length >= 1 && nombre.length <= 40, 400, 'Escribe el nombre de la clase (máximo 40 letras).');
    const curso = entero(req.body.curso, 3, 6);
    exigir(curso, 400, 'El curso debe ser 3º, 4º, 5º o 6º.');
    let codigo = nuevoCodigo();
    while (db.prepare('SELECT 1 FROM clases WHERE codigo = ?').get(codigo)) codigo = nuevoCodigo();
    const r = db.prepare('INSERT INTO clases (docente_id, nombre, curso, codigo) VALUES (?, ?, ?, ?)')
      .run((req as ConSesion).sesion.id, nombre, curso, codigo);
    res.json({ id: Number(r.lastInsertRowid), nombre, curso, codigo, alumnos: 0 });
  });

  // (Task 4 añade aquí partidas, respuestas y ranking.)

  app.use('/api', (_req, res) => { res.status(404).json({ error: 'No existe esa ruta.' }); });
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof Fallo) return res.status(err.estado).json({ error: err.message });
    if (err?.status === 400 || err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Petición no válida.' });
    console.error(err);
    res.status(500).json({ error: 'Error del servidor. Inténtalo otra vez.' });
  });
  return app;
}
