import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { abrirDb, type Db } from '../servidor/db.ts';
import { crearApp } from '../servidor/app.ts';
import { bateria } from '../data/preguntas/index.ts';

let db: Db, srv: Server, url = '';
before(async () => {
  db = abrirDb(':memory:');
  srv = crearApp(db, { invitacion: 'PROFE-2026' }).listen(0);
  await once(srv, 'listening');
  url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
});
after(() => srv.close());

// Un «navegador» con su cookie.
function cliente() {
  let cookie = '';
  return async (ruta: string, cuerpo?: unknown, metodo?: string) => {
    const r = await fetch(url + ruta, {
      method: metodo ?? (cuerpo === undefined ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return { estado: r.status, datos: await r.json() as any };
  };
}

// responde por un alumno: [pregunta, acierto]
async function responder(a: ReturnType<typeof cliente>, respuestas: Array<[number, boolean]>) {
  const { datos: { id } } = await a('/api/partidas', {});
  for (const [i, bien] of respuestas) await a('/api/respuestas', { partida_id: id, pregunta_id: bateria(5)[i].id, correcta: bien, ms: 1000 });
}

let n = 0;
const unico = (base: string) => `${base}${++n}`;

async function docenteConClase(curso = 6) {
  const profe = cliente();
  await profe('/api/docente/registro', { invitacion: 'PROFE-2026', nombre: 'Javi', usuario: unico('javi'), clave: 'secreta' });
  const { datos: clase } = await profe('/api/clases', { nombre: '6ºB', curso });
  return { profe, clase };
}
async function alumnoEn(codigo: string, usuario = unico('ana')) {
  const a = cliente();
  const r = await a('/api/alumno/registro', { codigo, nombre: 'Ana', usuario, clave: '1234' });
  assert.equal(r.estado, 200, JSON.stringify(r.datos));
  return a;
}

test('docente: invitación obligatoria, usuario único, /api/yo', async () => {
  const p = cliente();
  assert.equal((await p('/api/docente/registro', { invitacion: 'mal', nombre: 'X', usuario: 'xx1', clave: 'secreta' })).estado, 403);
  const u = unico('profe');
  assert.equal((await p('/api/docente/registro', { invitacion: 'PROFE-2026', nombre: 'Javi', usuario: u, clave: 'secreta' })).estado, 200);
  assert.deepEqual((await p('/api/yo')).datos, { rol: 'docente', nombre: 'Javi', usuario: u });
  assert.equal((await cliente()('/api/docente/registro', { invitacion: 'PROFE-2026', nombre: 'Otro', usuario: u, clave: 'secreta' })).estado, 409);
});

test('sin invitación configurada no se registra ningún docente', async () => {
  const s = crearApp(abrirDb(':memory:')).listen(0); await once(s, 'listening');
  const r = await fetch(`http://127.0.0.1:${(s.address() as AddressInfo).port}/api/docente/registro`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invitacion: '', nombre: 'X', usuario: 'xxx', clave: 'secreta' }) });
  assert.equal(r.status, 403); s.close();
});

