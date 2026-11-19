import type { Cifras, Pregunteo } from '../../servidor/analisis';

export type { Cifras, Pregunteo };
export type CifrasMateria = Cifras & { materia: string };
export type AlumnoFila = Cifras & { id: number; nombre: string; usuario: string; curso: number; bajado: boolean };
export interface Fallada { pregunta_id: string; texto: string; materia: string; curso: number; respuestas: number; fallos: number; fallo: number; alumnos: number }

export interface ResumenClase {
  clase: { id: number; nombre: string; curso: number; codigo: string };
  total: Cifras & { activos: number };
  materias: CifrasMateria[];
  alumnos: AlumnoFila[];
  masFalladas: Fallada[];
}

export interface FichaAlumno {
  alumno: { id: number; nombre: string; usuario: string; curso: number; cursoClase: number; clase: { id: number; nombre: string } };
  cursosPosibles: number[];
  total: Cifras;
  materias: CifrasMateria[];
  pendientes: Pregunteo[];
  aprendidas: Pregunteo[];
}

export const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`);
export const veces = (n: number) => `${n} ${n === 1 ? 'vez' : 'veces'}`;
