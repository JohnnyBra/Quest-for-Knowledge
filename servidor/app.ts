import express, { type Request, type Response, type NextFunction } from 'express';
import { scrypt, randomBytes, timingSafeEqual, randomInt } from 'node:crypto';
import { promisify } from 'node:util';
import type { Db } from './db.ts';
import { esHeroeValido } from '../heroes.ts';
import { preguntaPorId, cursosConBateria } from '../data/preguntas/index.ts';
import { cifras, porMateria, masFalladas, listasAlumno, type Fila } from './analisis.ts';

type Rol = 'docente' | 'alumno';
type Sesion = { rol: Rol; id: number; token: string };
type ConSesion = Request & { sesion: Sesion };

const derivar = promisify(scrypt) as (clave: string, sal: string, largo: number) => Promise<Buffer>;
const cifrar = async (clave: string) => {
  const sal = randomBytes(16).toString('hex');
  return `${sal}:${(await derivar(clave, sal, 32)).toString('hex')}`;
};
const claveBuena = async (clave: string, guardada: string) => {
  const [sal, hash] = guardada.split(':');
  const a = await derivar(clave, sal, 32), b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
};
// Cuánto dura una sesión: el alumnado comparte aparatos en clase, así que su sesión acaba con el navegador
// (cookie sin Max-Age) y, por si el navegador la recupera al reabrirse, el servidor la da por caducada a las 8 horas.
const DURACION = { docente: '-180 days', alumno: '-8 hours' } as const;

// ponytail: intentos fallidos en memoria (se olvidan al reiniciar); basta para una clase.
const FALLOS_MAX = 10, BLOQUEO_MS = 10 * 60_000;
const fallos = new Map<string, { n: number; desde: number }>();
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I, O, 0, 1
const nuevoCodigo = () => Array.from({ length: 6 }, () => LETRAS[randomInt(LETRAS.length)]).join('');

const limpio = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const usuarioDe = (v: unknown) => limpio(v).normalize('NFC').toLocaleLowerCase('es');
export const entero = (v: unknown, min: number, max: number) =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : null;

class Fallo extends Error { constructor(public estado: number, mensaje: string) { super(mensaje); } }
const exigir = (cond: unknown, estado: number, mensaje: string) => { if (!cond) throw new Fallo(estado, mensaje); };

async function validarCuenta(b: any) {
  const nombre = limpio(b.nombre), usuario = usuarioDe(b.usuario), clave = typeof b.clave === 'string' ? b.clave : '';
  exigir(nombre.length >= 1 && nombre.length <= 40, 400, 'Escribe tu nombre (máximo 40 letras).');
  exigir(/^[\p{L}\p{N}._-]{3,20}$/u.test(usuario), 400, 'El usuario debe tener de 3 a 20 letras o números, sin espacios.');
  exigir(clave.length >= 4 && clave.length <= 100, 400, 'La contraseña debe tener al menos 4 caracteres.');
  return { nombre, usuario, clave: await cifrar(clave) };
}