test('clases: crear con código de 6, curso 3-6, solo docentes', async () => {
  const { profe, clase } = await docenteConClase();
  assert.match(clase.codigo, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(clase.curso, 6);
  assert.equal((await profe('/api/clases', { nombre: 'X', curso: 7 })).estado, 400);
  assert.equal((await profe('/api/clases', { nombre: '', curso: 5 })).estado, 400);
  const { datos: lista } = await profe('/api/clases');
  assert.deepEqual(lista.map((c: any) => [c.codigo, c.alumnos]), [[clase.codigo, 0]]);
  assert.equal((await cliente()('/api/clases')).estado, 401);
  const alumno = await alumnoEn(clase.codigo);
  assert.equal((await alumno('/api/clases')).estado, 403);
  assert.equal((await profe('/api/clases')).datos[0].alumnos, 1);
});

test('alumno: registro con código en minúsculas y espacios; usuario sin distinguir mayúsculas', async () => {
  const { clase } = await docenteConClase();
  const codigo = clase.codigo.toLowerCase().replace(/^(...)/, '$1 ');
  const u = unico('Ana.G');
  const a = await alumnoEn(` ${codigo} `, u);
  assert.deepEqual((await a('/api/yo')).datos,
    { rol: 'alumno', nombre: 'Ana', usuario: u.toLowerCase(), clase: '6ºB', curso: 6, heroe: null, pendientes: [] });
  const r = await cliente()('/api/alumno/registro', { codigo: clase.codigo, nombre: 'Otra', usuario: u.toLowerCase(), clave: '1234' });
  assert.equal(r.estado, 409);
  assert.equal((await cliente()('/api/alumno/registro', { codigo: 'ZZZZZZ', nombre: 'A', usuario: unico('b'), clave: '1234' })).estado, 404);
  assert.equal((await cliente()('/api/alumno/registro', { codigo: clase.codigo, nombre: 'A', usuario: unico('c'), clave: '12' })).estado, 400);
  assert.equal((await cliente()('/api/alumno/registro', { codigo: clase.codigo, nombre: 'A', usuario: 'con espacio', clave: '1234' })).estado, 400);
});

test('entrar y salir', async () => {
  const { clase } = await docenteConClase();
  const u = unico('luis');
  await alumnoEn(clase.codigo, u);
  const a = cliente();
  assert.equal((await a('/api/entrar', { rol: 'alumno', usuario: u, clave: 'mala' })).estado, 401);
  assert.equal((await a('/api/entrar', { rol: 'docente', usuario: u, clave: '1234' })).estado, 401);
  assert.equal((await a('/api/entrar', { rol: 'alumno', usuario: u.toUpperCase(), clave: '1234' })).estado, 200);
  assert.equal((await a('/api/yo')).datos.nombre, 'Ana');
  await a('/api/salir', {});
  assert.equal((await a('/api/yo')).estado, 401);
});

test('héroe guardado en la cuenta y validado', async () => {
  const { clase } = await docenteConClase();
  const a = await alumnoEn(clase.codigo);
  assert.equal((await a('/api/yo/heroe', { skin: 'hacker', genero: 'chica' }, 'PUT')).estado, 400);
  assert.equal((await a('/api/yo/heroe', { skin: 'mago', genero: 'chica', extra: 1 }, 'PUT')).estado, 200);
  assert.deepEqual((await a('/api/yo')).datos.heroe, { skin: 'mago', genero: 'chica' });
});

test('curso efectivo: el curso propio manda sobre el de la clase', async () => {
  const { clase } = await docenteConClase(6);
  const u = unico('eva');
  const a = await alumnoEn(clase.codigo, u);
  db.prepare('UPDATE alumnos SET curso_propio = 4 WHERE usuario = ?').run(u);
  assert.equal((await a('/api/yo')).datos.curso, 4);
});

test('JSON roto → 400 con mensaje; ruta /api desconocida → 404 JSON', async () => {
  const r = await fetch(url + '/api/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{roto' });
  assert.equal(r.status, 400); assert.ok((await r.json()).error);
  assert.equal((await cliente()('/api/nada')).estado, 404);
});

test('respuestas: se guardan con datos de la batería; pendientes y repaso', async () => {
  const { clase } = await docenteConClase(5);
  const a = await alumnoEn(clase.codigo);
  const { datos: { id: partida } } = await a('/api/partidas', {});
  const q = bateria(5)[3];
  assert.equal((await a('/api/respuestas', { partida_id: partida, pregunta_id: 'c5-mat-00000000', correcta: true, ms: 10 })).estado, 400);
  assert.equal((await a('/api/respuestas', { partida_id: partida, pregunta_id: q.id, correcta: 'sí', ms: 10 })).estado, 400);
  assert.equal((await a('/api/respuestas', { partida_id: partida, pregunta_id: q.id, correcta: false, ms: 4200 })).estado, 200);
  assert.deepEqual((await a('/api/yo')).datos.pendientes, [q.id]);
  const fila = db.prepare('SELECT curso, materia, dificultad, texto, correcta, ms FROM respuestas WHERE pregunta_id = ? ORDER BY id DESC').get(q.id) as any;
  assert.deepEqual({ ...fila }, { curso: 5, materia: q.subject, dificultad: q.difficulty, texto: q.text, correcta: 0, ms: 4200 });
  await a('/api/respuestas', { partida_id: partida, pregunta_id: q.id, correcta: true, ms: null });
  assert.deepEqual((await a('/api/yo')).datos.pendientes, []);
});

