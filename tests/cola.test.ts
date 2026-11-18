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
