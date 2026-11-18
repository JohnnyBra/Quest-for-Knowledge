# Fase 1 — Cuentas, clases con código y registro de respuestas (plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que Quest tenga cuentas (docente con invitación, alumnado con código de clase), clases de 3º a 6º, preguntas
del curso efectivo con repaso de lo fallado, cada respuesta guardada en SQLite y ranking por clase; el docente ya puede
crear clases y ver su código.

**Architecture:** el servidor pasa a `servidor/db.ts` (esquema `node:sqlite`) + `servidor/app.ts` (`crearApp(db,
opciones)`, todas las rutas `/api`), y `server.ts` solo los une con Vite o `dist/`. El cliente habla con el servidor por
`services/api.ts`; `services/preguntas.ts` (clase `Selector`, pura) elige preguntas; `services/cola.ts` + `services/partida.ts`
mandan respuestas sin perderlas si falla la red. Las baterías viven en `data/preguntas/` con identificadores por huella del
texto.

**Tech Stack:** React 19 + Vite, Express 5, `node:sqlite` (Node ≥ 22.13), `node:crypto` (scrypt), `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-19-clases-y-panel-design.md`

## Global Constraints

- **Sin el núcleo común** (`plataforma-cole-juegos`) y **sin dependencias nuevas**.
- SQLite con `node:sqlite`; archivo `quest.db` (ignorado por git), ruta `QUEST_DB`; invitación docente `QUEST_INVITACION`.
- Cursos 3, 4, 5, 6. Curso efectivo = `curso_propio ?? clase.curso`.
- Id de pregunta: `c<curso>-<materia>-<huella>`; materias `len`, `mat`, `cme`, `ing`, `efi`.
- Repaso: una de cada 3 preguntas pedidas es una pendiente de esa materia y dificultad que no haya salido en el combate
  actual ni en los 2 anteriores (vista en combate `v` → vuelve en el combate `v + 3` o después).
- Mensajes al usuario en español, en `{ error }`. Aspecto Gremio de Quest; «Creado por Javi Barrero» en entrada y panel.
- Commits en español con prefijo (`feat:`, `fix:`, `test:`, `docs:`) y las líneas de atribución de la sesión.

## Review Focus

1. Dos alumnos con «Ana.G» y «ana.g» → el segundo recibe 409 (usuarios en minúsculas). Test en Task 3.
2. Código de clase escrito en minúsculas o con espacios («k7m 2pq») → entra igual. Test en Task 3.
3. Sin red al responder → la respuesta espera en la cola y sale con la siguiente, en orden y sin duplicar. Test en Task 6.
4. «Salir» en mitad de partida y luego derrota → la partida se cierra una sola vez (409 la segunda). Test en Task 4.
5. Se acaba el tiempo en la 2ª pregunta del crítico → se registra esa pregunta, no la primera (la de ahora lee un cierre
   viejo). Se arregla con `preguntaRef` en Task 8 y se comprueba en el recorrido del navegador (Task 10).

---

### Task 1: Baterías por curso con identificador

**Files:**
- Move: `data/questions.ts` → `data/preguntas/c5.ts` (`git mv`), export renombrado a `C5`
- Create: `data/preguntas/c3.ts`, `c4.ts`, `c6.ts` (vacías hasta la fase 3), `data/preguntas/index.ts`
- Modify: `types.ts` (nada: `Question` sigue igual; el id va en `Pregunta`)
- Test: `tests/preguntas.test.ts`

**Interfaces:**
- Produces: `type Curso = 3 | 4 | 5 | 6`, `CURSOS`, `type Pregunta = Question & { id: string; curso: Curso }`,
  `huella(texto): string` (8 hex), `bateria(curso): Pregunta[]`, `preguntaPorId(id): Pregunta | undefined`.

- [ ] **Step 1: test que falla**

```ts
// tests/preguntas.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bateria, preguntaPorId, huella, CURSOS } from '../data/preguntas/index.ts';
import { Subject } from '../types.ts';

test('huella estable de 8 hex', () => {
  assert.equal(huella('hola'), huella('hola'));
  assert.match(huella('hola'), /^[0-9a-f]{8}$/);
  assert.notEqual(huella('hola'), huella('hola.'));
});

test('5º: 200 preguntas con el reparto por materia y dificultad', () => {
  const b = bateria(5);
  assert.equal(b.length, 200);
  const cuenta = (s: Subject, d: string) => b.filter(q => q.subject === s && q.difficulty === d).length;
  assert.deepEqual([cuenta(Subject.MATH, 'explorer'), cuenta(Subject.MATH, 'boss')], [30, 10]);
  for (const s of [Subject.LANGUAGE, Subject.KNOWLEDGE, Subject.ENGLISH, Subject.PHYSICAL_ED])
    assert.deepEqual([cuenta(s, 'explorer'), cuenta(s, 'boss')], [27, 13], s);
});

test('cada pregunta: 4 opciones, respuesta válida, id con curso y materia', () => {
  for (const c of CURSOS) for (const q of bateria(c)) {
    assert.equal(q.options.length, 4, q.text);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < 4, q.text);
    assert.match(q.id, /^c[3-6]-(len|mat|cme|ing|efi)-[0-9a-f]{8}$/);
  }
});

test('ids únicos en todas las baterías y se encuentran por id', () => {
  for (const c of CURSOS) { const v = bateria(c).map(q => q.id); assert.equal(new Set(v).size, v.length, `curso ${c}`); }
  const q = bateria(5)[7];
  assert.equal(preguntaPorId(q.id), q);
  assert.equal(preguntaPorId(q.id)?.curso, 5);
  assert.equal(preguntaPorId('c5-mat-00000000'), undefined);
});

test('mientras un curso no tiene batería, usa la de 5º', () => {
  assert.equal(bateria(3)[0].curso, 5);
});
```

