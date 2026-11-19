import { Subject, type Question } from '../../types';
import { C3 } from './c3';
import { C4 } from './c4';
import { C5 } from './c5';
import { C6 } from './c6';

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

const BATERIAS: Record<Curso, Pregunta[]> = { 3: conId(3, C3), 4: conId(4, C4), 5: conId(5, C5), 6: conId(6, C6) };
const POR_ID = new Map(CURSOS.flatMap(c => BATERIAS[c].map(q => [q.id, q] as const)));

// ponytail: curso sin batería → la de 5º; se quita en la fase 3 cuando estén las de 3º, 4º y 6º.
export const bateria = (curso: Curso): Pregunta[] => (BATERIAS[curso].length ? BATERIAS[curso] : BATERIAS[5]);
export const preguntaPorId = (id: string): Pregunta | undefined => POR_ID.get(id);
