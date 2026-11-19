import { Subject, type Question } from '../../types';
import { C5 } from './c5';
import { GENERADAS } from './generadas';

export type Curso = 3 | 4 | 5 | 6;
export const CURSOS: Curso[] = [3, 4, 5, 6];
export type Pregunta = Question & { id: string; curso: Curso };

const MATERIA: Record<string, string> = {
  [Subject.LANGUAGE]: 'len', [Subject.MATH]: 'mat', [Subject.KNOWLEDGE]: 'cme', [Subject.ENGLISH]: 'ing', [Subject.PHYSICAL_ED]: 'efi',
};

// FNV-1a de 32 bits: misma huella en el navegador y en el servidor, sin dependencias.
export function huella(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

const conId = (curso: Curso, qs: Question[]): Pregunta[] =>
  qs.map(q => ({ ...q, curso, id: `c${curso}-${MATERIA[q.subject]}-${huella(q.text)}` }));

// 5º: su batería de siempre + lo de los listados de Javi (Inglés y EF); 3º, 4º y 6º: solo los listados.
const BATERIAS = Object.fromEntries(CURSOS.map(c => [c, conId(c, [...(c === 5 ? C5 : []), ...GENERADAS[c]])])) as Record<Curso, Pregunta[]>;
const POR_ID = new Map(CURSOS.flatMap(c => BATERIAS[c].map(q => [q.id, q] as const)));

export const bateria = (curso: Curso): Pregunta[] => BATERIAS[curso];
export const cursosConBateria = (): Curso[] => CURSOS.filter(c => BATERIAS[c].length > 0);
// Materias con preguntas en ese curso, en el orden de Subject (3º, 4º y 6º no tienen Inglés ni EF).
export const materiasDe = (curso: Curso): string[] =>
  Object.values(Subject).filter(s => BATERIAS[curso].some(q => q.subject === s));
export const preguntaPorId = (id: string): Pregunta | undefined => POR_ID.get(id);
