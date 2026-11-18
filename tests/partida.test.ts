import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPartida } from '../services/partida.ts';
import { ErrorApi } from '../services/api.ts';

function servidorFalso() {
  const llamadas: [string, unknown][] = [];
  let red = true, n = 0;
  const llamar = async (ruta: string, cuerpo?: unknown) => {
    if (!red) throw new ErrorApi('sin red', 0);
    llamadas.push([ruta, cuerpo]);
    return (ruta === '/api/partidas' ? { id: ++n } : { ok: true }) as any;
  };
  return { llamadas, llamar, red: (v: boolean) => { red = v; } };
}

test('sin red al empezar: la partida se crea en cuanto vuelve y no se pierde ninguna respuesta', async () => {
  const s = servidorFalso();
  const p = crearPartida(s.llamar);
  s.red(false);
  await p.empezar();
  await p.responder('q1', false, 100);
  s.red(true);
  await p.responder('q2', true, 200);
  await p.terminar({ puntos: 5, nivel_heroe: 1, mapa: 1 });
  assert.deepEqual(s.llamadas, [
    ['/api/partidas', {}],
    ['/api/respuestas', { partida_id: 1, pregunta_id: 'q1', correcta: false, ms: 100 }],
    ['/api/respuestas', { partida_id: 1, pregunta_id: 'q2', correcta: true, ms: 200 }],
    ['/api/partidas/1/fin', { puntos: 5, nivel_heroe: 1, mapa: 1 }],
  ]);
});

test('las respuestas pendientes de una partida no se cuelan en la siguiente', async () => {
  const s = servidorFalso();
  const p = crearPartida(s.llamar);
  await p.empezar();                       // partida 1
  s.red(false);
  await p.responder('q1', true, 10);       // se queda en la cola
  await p.empezar();                       // otra partida sin red
  s.red(true);
  await p.responder('q2', true, 20);
  const respuestas = s.llamadas.filter(([r]) => r === '/api/respuestas').map(([, c]) => c as any);
  assert.deepEqual(respuestas.map(r => [r.pregunta_id, r.partida_id]), [['q1', 1], ['q2', 2]]);
});

test('terminar dos veces solo cierra una', async () => {
  const s = servidorFalso();
  const p = crearPartida(s.llamar);
  await p.empezar();
  await p.terminar({ puntos: 1, nivel_heroe: 1, mapa: 1 });
  await p.terminar({ puntos: 2, nivel_heroe: 1, mapa: 1 });
  assert.equal(s.llamadas.filter(([r]) => r.endsWith('/fin')).length, 1);
});