- [ ] **Step 2:** `npx tsx --test tests/preguntas.test.ts` → FAIL (no existe `data/preguntas/index.ts`).

- [ ] **Step 3: implementación**

```bash
mkdir -p data/preguntas && git mv data/questions.ts data/preguntas/c5.ts
sed -i "s#from '../types'#from '../../types'#; s#export const STATIC_QUESTIONS#export const C5#" data/preguntas/c5.ts
for c in 3 4 6; do printf "import type { Question } from '../../types';\n\n// Se escribe en la fase 3 (200 preguntas, mismo reparto que 5º).\nexport const C$c: Question[] = [];\n" > data/preguntas/c$c.ts; done
```

```ts
// data/preguntas/index.ts
import { Subject, type Question } from '../../types';
import { C3 } from './c3';
import { C4 } from './c4';
import { C5 } from './c5';
import { C6 } from './c6';

export type Curso = 3 | 4 | 5 | 6;
export const CURSOS: Curso[] = [3, 4, 5, 6];
export type Pregunta = Question & { id: string; curso: Curso };

const MATERIA: Record<string, string> = {
  [Subject.LANGUAGE]: 'len', [Subject.MATH]: 'mat', [Subject.KNOWLEDGE]: 'cme', [Subject.ENGLISH]: 'ing', [Subject.PHYSICAL_ED]: 'efi',
};

// FNV-1a de 32 bits: misma huella en el navegador y en el servidor, sin dependencias.
export function huella(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

const conId = (curso: Curso, qs: Question[]): Pregunta[] =>
  qs.map(q => ({ ...q, curso, id: `c${curso}-${MATERIA[q.subject]}-${huella(q.text)}` }));

const BATERIAS: Record<Curso, Pregunta[]> = { 3: conId(3, C3), 4: conId(4, C4), 5: conId(5, C5), 6: conId(6, C6) };
const POR_ID = new Map(CURSOS.flatMap(c => BATERIAS[c].map(q => [q.id, q] as const)));

// ponytail: curso sin batería → la de 5º; se quita en la fase 3 cuando estén las de 3º, 4º y 6º.
export const bateria = (curso: Curso): Pregunta[] => (BATERIAS[curso].length ? BATERIAS[curso] : BATERIAS[5]);
export const preguntaPorId = (id: string): Pregunta | undefined => POR_ID.get(id);
```

- [ ] **Step 4:** actualiza el único importador: `services/geminiService.ts` cambia `import { STATIC_QUESTIONS } from '../data/questions'`
  por `import { C5 as STATIC_QUESTIONS } from '../data/preguntas/c5'` (se borra en Task 8). `npm test && npm run lint` → PASS.

- [ ] **Step 5: commit** `feat: baterías por curso con identificador de pregunta`

---

### Task 2: Selector de preguntas con repaso

**Files:**
- Create: `services/preguntas.ts`
- Test: `tests/selector.test.ts`

**Interfaces:**
- Consumes: `bateria`, `Curso`, `Pregunta` (Task 1).
- Produces: `class Selector { constructor(curso, pendientes: Set<string>, azar?); nuevoCombate(); elegir(materia: string,
  dificultad: 'explorer' | 'boss'): Pregunta; apuntar(id, correcta) }`, `let selector: Selector` (exportado, vivo),
  `configurarPreguntas(curso: Curso, pendientes: string[])`.

- [ ] **Step 1: test que falla**

```ts
// tests/selector.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Selector } from '../services/preguntas.ts';
import { bateria } from '../data/preguntas/index.ts';
import { Subject } from '../types.ts';

const MAT = Subject.MATH;
const primero = () => 0;

test('elige del curso, materia y dificultad pedidas, sin repetir hasta agotar', () => {
  const s = new Selector(5, new Set(), primero);
  s.nuevoCombate();
  const vistas = new Set<string>();
  for (let i = 0; i < 10; i++) {
    const q = s.elegir(MAT, 'boss');
    assert.equal(q.subject, MAT); assert.equal(q.difficulty, 'boss'); assert.equal(q.curso, 5);
    assert.ok(!vistas.has(q.id)); vistas.add(q.id);
  }
  assert.ok(s.elegir(MAT, 'boss')); // agotadas: vuelve a empezar sin romper
});

test('repaso: la 3ª pregunta es una pendiente; no vuelve hasta 3 combates después', () => {
  const P = bateria(5).find(q => q.subject === MAT && q.difficulty === 'explorer')!.id;
  const s = new Selector(5, new Set([P]), primero);
  s.nuevoCombate();                                  // combate 1
  assert.notEqual(s.elegir(MAT, 'explorer').id, P);  // 1ª
  assert.notEqual(s.elegir(MAT, 'explorer').id, P);  // 2ª
  assert.equal(s.elegir(MAT, 'explorer').id, P);     // 3ª → repaso
  s.apuntar(P, false);                               // la vuelve a fallar
  for (let c = 2; c <= 3; c++) {                     // combates 2 y 3: no sale
    s.nuevoCombate();
    for (let i = 0; i < 3; i++) assert.notEqual(s.elegir(MAT, 'explorer').id, P, `combate ${c}`);
  }
  s.nuevoCombate();                                  // combate 4: pedidas 10, 11, 12 → la 12ª es repaso
  s.elegir(MAT, 'explorer'); s.elegir(MAT, 'explorer');
  assert.equal(s.elegir(MAT, 'explorer').id, P);
});

test('acertar una pendiente la quita del repaso', () => {
  const P = bateria(5).find(q => q.subject === MAT && q.difficulty === 'explorer')!.id;
  const s = new Selector(5, new Set([P]), primero);
  s.nuevoCombate();
  s.apuntar(P, true);
  for (let i = 0; i < 6; i++) assert.notEqual(s.elegir(MAT, 'explorer').id, P);
});

test('una pendiente de otra materia no se cuela', () => {
  const P = bateria(5).find(q => q.subject === Subject.LANGUAGE)!.id;
  const s = new Selector(5, new Set([P]), primero);
  s.nuevoCombate();
  for (let i = 0; i < 6; i++) assert.equal(s.elegir(MAT, 'explorer').subject, MAT);
});
```

