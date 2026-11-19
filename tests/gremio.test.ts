// Quest con las cuentas comunes del Gremio: quién entra lo dice el portal; Quest guarda una copia (cuenta_id).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { abrirDb, type Db } from '../servidor/db.ts';
import { crearApp } from '../servidor/app.ts';

// Un portal de mentira con lo justo de la API de cuentas del núcleo (servidor/cuentas.js).
const P = {
  abierto: true,
  profes: [{ id: 7, nombre: 'Javi Barrero', tratamiento: null }],
  clases: [{ id: 3, nombre: '6ºB', codigo: 'AUB965', curso: 5, profesor: 7 }],
  alumnos: [{ id: 11, alias: 'Luna', clase: 3, nombre_real: 'Luna G.', clave: 'gema' }, { id: 12, alias: 'Sol', clase: 3, nombre_real: null, clave: 'sol1' }],
  sesiones: new Map<string, { tipo: 'profe' | 'alumno'; id: number }>([['t-profe', { tipo: 'profe', id: 7 }], ['t-luna', { tipo: 'alumno', id: 11 }], ['t-sol', { tipo: 'alumno', id: 12 }]]),
};
function portalFalso() {
  const app = express();
  app.use(express.json());
  const s = (req: express.Request) => P.sesiones.get(req.headers.cookie?.match(/gremio_sesion=([^;]*)/)?.[1] ?? '');
  const profe = (req: express.Request, res: express.Response) => { const x = s(req); if (x?.tipo !== 'profe') { res.status(401).json({ error: 'no' }); return null; } return x; };
  app.get('/api/yo', (req, res) => {
    const x = s(req);
    if (!x) return res.status(401).json({ error: 'Sesión no válida' });
    if (x.tipo === 'profe') { const p = P.profes.find((q) => q.id === x.id)!; return res.json({ tipo: 'profe', id: p.id, nombre: p.nombre, tratamiento: p.tratamiento }); }
    const a = P.alumnos.find((q) => q.id === x.id)!; const c = P.clases.find((q) => q.id === a.clase)!; const p = P.profes.find((q) => q.id === c.profesor)!;
    res.json({ tipo: 'alumno', id: a.id, alias: a.alias, clase: { id: c.id, nombre: c.nombre, codigo: c.codigo, curso: c.curso, profesor: { id: p.id, nombre: p.nombre, tratamiento: null } },
      juegos: P.abierto ? ['quest'] : [], abierto: P.abierto && req.query.juego === 'quest' });
  });
  app.get('/api/clases', (req, res) => {
    const x = profe(req, res); if (!x) return;
    res.json(P.clases.filter((c) => c.profesor === x.id).map((c) => ({ id: c.id, nombre: c.nombre, codigo: c.codigo, curso: c.curso, juegos: { quest: P.abierto },
      alumnos: P.alumnos.filter((a) => a.clase === c.id).map((a) => ({ id: a.id, alias: a.alias, nombre_real: a.nombre_real })) })));
  });
  app.post('/api/clases', (req, res) => {
    const x = profe(req, res); if (!x) return;
    const id = 100 + P.clases.length;
    P.clases.push({ id, nombre: req.body.nombre, codigo: `NUEVA${P.clases.length}`, curso: req.body.curso, profesor: x.id });
    res.json({ id, codigo: `NUEVA${P.clases.length - 1}` });
  });
  app.post('/api/alumnos/:id/password', (req, res) => {
    if (!profe(req, res)) return;
    P.alumnos.find((a) => a.id === Number(req.params.id))!.clave = req.body.password;
    res.json({ ok: true });
  });
  app.delete('/api/alumnos/:id', (req, res) => {
    if (!profe(req, res)) return;
    P.alumnos = P.alumnos.filter((a) => a.id !== Number(req.params.id));
    res.json({ ok: true });
  });
  app.post('/api/auth/logout', (req, res) => { P.sesiones.delete(req.headers.cookie?.match(/gremio_sesion=([^;]*)/)?.[1] ?? ''); res.json({ ok: true }); });
  return app;
}

let db: Db, portal: Server, quest: Server, url = '';
const escuchar = async (s: Server) => { await once(s, 'listening'); return `http://127.0.0.1:${(s.address() as AddressInfo).port}`; };
before(async () => {
  portal = portalFalso().listen(0);
  const urlPortal = await escuchar(portal);
  db = abrirDb(':memory:');
  quest = crearApp(db, { gremio: { url: urlPortal, publico: 'https://juegos.ejemplo.test' } }).listen(0);
  url = await escuchar(quest);
});
after(() => { quest.close(); portal.close(); });

