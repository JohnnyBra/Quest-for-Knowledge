import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formaDe, getHeroArt, esHeroeValido, SKINS } from '../heroes.ts';

test('forma según nivel: 1-3, 4-6, 7+', () => {
  assert.deepEqual([1, 3, 4, 6, 7, 12].map(formaDe), [1, 1, 2, 2, 3, 3]);
});

test('arte del héroe: skin, género y forma según el nivel', () => {
  const url = getHeroArt({ skin: 'paladin', genero: 'chica' }, 1);
  assert.equal(url, '/arte/heroes/paladin-chica-1.webp');
  assert.equal(getHeroArt({ skin: 'dragon', genero: 'chico' }, 9), '/arte/heroes/dragon-chico-3.webp');
  assert.equal(getHeroArt({ skin: 'mago', genero: 'chica' }, 4), '/arte/heroes/mago-chica-2.webp');
});

test('hay 4 skins con nombre de chico y de chica', () => {
  assert.equal(SKINS.length, 4);
  for (const s of SKINS) assert.ok(s.nombre.chico && s.nombre.chica && s.formas.chico.length === 3 && s.formas.chica.length === 3);
});

test('héroe válido: skin conocida y género chico/chica', () => {
  assert.ok(esHeroeValido({ skin: 'mago', genero: 'chica' }));
  assert.ok(!esHeroeValido({ skin: 'hacker', genero: 'chica' }));
  assert.ok(!esHeroeValido({ skin: 'mago', genero: 'x' }));
  assert.ok(!esHeroeValido(null));
});
