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

test('ids únicos por curso y se encuentran por id', () => {
  for (const c of CURSOS) { const v = bateria(c).map(q => q.id); assert.equal(new Set(v).size, v.length, `curso ${c}`); }
  const q = bateria(5)[7];
  assert.equal(preguntaPorId(q.id), q);
  assert.equal(preguntaPorId(q.id)?.curso, 5);
  assert.equal(preguntaPorId('c5-mat-00000000'), undefined);
});

test('mientras un curso no tiene batería, usa la de 5º', () => {
  assert.equal(bateria(3)[0].curso, 5);
});