export function crearApp(db: Db, opciones: { invitacion?: string } = {}) {
  const app = express();
  app.use(express.json({ limit: '20kb' }));
  app.use((req, _res, next) => { req.body ??= {}; next(); });

  const leerSesion = (req: Request): Sesion | undefined => {
    const token = req.headers.cookie?.match(/(?:^|;\s*)quest=([a-f0-9]{64})/)?.[1];
    if (!token) return undefined;
    const s = db.prepare(`SELECT rol, usuario_id AS id FROM sesiones WHERE token = ?
      AND creada > datetime('now', CASE rol WHEN 'alumno' THEN '${DURACION.alumno}' ELSE '${DURACION.docente}' END)`)
      .get(token) as Omit<Sesion, 'token'> | undefined;
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
    res.setHeader('Set-Cookie', `quest=${token}; HttpOnly; SameSite=Lax; Path=/${rol === 'docente' ? `; Max-Age=${180 * 86400}` : ''}`);
  };
  const libre = (tabla: 'docentes' | 'alumnos', usuario: string) =>
    exigir(!db.prepare(`SELECT 1 FROM ${tabla} WHERE usuario = ?`).get(usuario), 409, 'Ese usuario ya existe. Elige otro.');

  app.get('/api/salud', (_req, res) => { res.json({ ok: true }); });

  app.post('/api/docente/registro', async (req, res) => {
    exigir(opciones.invitacion && limpio(req.body.invitacion) === opciones.invitacion, 403, 'El código de invitación no es correcto.');
    const c = await validarCuenta(req.body);
    libre('docentes', c.usuario);
    const r = db.prepare('INSERT INTO docentes (nombre, usuario, clave) VALUES (?, ?, ?)').run(c.nombre, c.usuario, c.clave);
    abrirSesion(res, 'docente', r.lastInsertRowid);
    res.json({ ok: true });
  });

  app.post('/api/alumno/registro', async (req, res) => {
    const codigo = limpio(req.body.codigo).toUpperCase().replace(/\s+/g, '');
    const clase = db.prepare('SELECT id FROM clases WHERE codigo = ?').get(codigo) as { id: number } | undefined;
    exigir(clase, 404, 'No hay ninguna clase con ese código. Pídeselo a tu maestro o maestra.');
    const c = await validarCuenta(req.body);
    libre('alumnos', c.usuario);
    const r = db.prepare('INSERT INTO alumnos (clase_id, nombre, usuario, clave) VALUES (?, ?, ?, ?)').run(clase!.id, c.nombre, c.usuario, c.clave);
    abrirSesion(res, 'alumno', r.lastInsertRowid);
    res.json({ ok: true });
  });

  app.post('/api/entrar', async (req, res) => {
    const rol: Rol = req.body.rol === 'docente' ? 'docente' : 'alumno';
    const usuario = usuarioDe(req.body.usuario), llave = `${rol}:${usuario}`;
    const f = fallos.get(llave);
    if (f && Date.now() - f.desde > BLOQUEO_MS) fallos.delete(llave);
    exigir((fallos.get(llave)?.n ?? 0) < FALLOS_MAX, 429, 'Demasiados intentos. Espera unos minutos y vuelve a probar.');
    const fila = db.prepare(`SELECT id, clave FROM ${rol}s WHERE usuario = ?`).get(usuario) as { id: number; clave: string } | undefined;
    if (!fila || !(await claveBuena(String(req.body.clave ?? ''), fila.clave))) {
      const g = fallos.get(llave) ?? { n: 0, desde: Date.now() };
      fallos.set(llave, { n: g.n + 1, desde: g.desde });
      exigir(false, 401, 'Usuario o contraseña incorrectos.');
    }
    fallos.delete(llave);
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

  const FILAS = 'SELECT r.id, r.alumno_id, r.pregunta_id, r.materia, r.correcta, r.texto, r.curso FROM respuestas r';
  const claseMia = (req: Request) => {
    const c = db.prepare('SELECT id, nombre, curso, codigo FROM clases WHERE id = ? AND docente_id = ?')
      .get(Number(req.params.id), (req as ConSesion).sesion.id) as { id: number; nombre: string; curso: number; codigo: string } | undefined;
    exigir(c, 404, 'Esa clase no existe.');
    return { ...c! };
  };
  const alumnoMio = (req: Request) => {
    const a = db.prepare(`SELECT a.id, a.nombre, a.usuario, a.curso_propio, c.curso AS curso_clase, c.id AS clase_id, c.nombre AS clase
      FROM alumnos a JOIN clases c ON c.id = a.clase_id WHERE a.id = ? AND c.docente_id = ?`)
      .get(Number(req.params.id), (req as ConSesion).sesion.id) as any;
    exigir(a, 404, 'Ese alumno no existe.');
    return a;
  };

  app.get('/api/clases/:id', solo('docente'), (req, res) => {
    const clase = claseMia(req);
    const filas = db.prepare(`${FILAS} JOIN alumnos a ON a.id = r.alumno_id WHERE a.clase_id = ?`).all(clase.id) as unknown as Fila[];
    const alumnos = (db.prepare('SELECT id, nombre, usuario, curso_propio FROM alumnos WHERE clase_id = ? ORDER BY nombre COLLATE NOCASE, id').all(clase.id) as any[])
      .map(a => ({ id: a.id, nombre: a.nombre, usuario: a.usuario, curso: a.curso_propio ?? clase.curso,
        bajado: a.curso_propio !== null && a.curso_propio < clase.curso, ...cifras(filas.filter(f => f.alumno_id === a.id)) }));
    res.json({ clase, total: { ...cifras(filas), activos: new Set(filas.map(f => f.alumno_id)).size },
      materias: porMateria(filas), alumnos, masFalladas: masFalladas(filas) });
  });

  app.get('/api/alumnos/:id', solo('docente'), (req, res) => {
    const a = alumnoMio(req);
    const filas = db.prepare(`${FILAS} WHERE r.alumno_id = ?`).all(a.id) as unknown as Fila[];
    res.json({
      alumno: { id: a.id, nombre: a.nombre, usuario: a.usuario, curso: a.curso_propio ?? a.curso_clase, cursoClase: a.curso_clase, clase: { id: a.clase_id, nombre: a.clase } },
      cursosPosibles: [3, 4, 5, 6].filter(c => c === a.curso_clase || (c < a.curso_clase && cursosConBateria().includes(c as any))),
      total: cifras(filas), materias: porMateria(filas), ...listasAlumno(filas),
    });
  });

  app.put('/api/alumnos/:id', solo('docente'), async (req, res) => {
    const a = alumnoMio(req);
    if (req.body.curso !== undefined) {
      const curso = entero(req.body.curso, 3, a.curso_clase);
      exigir(curso, 400, `El curso debe estar entre 3º y ${a.curso_clase}º.`);
      exigir(curso === a.curso_clase || cursosConBateria().includes(curso as any), 400, `Todavía no hay preguntas de ${curso}º.`);
      db.prepare('UPDATE alumnos SET curso_propio = ? WHERE id = ?').run(curso === a.curso_clase ? null : curso, a.id);
    } else if (req.body.clave !== undefined) {
      const clave = typeof req.body.clave === 'string' ? req.body.clave : '';
      exigir(clave.length >= 4 && clave.length <= 100, 400, 'La contraseña debe tener al menos 4 caracteres.');
      db.prepare('UPDATE alumnos SET clave = ? WHERE id = ?').run(await cifrar(clave), a.id);
      db.prepare("DELETE FROM sesiones WHERE rol = 'alumno' AND usuario_id = ?").run(a.id); // quien estuviera dentro con la vieja, fuera
    } else exigir(false, 400, 'No hay nada que cambiar.');
    res.json({ ok: true });
  });

  app.delete('/api/alumnos/:id', solo('docente'), (req, res) => {
    const a = alumnoMio(req);
    db.prepare("DELETE FROM sesiones WHERE rol = 'alumno' AND usuario_id = ?").run(a.id);
    db.prepare('DELETE FROM alumnos WHERE id = ?').run(a.id); // partidas y respuestas caen en cascada
    res.json({ ok: true });
  });

  const partidaPropia = (id: unknown, alumno: number) =>
    db.prepare('SELECT id, fin FROM partidas WHERE id = ? AND alumno_id = ?').get(Number(id), alumno) as { id: number; fin: string | null } | undefined;

  app.post('/api/partidas', solo('alumno'), (req, res) => {
    const r = db.prepare('INSERT INTO partidas (alumno_id) VALUES (?)').run((req as ConSesion).sesion.id);
    res.json({ id: Number(r.lastInsertRowid) });
  });

  app.post('/api/partidas/:id/fin', solo('alumno'), (req, res) => {
    const yo = (req as ConSesion).sesion.id;
    const puntos = entero(req.body.puntos, 0, 10_000_000), nivel = entero(req.body.nivel_heroe, 1, 999), mapa = entero(req.body.mapa, 1, 99);
    exigir(puntos !== null && nivel !== null && mapa !== null, 400, 'Datos de la partida no válidos.');
    const p = partidaPropia(req.params.id, yo);
    exigir(p, 404, 'Esa partida no existe.');
    exigir(!p!.fin, 409, 'Esa partida ya estaba terminada.');
    db.prepare("UPDATE partidas SET fin = datetime('now'), puntos = ?, nivel_heroe = ?, mapa = ? WHERE id = ?").run(puntos, nivel, mapa, p!.id);
    res.json({ ok: true });
  });

  app.post('/api/respuestas', solo('alumno'), (req, res) => {
    const yo = (req as ConSesion).sesion.id;
    const q = preguntaPorId(limpio(req.body.pregunta_id));
    exigir(q, 400, 'Pregunta desconocida.');
    exigir(typeof req.body.correcta === 'boolean', 400, 'Falta saber si la respuesta es correcta.');
    const p = partidaPropia(req.body.partida_id, yo);
    exigir(p, 404, 'Esa partida no existe.');
    db.prepare(`INSERT INTO respuestas (alumno_id, partida_id, pregunta_id, curso, materia, dificultad, texto, correcta, ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(yo, p!.id, q!.id, q!.curso, q!.subject, q!.difficulty, q!.text, req.body.correcta ? 1 : 0, entero(req.body.ms, 0, 600_000));
    res.json({ ok: true });
  });

  app.get('/api/ranking', solo('alumno'), (req, res) => {
    // SQLite: con MAX(), las columnas sueltas (nivel) salen de la fila del máximo.
    res.json(db.prepare(`SELECT a.nombre, MAX(p.puntos) AS puntos, p.nivel_heroe AS nivel
      FROM partidas p JOIN alumnos a ON a.id = p.alumno_id
      WHERE a.clase_id = (SELECT clase_id FROM alumnos WHERE id = ?) AND p.puntos IS NOT NULL
      GROUP BY a.id ORDER BY puntos DESC LIMIT 100`).all((req as ConSesion).sesion.id));
  });

  app.use('/api', (_req, res) => { res.status(404).json({ error: 'No existe esa ruta.' }); });
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof Fallo) return res.status(err.estado).json({ error: err.message });
    if (err?.status === 400 || err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Petición no válida.' });
    console.error(err);
    res.status(500).json({ error: 'Error del servidor. Inténtalo otra vez.' });
  });
  return app;
}
