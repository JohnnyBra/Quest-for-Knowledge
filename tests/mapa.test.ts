import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TileType } from '../types.ts';
import { esMuro, caraFrontal, hayAntorcha, alphaNiebla, FUNDIDO_MS, RevelarNiebla } from '../mapaLogica.ts';

const W = TileType.WALL, P = TileType.PATH;

test('muros: pared, secreta y trampa parecen muro; puertas y suelo no', () => {
  assert.ok(esMuro(W) && esMuro(TileType.SECRET_WALL) && esMuro(TileType.TRAP_WALL));
  assert.ok(!esMuro(P) && !esMuro(TileType.DOOR_CLOSED) && !esMuro(TileType.LOCKED_DOOR) && !esMuro(TileType.ICE));
});

test('cara frontal solo si debajo no hay muro (y nunca en la última fila)', () => {
  const t = [[W, W], [W, P], [P, P]];
  assert.equal(caraFrontal(t, 0, 0), false); // debajo hay muro
  assert.equal(caraFrontal(t, 1, 0), true);  // debajo hay suelo
  assert.equal(caraFrontal(t, 0, 1), true);
  assert.equal(caraFrontal([[W]], 0, 0), false);
  assert.equal(caraFrontal(t, 0, 2), false); // suelo
});

test('antorchas: solo en caras frontales y siempre en el mismo sitio', () => {
  const t = Array.from({ length: 6 }, (_, y) => Array.from({ length: 40 }, () => (y === 0 ? W : P)));
  const xs = t[0].map((_, x) => x).filter(x => hayAntorcha(t, x, 0));
  assert.ok(xs.length >= 2 && xs.length <= 12, `antorchas: ${xs.length}`);
  assert.deepEqual(xs, t[0].map((_, x) => x).filter(x => hayAntorcha(t, x, 0)));
  assert.ok(t[1].every((_, x) => !hayAntorcha(t, x, 1)));
});

test('niebla: tapa lo no visitado y se funde al descubrir', () => {
  const r = new RevelarNiebla();
  r.actualizar([[false, false]], 0);
  const v1 = [[false, true]];
  r.actualizar(v1, 1000);
  assert.equal(alphaNiebla(v1, r, 0, 0, 1000), 1);
  assert.equal(alphaNiebla(v1, r, 1, 0, 1000), 1);              // recién descubierta: aún tapada
  assert.equal(alphaNiebla(v1, r, 1, 0, 1000 + FUNDIDO_MS / 2), 0.5);
  assert.equal(alphaNiebla(v1, r, 1, 0, 1000 + FUNDIDO_MS * 2), 0);
});

test('niebla: al cambiar de nivel (casillas que vuelven a no visitadas) se reinicia', () => {
  const r = new RevelarNiebla();
  r.actualizar([[false]], 0);
  r.actualizar([[true]], 1);
  r.actualizar([[false]], 5000);
  r.actualizar([[true]], 6000);
  assert.equal(alphaNiebla([[true]], r, 0, 0, 6000), 1);
});

test('niebla: al volver de una batalla (vista nueva) lo ya explorado no vuelve a fundirse', () => {
  const r = new RevelarNiebla();
  r.actualizar([[true, false]], 9000); // primera vez que se dibuja: ya estaba explorado
  assert.equal(alphaNiebla([[true, false]], r, 0, 0, 9000), 0);
  r.actualizar([[true, true]], 9100);  // lo que se descubre después sí se funde
  assert.equal(alphaNiebla([[true, true]], r, 1, 0, 9100), 1);
});
