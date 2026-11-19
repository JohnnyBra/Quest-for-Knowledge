import { Subject } from '../types.ts';

export interface Fila { id: number; alumno_id: number; pregunta_id: string; materia: string; correcta: number; texto: string; curso: number }
export interface Cifras { respuestas: number; aciertos: number; acierto: number | null; sabidas: number; aprendidas: number; pendientes: number; aprendizaje: number | null }
export interface Pregunteo { pregunta_id: string; texto: string; materia: string; intentos: number; fallos: number }

const ORDEN_MATERIAS: string[] = Object.values(Subject);
const enOrden = (filas: Fila[]) => [...filas].sort((a, b) => a.id - b.id);

// Cada par alumno–pregunta, mirando sus respuestas en el orden en que se dieron.
function pares(filas: Fila[]) {
  const m = new Map<string, { fila: Fila; primera: boolean; alguna: boolean; intentos: number; fallos: number }>();
  for (const f of enOrden(filas)) {
    const k = `${f.alumno_id}|${f.pregunta_id}`, bien = f.correcta === 1, p = m.get(k);
    if (!p) m.set(k, { fila: f, primera: bien, alguna: bien, intentos: 1, fallos: bien ? 0 : 1 });
    else { p.alguna ||= bien; p.intentos++; if (!bien) p.fallos++; }
  }
  return [...m.values()];
}

export function cifras(filas: Fila[]): Cifras {
  const aciertos = filas.filter(f => f.correcta === 1).length;
  let sabidas = 0, aprendidas = 0, pendientes = 0;
  for (const p of pares(filas)) { if (p.primera) sabidas++; else if (p.alguna) aprendidas++; else pendientes++; }
  return {
    respuestas: filas.length, aciertos, acierto: filas.length ? aciertos / filas.length : null,
    sabidas, aprendidas, pendientes, aprendizaje: aprendidas + pendientes ? aprendidas / (aprendidas + pendientes) : null,
  };
}

export const porMateria = (filas: Fila[]) =>
  ORDEN_MATERIAS.map(materia => ({ materia, filas: filas.filter(f => f.materia === materia) }))
    .filter(g => g.filas.length)
    .map(g => ({ materia: g.materia, ...cifras(g.filas) }));

export function masFalladas(filas: Fila[], n = 10, minimo = 3) {
  const m = new Map<string, { fila: Fila; respuestas: number; fallos: number; alumnos: Set<number> }>();
  for (const f of filas) {
    const q = m.get(f.pregunta_id) ?? { fila: f, respuestas: 0, fallos: 0, alumnos: new Set<number>() };
    q.respuestas++;
    if (f.correcta !== 1) { q.fallos++; q.alumnos.add(f.alumno_id); }
    m.set(f.pregunta_id, q);
  }
  return [...m.values()]
    .filter(q => q.respuestas >= minimo && q.fallos > 0)
    .map(q => ({ pregunta_id: q.fila.pregunta_id, texto: q.fila.texto, materia: q.fila.materia, curso: q.fila.curso,
      respuestas: q.respuestas, fallos: q.fallos, fallo: q.fallos / q.respuestas, alumnos: q.alumnos.size }))
    .sort((a, b) => b.fallo - a.fallo || b.respuestas - a.respuestas)
    .slice(0, n);
}

export function listasAlumno(filas: Fila[]) {
  const ps = pares(filas).filter(p => !p.primera);
  const a = (p: (typeof ps)[number]): Pregunteo =>
    ({ pregunta_id: p.fila.pregunta_id, texto: p.fila.texto, materia: p.fila.materia, intentos: p.intentos, fallos: p.fallos });
  return { pendientes: ps.filter(p => !p.alguna).map(a), aprendidas: ps.filter(p => p.alguna).map(a) };
}
