import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bateria, preguntaPorId, huella, CURSOS, materiasDe } from '../data/preguntas/index.ts';
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

for (const curso of [3, 4, 6] as const) test(`${curso}º: 300 preguntas, 75 + 25 por materia, sin Inglés ni EF`, () => {
  const b = bateria(curso);
  assert.equal(b.length, 300);
  assert.ok(b.every(q => q.curso === curso));
  const cuenta = (s: Subject, d: string) => b.filter(q => q.subject === s && q.difficulty === d).length;
  for (const s of [Subject.LANGUAGE, Subject.MATH, Subject.KNOWLEDGE])
    assert.deepEqual([cuenta(s, 'explorer'), cuenta(s, 'boss')], [75, 25], s);
  assert.deepEqual(materiasDe(curso), [Subject.MATH, Subject.LANGUAGE, Subject.KNOWLEDGE]);
});

test('convertidas: sin LaTeX, negritas ni marcas de correcta', () => {
  for (const curso of [3, 4, 6] as const) {
    const b = bateria(curso);
    for (const q of b) for (const t of [q.text, ...q.options]) {
      assert.doesNotMatch(t, /\$|\\|\*|_\d|\(Correcta/, t);
      assert.ok(t.trim().length > 0, q.text);
    }
  }
});

test('la nota entre paréntesis de la correcta (era para marcarla) no llega al juego', () => {
  const q = bateria(3).find(q => q.text.includes('sílabas tiene la palabra "mariposa"'))!;
  assert.equal(q.options[q.correctIndex], '4 sílabas');
  assert.equal(q.explanation, '');
  const h = bateria(4).find(q => q.options.includes('Herbir'))!;
  assert.equal(h.options[h.correctIndex], 'Herbir');
  assert.equal(h.explanation, '');
});

test('respuestas que la nota no debe recortar, y ninguna pregunta con dos opciones iguales de valor', () => {
  const correcta = (c: 3 | 4 | 6, trozo: string) => { const q = bateria(c).find(q => q.text.includes(trozo))!; return q.options[q.correctIndex]; };
  assert.equal(correcta(4, 'función cumple "los diplomas"'), 'Complemento directo');
  assert.equal(correcta(4, 'parasintética'), 'Una palabra derivada con prefijo sub- y sufijo -ino');
  assert.equal(correcta(3, 'ordinal 4º'), 'Cuarto');
  assert.equal(correcta(6, 'periódico resulta de dividir 1 ÷ 3'), '0,3 periódico');
  const laplace = bateria(6).find(q => q.text.includes('NO sacar una bola azul'))!;
  assert.ok(!laplace.options.includes('5/10'));
  assert.ok(bateria(6).some(q => q.text.includes('CO₂') || q.options.some(o => o.includes('CO₂'))));
});

test('5º conserva sus cinco materias', () => {
  assert.equal(materiasDe(5).length, 5);
});

test('cursos con batería: los que tienen preguntas propias', async () => {
  const { cursosConBateria } = await import('../data/preguntas/index.ts');
  assert.deepEqual(cursosConBateria(), CURSOS);
});
