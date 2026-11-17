import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formaDe, getHeroArt, cargarHeroe, guardarHeroe, SKINS } from '../heroes.ts';

test('forma según nivel: 1-3, 4-6, 7+', () => {
  assert.deepEqual([1, 3, 4, 6, 7, 12].map(formaDe), [1, 1, 2, 2, 3, 3]);
});

test('arte del héroe: skin, género y forma (cae a la última forma hecha)', () => {
  const url = getHeroArt({ skin: 'paladin', genero: 'chica' }, 1);
  assert.equal(url, '/arte/heroes/paladin-chica-1.webp');
  assert.match(getHeroArt({ skin: 'dragon', genero: 'chico' }, 9), /^\/arte\/heroes\/dragon-chico-[123]\.webp$/);
});

test('hay 4 skins con nombre de chico y de chica', () => {
  assert.equal(SKINS.length, 4);
  for (const s of SKINS) assert.ok(s.nombre.chico && s.nombre.chica);
});

test('guardar y cargar el héroe por nombre; sin storage no rompe', () => {
  const mem = new Map<string, string>();
  const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  guardarHeroe('Ana', { skin: 'mago', genero: 'chica' }, storage);
  assert.deepEqual(cargarHeroe('ana', storage), { skin: 'mago', genero: 'chica' });
  assert.equal(cargarHeroe('Luis', storage), null);
  const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
  assert.equal(cargarHeroe('Ana', roto), null);
  assert.doesNotThrow(() => guardarHeroe('Ana', { skin: 'mago', genero: 'chica' }, roto));
  mem.set('quest-heroe:pepe', '{"skin":"hacker","genero":"x"}');
  assert.equal(cargarHeroe('Pepe', storage), null);
});