- [ ] **Step 2:** `npx tsx --test tests/selector.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: implementación**

```ts
// services/preguntas.ts
import { bateria, type Curso, type Pregunta } from '../data/preguntas/index';

type Dificultad = 'explorer' | 'boss';

// Elige preguntas del curso efectivo. Las pendientes (falladas y aún no acertadas) solo salen por el repaso:
// una de cada 3 preguntas pedidas, si hay alguna de esa materia y dificultad vista hace 3 combates o más.
export class Selector {
  private combate = 0;
  private pedidas = 0;
  private vistas = new Map<string, number>(); // id → combate en que salió

  constructor(private curso: Curso, private pendientes: Set<string>, private azar: () => number = Math.random) {}

  nuevoCombate() { this.combate++; }

  elegir(materia: string, dificultad: Dificultad): Pregunta {
    const todas = bateria(this.curso).filter(q => q.subject === materia && q.difficulty === dificultad);
    const repaso = todas.filter(q => this.pendientes.has(q.id) && (this.vistas.get(q.id) ?? -Infinity) <= this.combate - 3);
    const nuevas = todas.filter(q => !this.pendientes.has(q.id) && !this.vistas.has(q.id));
    this.pedidas++;
    const grupo = this.pedidas % 3 === 0 && repaso.length ? repaso
      : nuevas.length ? nuevas
      : todas.filter(q => !this.pendientes.has(q.id)).length ? todas.filter(q => !this.pendientes.has(q.id))
      : todas;
    const q = grupo[Math.floor(this.azar() * grupo.length)];
    this.vistas.set(q.id, this.combate);
    return q;
  }

  apuntar(id: string, correcta: boolean) {
    if (correcta) this.pendientes.delete(id); else this.pendientes.add(id);
  }
}

export let selector = new Selector(5, new Set());
export function configurarPreguntas(curso: Curso, pendientes: string[]) {
  selector = new Selector(curso, new Set(pendientes));
}
```

- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: commit** `feat: selector de preguntas por curso con repaso de las falladas`

---

### Task 3: Base de datos, cuentas y clases

**Files:**
- Create: `servidor/db.ts`, `servidor/app.ts`
- Modify: `heroes.ts` (quitar `cargarHeroe`/`guardarHeroe`/`almacen`/`clave`/`Almacen`; añadir `esHeroeValido`),
  `tests/heroes.test.ts` (sustituir el test de localStorage)
- Test: `tests/servidor.test.ts`

**Interfaces:**
- Produces: `abrirDb(ruta: string): Db` (`Db = DatabaseSync`); `crearApp(db: Db, opciones?: { invitacion?: string }):
  express.Express`; `esHeroeValido(h: unknown): h is HeroChoice`.
- Rutas de esta tarea: `POST /api/docente/registro`, `POST /api/alumno/registro`, `POST /api/entrar`, `POST /api/salir`,
  `GET /api/yo`, `PUT /api/yo/heroe`, `GET /api/clases`, `POST /api/clases`, `GET /api/salud`.
- `GET /api/yo` alumno → `{ rol: 'alumno', nombre, usuario, clase, curso, heroe: HeroChoice | null, pendientes: string[] }`;
  docente → `{ rol: 'docente', nombre, usuario }`.
- `GET /api/clases` → `[{ id, nombre, curso, codigo, alumnos }]`; `POST /api/clases` → `{ id, nombre, curso, codigo, alumnos: 0 }`.

- [ ] **Step 1: tests que fallan**

```ts
// tests/servidor.test.ts
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { abrirDb, type Db } from '../servidor/db.ts';
import { crearApp } from '../servidor/app.ts';

let db: Db, srv: Server, url = '';
before(async () => {
  db = abrirDb(':memory:');
  srv = crearApp(db, { invitacion: 'PROFE-2026' }).listen(0);
  await once(srv, 'listening');
  url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
});
after(() => srv.close());

