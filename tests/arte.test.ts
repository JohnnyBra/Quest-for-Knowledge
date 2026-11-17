import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ENEMY_TEMPLATES, BOSS_TEMPLATE, GAME_ITEMS, GAME_ITEMS_SPECIAL, LLAVE_MAESTRA, arteObjeto } from '../constants.ts';
import { ItemType } from '../types.ts';
import { SKINS, getHeroArt } from '../heroes.ts';

const enPublic = (url: string) => existsSync(new URL(`../public${url}`, import.meta.url));

test('la llave maestra existe y es una llave (si no, la puerta del nivel 5 no se abre nunca)', () => {
  assert.equal(LLAVE_MAESTRA.type, ItemType.KEY);
  assert.ok(!GAME_ITEMS.includes(LLAVE_MAESTRA), 'la llave no debe salir en los cofres');
});

test('cada monstruo y el jefe tienen su dibujo', () => {
  for (const m of [...ENEMY_TEMPLATES, BOSS_TEMPLATE]) assert.ok(enPublic(m.spriteUrl), `falta ${m.spriteUrl}`);
});

test('cada objeto de la mochila tiene su dibujo', () => {
  for (const o of [...GAME_ITEMS, ...GAME_ITEMS_SPECIAL, LLAVE_MAESTRA]) assert.ok(enPublic(arteObjeto(o)), `falta ${arteObjeto(o)}`);
});

test('los 24 héroes tienen su dibujo', () => {
  for (const s of SKINS) for (const g of ['chico', 'chica'] as const) for (const n of [1, 4, 7]) {
    assert.ok(enPublic(getHeroArt({ skin: s.id, genero: g }, n)), getHeroArt({ skin: s.id, genero: g }, n));
  }
});
