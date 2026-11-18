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