const como = (token?: string) => async (ruta: string, cuerpo?: unknown, metodo?: string) => {
  const r = await fetch(url + ruta, {
    method: metodo ?? (cuerpo === undefined ? 'GET' : 'POST'),
    headers: { 'Content-Type': 'application/json', ...(token ? { cookie: `gremio_sesion=${token}` } : {}) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  return { estado: r.status, datos: await r.json() as any };
};
const nadie = como(), luna = como('t-luna'), sol = como('t-sol'), profe = como('t-profe');

test('sin sesión manda al portal; entrar y darse de alta en Quest ya no existen', async () => {
  const r = await nadie('/api/yo');
  assert.equal(r.estado, 401);
  assert.equal(r.datos.entrar, 'https://juegos.ejemplo.test');
  assert.equal((await nadie('/api/entrar', { usuario: 'luna', clave: 'gema' })).estado, 404);
  assert.equal((await nadie('/api/alumno/registro', { codigo: 'AUB965' })).estado, 404);
});

test('el alumno del portal entra con su alias y el curso de su clase, y juega', async () => {
  const yo = (await luna('/api/yo')).datos;
  assert.deepEqual([yo.rol, yo.nombre, yo.usuario, yo.clase, yo.curso], ['alumno', 'Luna', 'Luna', '6ºB', 5]);
  const { datos: p } = await luna('/api/partidas', {});
  assert.equal((await luna(`/api/partidas/${p.id}/fin`, { puntos: 40, nivel_heroe: 2, mapa: 1 })).estado, 200);
  // En la clasificación sale el alias, nunca el nombre real.
  assert.deepEqual((await sol('/api/ranking')).datos.map((f: any) => f.nombre), ['Luna']);
});

test('el docente ve sus clases del portal; bajar el curso a un alumno se queda en Quest', async () => {
  const [clase] = (await profe('/api/clases')).datos;
  assert.deepEqual([clase.nombre, clase.codigo, clase.curso, clase.alumnos], ['6ºB', 'AUB965', 5, 2]);
  const { datos } = await profe(`/api/clases/${clase.id}`);
  const lunaLocal = datos.alumnos.find((a: any) => a.usuario === 'Luna').id;
  assert.equal((await profe(`/api/alumnos/${lunaLocal}`, { curso: 3 }, 'PUT')).estado, 200);
  assert.equal((await luna('/api/yo')).datos.curso, 3);
});

test('crear clase, cambiar contraseña y quitar alumno pasan por el portal', async () => {
  const nueva = await profe('/api/clases', { nombre: '5ºA', curso: 5 });
  assert.equal(nueva.estado, 200);
  assert.equal(nueva.datos.codigo, 'NUEVA1');
  assert.ok(P.clases.some((c) => c.nombre === '5ºA'));
  const [clase] = (await profe('/api/clases')).datos;
  const solLocal = (await profe(`/api/clases/${clase.id}`)).datos.alumnos.find((a: any) => a.usuario === 'Sol').id;
  assert.equal((await profe(`/api/alumnos/${solLocal}`, { clave: 'nueva1' }, 'PUT')).estado, 200);
  assert.equal(P.alumnos.find((a) => a.alias === 'Sol')!.clave, 'nueva1');
  assert.equal((await profe(`/api/alumnos/${solLocal}`, undefined, 'DELETE')).estado, 200);
  assert.ok(!P.alumnos.some((a) => a.alias === 'Sol'));
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM alumnos WHERE usuario = 'Sol'").get() as any).n, 0);
});

test('con Quest cerrado para su clase, el alumno ve el aviso (403) y no puede jugar', async () => {
  P.abierto = false;
  const r = await luna('/api/yo');
  assert.equal(r.estado, 403);
  assert.equal(r.datos.cerrado, true);
  assert.equal((await luna('/api/partidas', {})).estado, 403);
  assert.equal((await profe('/api/clases')).estado, 200);
  P.abierto = true;
});

test('salir cierra la sesión del portal', async () => {
  const r = await luna('/api/salir', {});
  assert.deepEqual(r.datos, { ok: true, entrar: 'https://juegos.ejemplo.test' });
  assert.equal((await luna('/api/yo')).estado, 401);
});

test('con el portal caído, Quest responde 503 con un mensaje claro', async () => {
  portal.close();
  const r = await profe('/api/yo');
  assert.equal(r.estado, 503);
  assert.match(r.datos.error, /Gremio/);
});