test('no se responde ni se cierra la partida de otro', async () => {
  const { clase } = await docenteConClase();
  const a = await alumnoEn(clase.codigo), b = await alumnoEn(clase.codigo);
  const { datos: { id } } = await a('/api/partidas', {});
  assert.equal((await b('/api/respuestas', { partida_id: id, pregunta_id: bateria(5)[0].id, correcta: true, ms: 1 })).estado, 404);
  assert.equal((await b(`/api/partidas/${id}/fin`, { puntos: 10, nivel_heroe: 1, mapa: 1 })).estado, 404);
});

test('fin de partida una sola vez; ranking de la clase con la mejor de cada uno', async () => {
  const { clase } = await docenteConClase();
  const { clase: otra } = await docenteConClase();
  const a = await alumnoEn(clase.codigo), b = await alumnoEn(clase.codigo), c = await alumnoEn(otra.codigo);
  const jugar = async (cl: ReturnType<typeof cliente>, puntos: number) => {
    const { datos: { id } } = await cl('/api/partidas', {});
    return [id, await cl(`/api/partidas/${id}/fin`, { puntos, nivel_heroe: 3, mapa: 2 })] as const;
  };
  const [id1, r1] = await jugar(a, 500);
  assert.equal(r1.estado, 200);
  assert.equal((await a(`/api/partidas/${id1}/fin`, { puntos: 9999, nivel_heroe: 3, mapa: 2 })).estado, 409);
  await jugar(a, 900); await jugar(a, 100); await jugar(b, 700); await jugar(c, 5000);
  assert.equal((await a('/api/partidas/1/fin', { puntos: -5, nivel_heroe: 1, mapa: 1 })).estado, 400);
  const { datos: ranking } = await a('/api/ranking');
  assert.deepEqual(ranking.map((r: any) => [r.puntos, r.nivel]), [[900, 3], [700, 3]]);
});

