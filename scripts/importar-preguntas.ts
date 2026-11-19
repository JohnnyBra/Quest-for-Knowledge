// Convierte una «Batería Maestra» de Javi (Markdown) en data/preguntas/cN.ts.
// Uso: npx tsx scripts/importar-preguntas.ts <archivo.md> <curso>
// Baraja las opciones (la correcta venía casi siempre en la B), pasa a la explicación el paréntesis final que solo
// lleva la correcta, y convierte las fórmulas LaTeX en texto.
import { readFileSync, writeFileSync } from 'node:fs';
import { huella } from '../data/preguntas/index.ts';

const [archivo, curso] = process.argv.slice(2);
if (!archivo || !/^[346]$/.test(curso ?? '')) { console.error('Uso: importar-preguntas.ts <archivo.md> <3|4|6>'); process.exit(1); }

const SUPER: Record<string, string> = { '2': '²', '3': '³', '4': '⁴' };
const latex = (t: string) => t.replace(/\$([^$]*)\$/g, (_, f: string) => f
  .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')
  .replace(/\\sqrt\{([^}]*)\}/g, '√$1')
  .replace(/\\widehat\{([^}]*)\}/g, '$1̂')
  .replace(/\\text\{([^}]*)\}/g, '$1')
  .replace(/\^\\circ/g, '°').replace(/\^\{?([234])\}?/g, (_, d) => SUPER[d])
  .replace(/\\times/g, '×').replace(/\\div/g, '÷').replace(/\\pi/g, 'π').replace(/\\neq/g, '≠').replace(/\\approx/g, '≈')
  .replace(/\\_/g, '_').replace(/\\ /g, ' ')
  .replace(/\s+/g, ' ').trim());
const limpiar = (t: string) => latex(t).replace(/\*\*/g, '').trim();

// Paréntesis final equilibrado: «texto (pista)» → ['texto', 'pista'].
function finalEntreParentesis(t: string): [string, string] | null {
  if (!t.endsWith(')')) return null;
  let n = 0;
  for (let i = t.length - 1; i >= 0; i--) {
    if (t[i] === ')') n++;
    else if (t[i] === '(' && --n === 0) return i > 0 ? [t.slice(0, i).trim(), t.slice(i + 1, -1).trim()] : null;
  }
  return null;
}

// Barajado de Fisher-Yates con semilla (mulberry32): la misma pregunta sale siempre igual.
function barajar<T>(v: T[], semilla: number): T[] {
  let a = semilla >>> 0;
  const azar = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32; };
  const r = [...v];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

const MATERIA = [['LENGUA', 'LANGUAGE'], ['MATEMÁTICAS', 'MATH'], ['CONOCIMIENTO DEL MEDIO', 'KNOWLEDGE']] as const;
type P = { materia: string; dif: 'explorer' | 'boss'; texto: string; opciones: string[]; correcta: number; explicacion: string; linea: number };
const ps: P[] = [];
let materia = '', dif: 'explorer' | 'boss' = 'explorer';
readFileSync(archivo, 'utf8').split(/\r?\n/).forEach((l, i) => {
  let m;
  if (l.startsWith('## ')) materia = MATERIA.find(([k]) => l.toUpperCase().includes(k))?.[1] ?? '';
  else if (l.startsWith('### ')) dif = /jefe/i.test(l) ? 'boss' : 'explorer';
  else if ((m = l.match(/^\d+\.\s+(.*)$/))) ps.push({ materia, dif, texto: limpiar(m[1]), opciones: [], correcta: -1, explicacion: '', linea: i + 1 });
  else if ((m = l.match(/^\s+- [A-D]\)\s*(.*)$/))) {
    const p = ps.at(-1)!;
    let o = m[1];
    const marca = o.match(/\s*\(Correcta(?:\s*-\s*([^)]*))?\)\s*$/);
    if (marca) { p.correcta = p.opciones.length; p.explicacion = marca[1]?.trim() ?? ''; o = o.slice(0, marca.index); }
    p.opciones.push(limpiar(o));
  }
});

for (const p of ps) {
  if (!p.materia || p.opciones.length !== 4 || p.correcta < 0) throw new Error(`Línea ${p.linea}: pregunta mal formada`);
  // Pista: paréntesis final solo en la correcta → a la explicación.
  const pista = finalEntreParentesis(p.opciones[p.correcta]);
  if (pista && !p.opciones.some((o, i) => i !== p.correcta && finalEntreParentesis(o))) {
    p.opciones[p.correcta] = pista[0];
    p.explicacion = [pista[1], p.explicacion].filter(Boolean).join('. ');
  }
}

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const lineas = ps.map(p => {
  const orden = barajar([0, 1, 2, 3], parseInt(huella(p.texto), 16));
  const opciones = orden.map(i => p.opciones[i]);
  const args = [`Subject.${p.materia}`, `'${p.dif}'`, q(p.texto), `[${opciones.map(q).join(', ')}]`, String(orden.indexOf(p.correcta))];
  if (p.explicacion) args.push(q(p.explicacion));
  return `  createQ(${args.join(', ')}),`;
});

writeFileSync(`data/preguntas/c${curso}.ts`, `import { Question, Subject } from '../../types';

// Generado con scripts/importar-preguntas.ts desde la «Batería Maestra de 300 Preguntas - ${curso}º Primaria» de Javi.
// Para cambiar preguntas: editar data/preguntas/fuentes/c${curso}.md y volver a generar:
//   npx tsx scripts/importar-preguntas.ts data/preguntas/fuentes/c${curso}.md ${curso}
const createQ = (s: Subject, d: 'explorer' | 'boss', t: string, o: string[], c: number, e: string = ""): Question => ({
    subject: s, difficulty: d, text: t, options: o, correctIndex: c, explanation: e
});

export const C${curso}: Question[] = [
${lineas.join('\n')}
];
`);
console.log(`c${curso}.ts: ${ps.length} preguntas`);