// Un «navegador» con su cookie.
export function cliente() {
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
```

En `tests/heroes.test.ts` sustituye el import de `cargarHeroe, guardarHeroe` por `esHeroeValido` y el último test por:

```ts
test('héroe válido: skin conocida y género chico/chica', () => {
  assert.ok(esHeroeValido({ skin: 'mago', genero: 'chica' }));
  assert.ok(!esHeroeValido({ skin: 'hacker', genero: 'chica' }));
  assert.ok(!esHeroeValido({ skin: 'mago', genero: 'x' }));
  assert.ok(!esHeroeValido(null));
});
```

- [ ] **Step 2:** `npm test` → FAIL (no existen `servidor/db.ts`, `servidor/app.ts`, `esHeroeValido`).

- [ ] **Step 3: implementación**

```ts
// servidor/db.ts
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

export function abrirDb(ruta: string): Db {
  const db = new DatabaseSync(ruta);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS docentes (
      id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, usuario TEXT NOT NULL UNIQUE, clave TEXT NOT NULL,
      creado TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS clases (
      id INTEGER PRIMARY KEY, docente_id INTEGER NOT NULL REFERENCES docentes(id), nombre TEXT NOT NULL,
      curso INTEGER NOT NULL CHECK (curso BETWEEN 3 AND 6), codigo TEXT NOT NULL UNIQUE,
      creada TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS alumnos (
      id INTEGER PRIMARY KEY, clase_id INTEGER NOT NULL REFERENCES clases(id) ON DELETE CASCADE, nombre TEXT NOT NULL,
      usuario TEXT NOT NULL UNIQUE, clave TEXT NOT NULL, curso_propio INTEGER CHECK (curso_propio BETWEEN 3 AND 6),
      heroe TEXT, creado TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS sesiones (
      token TEXT PRIMARY KEY, rol TEXT NOT NULL CHECK (rol IN ('docente', 'alumno')), usuario_id INTEGER NOT NULL,
      creada TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS partidas (
      id INTEGER PRIMARY KEY, alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
      inicio TEXT NOT NULL DEFAULT (datetime('now')), fin TEXT, puntos INTEGER, nivel_heroe INTEGER, mapa INTEGER);
    CREATE TABLE IF NOT EXISTS respuestas (
      id INTEGER PRIMARY KEY, alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
      partida_id INTEGER NOT NULL REFERENCES partidas(id) ON DELETE CASCADE, pregunta_id TEXT NOT NULL,
      curso INTEGER NOT NULL, materia TEXT NOT NULL, dificultad TEXT NOT NULL, texto TEXT NOT NULL,
      correcta INTEGER NOT NULL, ms INTEGER, fecha TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')));
    CREATE INDEX IF NOT EXISTS respuestas_alumno ON respuestas(alumno_id, pregunta_id);
  `);
  return db;
}
```

```ts
// servidor/app.ts
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
```

Express 5 pasa al manejador de errores lo que lanzan las rutas síncronas, así que `exigir` basta. `heroes.ts`: borra
`Almacen`, `clave`, `almacen`, `cargarHeroe`, `guardarHeroe` y añade:

```ts
export const esHeroeValido = (h: unknown): h is HeroChoice =>
  !!h && SKINS.some(s => s.id === (h as HeroChoice).skin) && ((h as HeroChoice).genero === 'chico' || (h as HeroChoice).genero === 'chica');
```

`App.tsx` aún importa `cargarHeroe`/`guardarHeroe`: para no dejar el lint roto hasta Task 7, en `handleLogin` usa
`const guardado = null as HeroChoice | null;` y en `elegirHeroe` quita la línea `guardarHeroe(...)` (Task 7 lo sustituye
por la llamada al servidor).

- [ ] **Step 4:** `npm test && npm run lint` → PASS.
- [ ] **Step 5: commit** `feat: servidor con SQLite, cuentas de docente y alumnado y clases con código`

---

### Task 4: Partidas, respuestas y ranking de la clase

**Files:**
- Modify: `servidor/app.ts` (sustituye el comentario de Task 4)
- Test: `tests/servidor.test.ts` (añadir)

**Interfaces:**
- Consumes: `preguntaPorId` (Task 1), `entero`, `exigir`, `solo` (Task 3).
- Produces: `POST /api/partidas` → `{ id }`; `POST /api/partidas/:id/fin` `{ puntos, nivel_heroe, mapa }` → `{ ok }`
  (404 si no es suya, 409 si ya estaba cerrada); `POST /api/respuestas` `{ partida_id, pregunta_id, correcta, ms }` →
  `{ ok }`; `GET /api/ranking` → `[{ nombre, puntos, nivel }]` (mejor partida de cada alumno de su clase).

- [ ] **Step 1: tests que fallan** (añadir a `tests/servidor.test.ts`; import `bateria` de `../data/preguntas/index.ts`)

```ts
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
```

- [ ] **Step 2:** `npm test` → FAIL (404 en las rutas nuevas).

- [ ] **Step 3: implementación** (en `servidor/app.ts`; añade `import { preguntaPorId } from '../data/preguntas/index.ts';`)

```ts
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
```

- [ ] **Step 4:** `npm test && npm run lint` → PASS.
- [ ] **Step 5: commit** `feat: partidas, respuestas y ranking por clase en el servidor`

---

### Task 5: Arranque del servidor

**Files:**
- Modify: `server.ts` (reescribir), `package.json` (`start`, `tsx` a `dependencies`), `.gitignore`, `CLAUDE.md`

- [ ] **Step 1:** `server.ts`:

```ts
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { abrirDb } from './servidor/db.ts';
import { crearApp } from './servidor/app.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* sin .env: valores por defecto */ }

const PORT = Number(process.env.PORT ?? 3030);
const app = crearApp(abrirDb(process.env.QUEST_DB ?? path.join(__dirname, 'quest.db')), { invitacion: process.env.QUEST_INVITACION });

if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
}

app.listen(PORT, '0.0.0.0', () => console.log(`Quest en http://0.0.0.0:${PORT}`));
```

Ojo: `crearApp` ya montó el 404 de `/api` y el manejador de errores antes que Vite/estáticos; está bien (solo afecta a
`/api`). `package.json`: `"start": "tsx server.ts"`, mueve `"tsx"` de `devDependencies` a `dependencies` (el servidor
importa las baterías, que usan `enum`, y el modo de Node de quitar tipos no los admite). `.gitignore`: añade
`quest.db*` y `.env`. `CLAUDE.md`: sustituye la sección «Leaderboard / persistence» por un resumen de `servidor/`,
`QUEST_DB`, `QUEST_INVITACION` y las rutas.

- [ ] **Step 2:** `QUEST_INVITACION=prueba npm run dev &`, luego `curl -s localhost:3030/api/salud` → `{"ok":true}` y
  `curl -s localhost:3030/` devuelve el HTML. Para el proceso. `npm test && npm run lint` → PASS.
- [ ] **Step 3: commit** `feat: arranque del servidor con quest.db e invitación de docente`

---

### Task 6: Cliente: API, cola de respuestas y partida

**Files:**
- Create: `services/api.ts`, `services/cola.ts`, `services/partida.ts`
- Test: `tests/cola.test.ts`

**Interfaces:**
- Produces: `api<T>(ruta, cuerpo?, metodo?): Promise<T>` (lanza `ErrorApi { estado }`; sin red → estado 0);
  `type Yo`; `crearCola(enviar: (x: T) => Promise<unknown>): { poner(x: T): Promise<void>; vaciar(): Promise<void>; pendientes(): number }`;
  `empezarPartida(): Promise<void>`, `enviarRespuesta(pregunta_id, correcta, ms): void`,
  `terminarPartida(d: { puntos; nivel_heroe; mapa }): Promise<void>`.

- [ ] **Step 1: test que falla**

```ts
// tests/cola.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCola } from '../services/cola.ts';
import { ErrorApi } from '../services/api.ts';

test('sin red: espera y sale con el siguiente envío, en orden', async () => {
  const enviados: number[] = []; let red = false;
  const cola = crearCola<number>(async x => { if (!red) throw new ErrorApi('sin red', 0); enviados.push(x); });
  await cola.poner(1); await cola.poner(2);
  assert.deepEqual(enviados, []); assert.equal(cola.pendientes(), 2);
  red = true; await cola.poner(3);
  assert.deepEqual(enviados, [1, 2, 3]); assert.equal(cola.pendientes(), 0);
});

test('un rechazo del servidor (4xx) se descarta y no atasca la cola', async () => {
  const enviados: number[] = [];
  const cola = crearCola<number>(async x => { if (x === 1) throw new ErrorApi('mala', 400); enviados.push(x); });
  await cola.poner(1); await cola.poner(2);
  assert.deepEqual(enviados, [2]);
});

test('dos envíos a la vez no duplican', async () => {
  const enviados: number[] = [];
  const cola = crearCola<number>(async x => { await new Promise(r => setTimeout(r, 5)); enviados.push(x); });
  await Promise.all([cola.poner(1), cola.poner(2)]);
  assert.deepEqual(enviados, [1, 2]);
});
```

- [ ] **Step 2:** `npx tsx --test tests/cola.test.ts` → FAIL.

- [ ] **Step 3: implementación**

```ts
// services/api.ts
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
```

```ts
// services/cola.ts
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
    poner: async (x: T) => { cola.push(x); await enCurso; await vaciar(); },
    vaciar,
    pendientes: () => cola.length,
  };
}
```

```ts
// services/partida.ts
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
```

- [ ] **Step 4:** `npm test && npm run lint` → PASS.
- [ ] **Step 5: commit** `feat: cliente de la API y cola de respuestas que aguanta cortes de red`

---

### Task 7: Entrada con cuenta, héroe en la cuenta, curso y ranking de la clase

**Files:**
- Modify: `components/LoginScreen.tsx` (reescribir), `App.tsx`, `components/Leaderboard.tsx`, `data/narrative.ts`,
  `public/quest.css` (pestañas)

**Interfaces:**
- Consumes: `api`, `Yo` (Task 6), `configurarPreguntas` (Task 2), `empezarPartida`, `terminarPartida` (Task 6).
- Produces: `LoginScreen({ onEntrar: (yo: Yo) => void })`; `narrativa(clase: string, curso: number): { PROLOGUE; MISSION }`.

- [ ] **Step 1: `LoginScreen.tsx`.** Mantén la cabecera, el escenario con los 4 héroes y el pie «Creado por Javi
  Barrero». El formulario cambia:

```tsx
type Modo = 'entrar' | 'registro' | 'docente' | 'docente-registro';
const CAMPOS: Record<Modo, Array<'codigo' | 'invitacion' | 'nombre' | 'usuario' | 'clave'>> = {
  entrar: ['usuario', 'clave'],
  registro: ['codigo', 'nombre', 'usuario', 'clave'],
  docente: ['usuario', 'clave'],
  'docente-registro': ['invitacion', 'nombre', 'usuario', 'clave'],
};
const ETIQUETA = { codigo: 'Código de la clase', invitacion: 'Código de invitación', nombre: 'Tu nombre', usuario: 'Usuario', clave: 'Contraseña' };
const TITULO: Record<Modo, string> = { entrar: 'Identifícate, héroe', registro: 'Únete a tu clase', docente: 'Entrada del maestro', 'docente-registro': 'Alta de docente' };

export default function LoginScreen({ onEntrar }: { onEntrar: (yo: Yo) => void }) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [datos, setDatos] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const docente = modo === 'docente' || modo === 'docente-registro';

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const falta = CAMPOS[modo].find(c => !datos[c]?.trim());
    if (falta) return setError(`Falta: ${ETIQUETA[falta].toLowerCase()}.`);
    setEnviando(true); setError('');
    try {
      const ruta = modo === 'registro' ? '/api/alumno/registro' : modo === 'docente-registro' ? '/api/docente/registro' : '/api/entrar';
      await api(ruta, { ...datos, rol: docente ? 'docente' : 'alumno' });
      onEntrar(await api<Yo>('/api/yo'));
    } catch (err) { setError((err as Error).message); } finally { setEnviando(false); }
  };
  const cambiar = (m: Modo) => { setModo(m); setError(''); };
  // …JSX…
}
```

  JSX del formulario (dentro del `<form className="panel …">` actual, sustituyendo el campo de nombre):
  - Arriba, si `!docente`: `<div className="pestanas" role="tablist">` con dos `<button type="button" role="tab"
    aria-selected={modo === 'entrar'}>` «Entrar» y «Tengo un código de clase».
  - `<h2 className="panel-titulo">{TITULO[modo]}</h2>` y una línea en `--tenue`: alumno entrar «Escribe tu usuario y tu
    contraseña.», registro «Tu maestro o maestra te dará el código de la clase. Solo se hace una vez.»
  - Un `<label className="flex flex-col gap-2 font-semibold">` + `<input className="campo">` por cada campo de
    `CAMPOS[modo]`, con `name`, `autoComplete` (`username` / `current-password` o `new-password` en los registros /
    `off`), `type="password"` en `clave`, `autoCapitalize="characters"` en `codigo`, `spellCheck={false}`; el primero con
    el `autoFocus` condicional de ahora.
  - `<p role="alert" …>{error}</p>` como ahora; botón `btn-oro` con texto «Entrar» / «Crear mi cuenta» y
    `disabled={enviando}`.
  - Abajo, `creditos` centrado como ahora y un botón de texto (`className="enlace"`): si `!docente` «Soy docente» →
    `cambiar('docente')`; si `docente`, «¿Primera vez? Darme de alta» ↔ «Ya tengo cuenta» y «Volver al alumnado» →
    `cambiar('entrar')`.

  CSS en `public/quest.css` (junto a `.campo`):

```css
.pestanas { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 5px; border-radius: 12px; background: rgba(0, 0, 0, 0.3); border: 1px solid var(--borde); }
.pestanas button { padding: 10px 8px; border-radius: 8px; font-weight: 700; color: var(--tenue); }
.pestanas button[aria-selected="true"] { background: linear-gradient(var(--dorado-claro), var(--dorado)); color: #2a1a00; }
.pestanas button:focus-visible, .enlace:focus-visible { outline: 2px solid var(--runa); outline-offset: 2px; }
.enlace { color: var(--runa-clara); text-decoration: underline; text-underline-offset: 3px; font-weight: 600; }
```

- [ ] **Step 2: `App.tsx`.**
  - Imports: quita `cargarHeroe, guardarHeroe`; añade `api, type Yo` de `./services/api`, `configurarPreguntas` de
    `./services/preguntas`, `empezarPartida, terminarPartida` de `./services/partida`, `narrativa` de `./data/narrative`,
    `PanelProfe` de `./components/PanelProfe` (Task 9; hasta entonces no lo importes).
  - Estado: `const [yo, setYo] = useState<Yo | null | undefined>(undefined);` y al montar:
    `useEffect(() => { api<Yo>('/api/yo').then(alEntrar).catch(() => setYo(null)); }, []);`
  - Sustituye `handleLogin` por:

```tsx
  const alEntrar = (y: Yo) => {
    setYo(y);
    if (y.rol !== 'alumno') return;
    configurarPreguntas(y.curso, y.pendientes);
    setPlayer(prev => ({ ...prev, name: y.nombre, hero: y.heroe ?? prev.hero }));
    setIsLoggedIn(true);
    setGameState(y.heroe ? GameState.START_SCREEN : GameState.HERO_SELECT);
  };
  const salir = async () => { await api('/api/salir', {}).catch(() => {}); window.location.reload(); };
```

  - `elegirHeroe`: en lugar de `guardarHeroe(...)`, `api('/api/yo/heroe', hero, 'PUT').catch(() => showNotification('No se ha podido guardar el héroe.'));`
  - `saveScore`: sustituye el `fetch('/api/score', …)` (y su try/catch) por
    `await terminarPartida({ puntos: finalScore, nivel_heroe: finalPlayer.level, mapa: currentLevelIndex + 1 });`
  - `startGame`: primera línea `void empezarPartida();`
  - Render: antes de `if (!isLoggedIn)`:

```tsx
  if (yo === undefined) return <div className="min-h-screen"><Fondo /></div>;
  if (yo?.rol === 'docente') return <div className="min-h-screen"><Fondo /><p className="capa p-10">Panel del profe (Task 9)</p></div>;
  if (!isLoggedIn) return <LoginScreen onEntrar={alEntrar} />;
```

  - Portada: «Repaso de 5º» → `Repaso de {yo?.rol === 'alumno' ? yo.curso : 5}º`; añade un tercer botón en la rejilla
    (pasa a `grid-cols-3` en `md`, `grid-cols-1` en móvil): `<button className="btn-cuero" onClick={salir}>Salir</button>`.
  - Narrativa: `NARRATIVE.PROLOGUE` / `NARRATIVE.MISSION` → `textos.PROLOGUE` / `textos.MISSION` con
    `const textos = narrativa(yo?.rol === 'alumno' ? yo.clase : '5ºB', yo?.rol === 'alumno' ? yo.curso : 5);`

- [ ] **Step 3: `data/narrative.ts`.** `export const narrativa = (clase: string, curso: number) => ({ PROLOGUE: …, MISSION: … })`
  con `ventanas de ${clase}` y `alumnos de ${curso}º de Primaria` en lugar de «5ºB» y «5º».

- [ ] **Step 4: `Leaderboard.tsx`.** `fetch('/api/leaderboard')…` → `api<Score[]>('/api/ranking').then(setScores)`;
  `interface Score { nombre: string; puntos: number; nivel: number }`; en la lista `s.nombre`, `Nivel {s.nivel}`,
  `s.puntos.toLocaleString('es-ES')`; título «Salón de los héroes de la clase».

- [ ] **Step 5:** `npm test && npm run lint` → PASS. Recorrido rápido en el navegador: crear docente y clase por `curl`,
  registrarse como alumno, elegir héroe, recargar (entra solo y con el mismo héroe), Salir.
- [ ] **Step 6: commit** `feat: entrada con cuenta, héroe guardado en la cuenta y ranking de la clase`

---

### Task 8: El combate usa el selector y guarda cada respuesta

**Files:**
- Modify: `components/Battle.tsx`
- Delete: `services/geminiService.ts`; en `CLAUDE.md` la fila de `geminiService.ts` pasa a `services/preguntas.ts`

- [ ] **Step 1:** en `Battle.tsx`:

```tsx
import { selector } from '../services/preguntas';
import { enviarRespuesta } from '../services/partida';
import type { Pregunta } from '../data/preguntas/index';
```

  - Estados `question` y `criticalQuestion`: tipo `Pregunta | null`.
  - Refs y ayuda (tras los estados):

```tsx
  // El temporizador llama a handleAnswer desde un cierre viejo: la pregunta en pantalla se lee de aquí.
  const preguntaRef = useRef<Pregunta | null>(null);
  const inicioRef = useRef(0);
  const respondidaRef = useRef(false);
  const mostrar = (q: Pregunta) => { preguntaRef.current = q; inicioRef.current = Date.now(); respondidaRef.current = false; setQuestion(q); };
  useEffect(() => { selector.nuevoCombate(); }, []);
```

  - `handleSubjectSelect`: `const q = selector.elegir(subject, enemy.isBoss ? 'boss' : 'explorer');` y `mostrar(q)` en
    lugar de `setQuestion(q)`; `q2` igual con `selector.elegir(...)` y `setCriticalQuestion(q2)`. Deja de ser `async` y
    quita el `try/catch` (ya no hay red en medio).
  - `handleAnswer`, al principio:

```tsx
    const question = preguntaRef.current;
    if (!question || respondidaRef.current) return;
    respondidaRef.current = true;
    const correcta = !isTimeout && index === question.correctIndex;
    selector.apuntar(question.id, correcta);
    enviarRespuesta(question.id, correcta, Date.now() - inicioRef.current);
```

    y usa `correcta` en el `if`. En el paso al crítico, `setQuestion(criticalQuestion)` → `mostrar(criticalQuestion!)`.

- [ ] **Step 2:** `git rm services/geminiService.ts`; `npm test && npm run lint` → PASS.
- [ ] **Step 3:** navegador: un combate respondiendo una bien y otra mal, y otra dejando agotar el tiempo →
  `node -e` contra `quest.db` (`SELECT pregunta_id, correcta, ms FROM respuestas`) muestra las tres con su resultado.
- [ ] **Step 4: commit** `feat: el combate elige por curso con repaso y guarda cada respuesta`

---

### Task 9: Panel del profe: mis clases

**Files:**
- Create: `components/PanelProfe.tsx`
- Modify: `App.tsx` (sustituye el marcador de Task 7 por `<PanelProfe nombre={yo.nombre} onSalir={salir} />`)

- [ ] **Step 1:** componente:

```tsx
import React, { useEffect, useState } from 'react';
import { Estandarte, Fondo } from './RetroUI';
import { api } from '../services/api';

interface Clase { id: number; nombre: string; curso: number; codigo: string; alumnos: number }

export default function PanelProfe({ nombre, onSalir }: { nombre: string; onSalir: () => void }) {
  const [clases, setClases] = useState<Clase[] | null>(null);
  const [nueva, setNueva] = useState({ nombre: '', curso: 5 });
  const [error, setError] = useState('');

  useEffect(() => { api<Clase[]>('/api/clases').then(setClases).catch(e => setError(e.message)); }, []);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try { const c = await api<Clase>('/api/clases', nueva); setClases(cs => [...(cs ?? []), c]); setNueva({ nombre: '', curso: nueva.curso }); }
    catch (err) { setError((err as Error).message); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Fondo />
      <header className="cabecera capa">
        <h1>Quest for Knowledge</h1>
        <Estandarte />
        <span className="creditos text-right">Creado por Javi Barrero</span>
      </header>
      <main className="capa w-full max-w-5xl mx-auto px-4 pt-24 pb-10 flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="m-0 text-sm uppercase tracking-[0.2em]" style={{ color: 'var(--runa-clara)' }}>Panel del maestro</p>
            <h2 className="m-0 text-[clamp(1.8rem,4vw,2.6rem)]" style={{ color: 'var(--dorado)' }}>Hola, {nombre}</h2>
          </div>
          <button className="btn-cuero" onClick={onSalir}>Salir</button>
        </div>

        <section className="panel">
          <h3 className="panel-titulo">Mis clases</h3>
          {clases === null ? <p style={{ color: 'var(--tenue)' }}>Cargando…</p>
            : clases.length === 0 ? <p style={{ color: 'var(--tenue)' }}>Aún no tienes clases. Crea la primera aquí abajo.</p>
            : <ul className="m-0 p-0 list-none grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clases.map(c => (
                  <li key={c.id} className="ficha flex flex-col gap-1">
                    <span className="titulo text-xl" style={{ color: 'var(--dorado-claro)' }}>{c.nombre}</span>
                    <span style={{ color: 'var(--tenue)' }}>{c.curso}º de Primaria · {c.alumnos} {c.alumnos === 1 ? 'alumno' : 'alumnos'}</span>
                    <span className="text-sm mt-2" style={{ color: 'var(--tenue)' }}>Código para entrar</span>
                    <span className="titulo text-3xl tracking-[0.25em] select-all" style={{ color: 'var(--dorado)' }}>{c.codigo}</span>
                  </li>
                ))}
              </ul>}
        </section>

        <form className="panel flex flex-col sm:flex-row gap-3 sm:items-end" onSubmit={crear}>
          <label className="flex flex-col gap-2 font-semibold flex-1">Nombre de la clase
            <input className="campo" value={nueva.nombre} maxLength={40} placeholder="Por ejemplo: 6ºB…" onChange={e => setNueva({ ...nueva, nombre: e.target.value })} />
          </label>
          <label className="flex flex-col gap-2 font-semibold">Curso
            <select className="campo" value={nueva.curso} onChange={e => setNueva({ ...nueva, curso: Number(e.target.value) })}>
              {[3, 4, 5, 6].map(c => <option key={c} value={c}>{c}º de Primaria</option>)}
            </select>
          </label>
          <button className="btn-oro" type="submit">Crear clase</button>
        </form>
        <p role="alert" className="min-h-[1.4rem] font-bold" style={{ color: '#ff9aa6' }}>{error}</p>
      </main>
    </div>
  );
}
```

- [ ] **Step 2:** `npm run lint` → PASS; navegador: alta de docente con la invitación, crear «6ºB» de 6º, ver el código;
  captura de escritorio y de móvil (390 px) para comparar con la entrada; ajustar si algo desentona.
- [ ] **Step 3: commit** `feat: panel del maestro con sus clases y sus códigos`

---

### Task 10: VPS, documentación y recorrido completo

**Files:**
- Modify: `scripts/quest-vps.sh`, `CLAUDE.md`, `README.md`, spec (nota «Fase 1 hecha»)

- [ ] **Step 1: `quest-vps.sh`.** En `actualizar`, tras la copia de `db.json`:

```bash
  if [[ -f quest.db ]]; then
    local copia_db="copias/quest-$(date +%F-%H%M).db"
    node -e "new (require('node:sqlite').DatabaseSync)('quest.db').exec(\"VACUUM INTO '$copia_db'\")"
    echo "  ✔ Copia de la base de datos: $copia_db"
  fi
  grep -q '^QUEST_INVITACION=' .env 2>/dev/null || echo "  ⚠ Falta QUEST_INVITACION en .env: nadie podrá darse de alta como docente"
```

  y cambia las dos comprobaciones `curl … /api/leaderboard` por `/api/salud`.
- [ ] **Step 2: recorrido completo en el navegador** (Brave + playwright-core, ver memoria de verificación): docente se da
  de alta y crea una clase de 6º; alumna se registra con el código en minúsculas, elige héroe, juega un combate
  (acierto, fallo, tiempo agotado en la 2ª del crítico si sale); salir y volver a entrar (héroe y pendientes vienen del
  servidor); ranking de la clase; móvil 390 px sin desbordes. Revisar en `quest.db` que las respuestas guardadas
  coinciden con lo jugado.
- [ ] **Step 3:** `CLAUDE.md` y `README.md`: cuentas, `.env` (`QUEST_INVITACION`, `QUEST_DB`), `servidor/`, baterías,
  repaso. Spec: «Fase 1 hecha (fecha)».
- [ ] **Step 4: commit** `docs: fase 1 hecha; copia de quest.db al actualizar en el VPS`