test('alumnado: la cookie dura lo que el navegador abierto; docente: 180 días', async () => {
  const { clase } = await docenteConClase();
  const r = await fetch(url + '/api/alumno/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo: clase.codigo, nombre: 'A', usuario: unico('cookie'), clave: '1234' }) });
  assert.doesNotMatch(r.headers.get('set-cookie')!, /Max-Age/);
  const d = await fetch(url + '/api/docente/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invitacion: 'PROFE-2026', nombre: 'P', usuario: unico('cprofe'), clave: 'secreta' }) });
  assert.match(d.headers.get('set-cookie')!, /Max-Age=15552000/);
});

test('las sesiones caducan en el servidor: alumnado a las 8 horas, docentes a los 180 días', async () => {
  const { profe, clase } = await docenteConClase();
  const a = await alumnoEn(clase.codigo);
  db.exec("UPDATE sesiones SET creada = datetime('now', '-9 hours')");
  assert.equal((await a('/api/yo')).estado, 401);
  assert.equal((await profe('/api/yo')).estado, 200);
  db.exec("UPDATE sesiones SET creada = datetime('now', '-181 days')");
  assert.equal((await profe('/api/yo')).estado, 401);
});

test('sin cuerpo JSON → 400/401, nunca 500', async () => {
  const r = await fetch(url + '/api/entrar', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hola' });
  assert.equal(r.status, 401);
  const r2 = await fetch(url + '/api/alumno/registro', { method: 'POST' });
  assert.equal(r2.status, 404);
});

test('10 contraseñas mal seguidas bloquean ese usuario unos minutos', async () => {
  const { clase } = await docenteConClase();
  const u = unico('bloq');
  await alumnoEn(clase.codigo, u);
  const a = cliente();
  for (let i = 0; i < 10; i++) assert.equal((await a('/api/entrar', { rol: 'alumno', usuario: u, clave: 'mal' })).estado, 401);
  const r = await a('/api/entrar', { rol: 'alumno', usuario: u, clave: '1234' });
  assert.equal(r.estado, 429); assert.match(r.datos.error, /intentos/);
  const otro = unico('libre');
  await alumnoEn(clase.codigo, otro);
  assert.equal((await a('/api/entrar', { rol: 'alumno', usuario: otro, clave: '1234' })).estado, 200);
});

test('usuario con tilde escrita de dos formas (NFC/NFD) es el mismo', async () => {
  const { clase } = await docenteConClase();
  const u = `josé${++n}`;
  await alumnoEn(clase.codigo, u);
  const a = cliente();
  assert.equal((await a('/api/entrar', { rol: 'alumno', usuario: u.normalize('NFC'), clave: '1234' })).estado, 200);
});

test('dos altas a la vez con el mismo usuario: una entra y la otra recibe 409', async () => {
  const { clase } = await docenteConClase();
  const u = unico('gemelo');
  const alta = () => cliente()('/api/alumno/registro', { codigo: clase.codigo, nombre: 'G', usuario: u, clave: '1234' });
  const estados = (await Promise.all([alta(), alta()])).map(r => r.estado).sort();
  assert.deepEqual(estados, [200, 409]);
});

test('resumen de la clase: cifras, materias, alumnado y más falladas', async () => {
  const { profe, clase } = await docenteConClase(5);
  const ana = await alumnoEn(clase.codigo), luis = await alumnoEn(clase.codigo);
  await alumnoEn(clase.codigo); // sin jugar
  await responder(ana, [[0, false], [0, true], [1, true]]);
  await responder(luis, [[0, false], [2, false]]);
  const { estado, datos } = await profe(`/api/clases/${clase.id}`);
  assert.equal(estado, 200);
  assert.deepEqual(datos.clase, { id: clase.id, nombre: '6ºB', curso: 5, codigo: clase.codigo });
  assert.deepEqual([datos.total.respuestas, datos.total.aciertos, datos.total.aprendidas, datos.total.pendientes, datos.total.activos], [5, 2, 1, 2, 2]);
  assert.equal(datos.alumnos.length, 3);
  assert.ok(datos.alumnos.every((a: any) => a.curso === 5 && a.bajado === false));
  assert.equal(datos.masFalladas[0].pregunta_id, bateria(5)[0].id);
  assert.equal(datos.masFalladas[0].alumnos, 2);
  assert.ok(datos.materias.length >= 1);
});

test('clase vacía: todo a cero sin romper', async () => {
  const { profe, clase } = await docenteConClase();
  const { datos } = await profe(`/api/clases/${clase.id}`);
  assert.deepEqual([datos.total.respuestas, datos.total.acierto, datos.total.aprendizaje, datos.alumnos.length, datos.masFalladas.length, datos.materias.length], [0, null, null, 0, 0, 0]);
});

test('ficha del alumno con sus listas; otro docente no la ve (404)', async () => {
  const { profe, clase } = await docenteConClase(5);
  const u = unico('ficha');
  const a = await alumnoEn(clase.codigo, u);
  await responder(a, [[0, false], [0, true], [1, false]]);
  const alumnoId = (db.prepare('SELECT id FROM alumnos WHERE usuario = ?').get(u) as any).id;
  const { datos } = await profe(`/api/alumnos/${alumnoId}`);
  assert.deepEqual(datos.alumno, { id: alumnoId, nombre: 'Ana', usuario: u, curso: 5, cursoClase: 5, clase: { id: clase.id, nombre: '6ºB' } });
  assert.deepEqual(datos.aprendidas.map((p: any) => p.pregunta_id), [bateria(5)[0].id]);
  assert.deepEqual(datos.pendientes.map((p: any) => p.pregunta_id), [bateria(5)[1].id]);
  const { profe: otro } = await docenteConClase();
  assert.equal((await otro(`/api/alumnos/${alumnoId}`)).estado, 404);
  assert.equal((await otro(`/api/clases/${clase.id}`)).estado, 404);
  assert.equal((await a(`/api/clases/${clase.id}`)).estado, 403);
  assert.equal((await profe('/api/clases/abc')).estado, 404);
});

test('bajar y volver a subir el curso; límites', async () => {
  const { profe, clase } = await docenteConClase(6);
  const u = unico('baja');
  const a = await alumnoEn(clase.codigo, u);
  const id = (db.prepare('SELECT id FROM alumnos WHERE usuario = ?').get(u) as any).id;
  assert.equal((await profe(`/api/alumnos/${id}`, { curso: 5 }, 'PUT')).estado, 200);
  assert.equal((await a('/api/yo')).datos.curso, 5);
  assert.equal((await profe(`/api/clases/${clase.id}`)).datos.alumnos[0].bajado, true);
  for (const mal of [7, 2, 'cuatro']) assert.equal((await profe(`/api/alumnos/${id}`, { curso: mal }, 'PUT')).estado, 400);
  await profe(`/api/alumnos/${id}`, { curso: 6 }, 'PUT');
  assert.equal((db.prepare('SELECT curso_propio FROM alumnos WHERE id = ?').get(id) as any).curso_propio, null);
});

test('el docente pone una contraseña nueva', async () => {
  const { profe, clase } = await docenteConClase();
  const u = unico('olvido');
  await alumnoEn(clase.codigo, u);
  const id = (db.prepare('SELECT id FROM alumnos WHERE usuario = ?').get(u) as any).id;
  assert.equal((await profe(`/api/alumnos/${id}`, { clave: '12' }, 'PUT')).estado, 400);
  assert.equal((await profe(`/api/alumnos/${id}`, { clave: 'nueva1' }, 'PUT')).estado, 200);
  assert.equal((await cliente()('/api/entrar', { rol: 'alumno', usuario: u, clave: 'nueva1' })).estado, 200);
  assert.equal((await profe(`/api/alumnos/${id}`, {}, 'PUT')).estado, 400);
});

test('quitar a un alumno borra sus datos y su sesión; otro docente no puede', async () => {
  const { profe, clase } = await docenteConClase(5);
  const u = unico('fuera');
  const a = await alumnoEn(clase.codigo, u);
  await responder(a, [[0, false]]);
  const id = (db.prepare('SELECT id FROM alumnos WHERE usuario = ?').get(u) as any).id;
  const { profe: otro } = await docenteConClase();
  assert.equal((await otro(`/api/alumnos/${id}`, undefined, 'DELETE')).estado, 404);
  assert.equal((await profe(`/api/alumnos/${id}`, undefined, 'DELETE')).estado, 200);
  assert.equal((await a('/api/yo')).estado, 401);
  assert.equal((await profe(`/api/clases/${clase.id}`)).datos.total.respuestas, 0);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM respuestas WHERE alumno_id = ?').get(id) as any).n, 0);
});

test('con todas las baterías, de 6º se puede bajar hasta 3º y el alumno juega con las de ese curso', async () => {
  const { profe, clase } = await docenteConClase(6);
  const u = unico('a3');
  const a = await alumnoEn(clase.codigo, u);
  const id = (db.prepare('SELECT id FROM alumnos WHERE usuario = ?').get(u) as any).id;
  assert.deepEqual((await profe(`/api/alumnos/${id}`)).datos.cursosPosibles, [3, 4, 5, 6]);
  assert.equal((await profe(`/api/alumnos/${id}`, { curso: 3 }, 'PUT')).estado, 200);
  assert.equal((await a('/api/yo')).datos.curso, 3);
  const { id: partida } = (await a('/api/partidas', {})).datos;
  assert.equal((await a('/api/respuestas', { partida_id: partida, pregunta_id: bateria(3)[0].id, correcta: false, ms: 1 })).estado, 200);
  assert.equal((db.prepare('SELECT curso FROM respuestas WHERE alumno_id = ?').get(id) as any).curso, 3);
});

test('cambiar la contraseña cierra las sesiones abiertas del alumno', async () => {
  const { profe, clase } = await docenteConClase();
  const u = unico('sesion');
  const a = await alumnoEn(clase.codigo, u);
  const id = (db.prepare('SELECT id FROM alumnos WHERE usuario = ?').get(u) as any).id;
  await profe(`/api/alumnos/${id}`, { clave: 'otra12' }, 'PUT');
  assert.equal((await a('/api/yo')).estado, 401);
});
