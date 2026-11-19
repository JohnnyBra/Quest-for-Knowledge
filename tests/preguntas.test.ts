import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bateria, preguntaPorId, huella, CURSOS, materiasDe } from '../data/preguntas/index.ts';
import { Subject } from '../types.ts';

test('huella estable de 8 hex', () => {
  assert.equal(huella('hola'), huella('hola'));
  assert.match(huella('hola'), /^[0-9a-f]{8}$/);
  assert.notEqual(huella('hola'), huella('hola.'));
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

const cuenta = (curso: 3 | 4 | 5 | 6, s: Subject) =>
  [0, 1].map(j => bateria(curso).filter(q => q.subject === s && q.difficulty === (j ? 'boss' : 'explorer')).length);

for (const curso of [3, 4, 6] as const) test(`${curso}º: 500 preguntas, las cinco materias con 75 + 25`, () => {
  const b = bateria(curso);
  assert.equal(b.length, 500);
  assert.ok(b.every(q => q.curso === curso));
  for (const s of Object.values(Subject)) assert.deepEqual(cuenta(curso, s), [75, 25], s);
  assert.equal(materiasDe(curso).length, 5);
});

test('5º: sus 200 de siempre más 100 de Inglés y 100 de EF de los listados', () => {
  assert.equal(bateria(5).length, 400);
  assert.deepEqual(cuenta(5, Subject.ENGLISH), [27 + 75, 13 + 25]);
  assert.deepEqual(cuenta(5, Subject.PHYSICAL_ED), [27 + 75, 13 + 25]);
  assert.deepEqual(cuenta(5, Subject.MATH), [30, 10]);
});

test('convertidas: sin LaTeX, negritas ni marcas de correcta', () => {
  for (const curso of [3, 4, 5, 6] as const) {
    const b = bateria(curso).filter(q => curso !== 5 || q.subject === Subject.ENGLISH || q.subject === Subject.PHYSICAL_ED);
    for (const q of b) for (const t of [q.text, ...q.options]) {
      assert.doesNotMatch(t, /\$(?!\))|\\|\*|_\d|\(Correcta/, t);
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

test('notas «(Correcta - …)» también en Inglés y EF', () => {
  const q = bateria(5).concat(bateria(6), bateria(4), bateria(3)).find(q => q.options.includes('Wardrobe'))!;
  assert.equal(q.options[q.correctIndex], 'Wardrobe');
});

test('cursos con batería: los que tienen preguntas propias', async () => {
  const { cursosConBateria } = await import('../data/preguntas/index.ts');
  assert.deepEqual(cursosConBateria(), CURSOS);
});
