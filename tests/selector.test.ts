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
  const salidas = Array.from({ length: 6 }, () => s.elegir(MAT, 'explorer').id).filter(id => id === P);
  assert.ok(salidas.length <= 1, 'ya no vuelve por repaso: como mucho sale una vez, como cualquier otra');
});

test('una pendiente de otra materia no se cuela', () => {
  const P = bateria(5).find(q => q.subject === Subject.LANGUAGE)!.id;
  const s = new Selector(5, new Set([P]), primero);
  s.nuevoCombate();
  for (let i = 0; i < 6; i++) assert.equal(s.elegir(MAT, 'explorer').subject, MAT);
});

test('una pregunta ya acertada que luego se falla no vuelve a pendientes (como en el servidor)', () => {
  const P = bateria(5).find(q => q.subject === MAT && q.difficulty === 'explorer')!.id;
  const s = new Selector(5, new Set(), primero);
  s.nuevoCombate();
  s.apuntar(P, true);
  s.apuntar(P, false);
  for (let c = 0; c < 5; c++) { s.nuevoCombate(); for (let i = 0; i < 3; i++) s.elegir(MAT, 'explorer'); }
  assert.ok(!s.esPendiente(P));
});

test('materias del curso: 3º sin Inglés ni EF; los monstruos solo son débiles a materias que hay', async () => {
  const { monstruosPosibles } = await import('../services/preguntas.ts');
  assert.deepEqual(new Selector(3, new Set()).materias(), [Subject.MATH, Subject.LANGUAGE, Subject.KNOWLEDGE]);
  const P = [{ weakness: Subject.MATH }, { weakness: Subject.ENGLISH }, { weakness: Subject.PHYSICAL_ED }];
  assert.deepEqual(monstruosPosibles(P, 2, new Selector(3, new Set()).materias()), [0]);
  assert.deepEqual(monstruosPosibles(P, 2, new Selector(5, new Set()).materias()), [0, 1, 2]);
  assert.deepEqual(monstruosPosibles(P, 0, new Selector(5, new Set()).materias()), [0]); // mapa 1: sin Inglés ni EF
});

test('las opciones se barajan cada vez que sale la pregunta, sin perder la correcta', () => {
  let semilla = 7; // azar fijo (LCG) para que la prueba no dependa de la suerte
  const s = new Selector(3, new Set(), () => (semilla = (semilla * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const posiciones = new Map<string, Set<number>>();
  for (let i = 0; i < 200; i++) {
    const q = s.elegir(Subject.LANGUAGE, 'boss'); // 25 preguntas: cada una sale varias veces
    const original = bateria(3).find(o => o.id === q.id)!;
    assert.equal(q.options[q.correctIndex], original.options[original.correctIndex]);
    assert.deepEqual([...q.options].sort(), [...original.options].sort());
    posiciones.set(q.id, (posiciones.get(q.id) ?? new Set()).add(q.correctIndex));
  }
  assert.ok([...posiciones.values()].every(p => p.size > 1), 'una misma pregunta cambia de posición');
});
