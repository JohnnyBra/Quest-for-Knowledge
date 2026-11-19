import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cifras, porMateria, masFalladas, listasAlumno, type Fila } from '../servidor/analisis.ts';

let id = 0;
const f = (alumno_id: number, pregunta_id: string, correcta: 0 | 1, materia = 'Matemáticas'): Fila =>
  ({ id: ++id, alumno_id, pregunta_id, materia, correcta, texto: `texto ${pregunta_id}`, curso: 5 });

test('sin respuestas: ceros y nulos, nunca NaN', () => {
  assert.deepEqual(cifras([]), { respuestas: 0, aciertos: 0, acierto: null, sabidas: 0, aprendidas: 0, pendientes: 0, aprendizaje: null });
});

test('sabida, aprendida y pendiente por par alumno–pregunta, en orden de respuesta', () => {
  const filas = [
    f(1, 'a', 1),                 // sabida
    f(1, 'b', 0), f(1, 'b', 1),   // aprendida (en dos partidas: un solo par)
    f(1, 'c', 0), f(1, 'c', 0),   // pendiente
    f(2, 'b', 1), f(2, 'b', 0),   // sabida (la primera manda) aunque luego falle
  ];
  const c = cifras(filas);
  assert.deepEqual([c.respuestas, c.aciertos, c.sabidas, c.aprendidas, c.pendientes], [7, 3, 2, 1, 1]);
  assert.equal(c.acierto, 3 / 7);
  assert.equal(c.aprendizaje, 1 / 2);
});

test('el orden lo da el id, no el orden del array', () => {
  const [x, y] = [f(1, 'q', 0), f(1, 'q', 1)];
  assert.equal(cifras([y, x]).aprendidas, 1);
});

test('sin fallos el índice de aprendizaje es nulo', () => {
  assert.equal(cifras([f(1, 'a', 1)]).aprendizaje, null);
});

test('por materia: solo las que tienen datos, en el orden de las materias', () => {
  const r = porMateria([f(1, 'a', 1, 'Inglés'), f(1, 'b', 0, 'Matemáticas'), f(1, 'c', 1, 'Matemáticas')]);
  assert.deepEqual(r.map(m => [m.materia, m.respuestas, m.aciertos]), [['Matemáticas', 2, 1], ['Inglés', 1, 1]]);
});

test('más falladas: % de fallo, mínimo de respuestas, alumnos distintos, desempate por nº de respuestas', () => {
  const filas = [
    f(1, 'x', 0), f(2, 'x', 0), f(2, 'x', 1),           // 2/3 fallo, 2 alumnos
    f(1, 'y', 0), f(2, 'y', 0), f(3, 'y', 0), f(3, 'y', 1), // 3/4 fallo
    f(1, 'z', 0), f(1, 'z', 0),                         // solo 2 respuestas: fuera
    f(1, 'w', 1), f(2, 'w', 1), f(3, 'w', 1),           // 0 fallos: fuera
  ];
  const r = masFalladas(filas);
  assert.deepEqual(r.map(q => [q.pregunta_id, q.fallos, q.respuestas, q.alumnos]), [['y', 3, 4, 3], ['x', 2, 3, 2]]);
  assert.equal(r[0].fallo, 3 / 4);
  assert.equal(r[0].texto, 'texto y');
  assert.equal(masFalladas(filas, 1).length, 1);
});

test('listas del alumno: pendientes y aprendidas con intentos', () => {
  const l = listasAlumno([f(1, 'a', 0), f(1, 'a', 0), f(1, 'b', 0), f(1, 'b', 1), f(1, 'c', 1)]);
  assert.deepEqual(l.pendientes.map(p => [p.pregunta_id, p.intentos, p.fallos]), [['a', 2, 2]]);
  assert.deepEqual(l.aprendidas.map(p => [p.pregunta_id, p.intentos]), [['b', 2]]);
});
