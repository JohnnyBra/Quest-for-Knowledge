// Convierte una «Batería Maestra» de Javi (Markdown) en data/preguntas/cN.ts.
// Uso: npx tsx scripts/importar-preguntas.ts <archivo.md> <curso>
// Quita la nota entre paréntesis de la correcta («(Correcta)», «(Correcta - …)» y el paréntesis final que solo lleva
// ella: son notas para marcarla, no para el alumnado) y convierte las fórmulas LaTeX en texto. Las opciones las baraja
// el juego cada vez que sale la pregunta.
import { readFileSync, writeFileSync } from 'node:fs';

const [archivo, curso] = process.argv.slice(2);
if (!archivo || !/^[346]$/.test(curso ?? '')) { console.error('Uso: importar-preguntas.ts <archivo.md> <3|4|6>'); process.exit(1); }

const SUPER: Record<string, string> = { '2': '²', '3': '³', '4': '⁴' };
const latex = (t: string) => t.replace(/\$([^$]*)\$/g, (_, f: string) => f
  .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')
  .replace(/\\sqrt\{([^}]*)\}/g, '√$1')
  .replace(/\\widehat\{([^}]*)\}/g, '$1 periódico')
  .replace(/\\text\{([^}]*)\}/g, '$1')
  .replace(/\^\\circ/g, '°').replace(/\^\{?([234])\}?/g, (_, d) => SUPER[d]).replace(/_\{?2\}?/g, '₂')
  .replace(/\\times/g, '×').replace(/\\div/g, '÷').replace(/\\pi/g, 'π').replace(/\\neq/g, '≠').replace(/\\approx/g, '≈')
  .replace(/\\_/g, '_').replace(/\\ /g, ' ')
  .replace(/\s+/g, ' ').trim());
const limpiar = (t: string) => latex(t).replace(/\*/g, '').trim(); // negritas y cursivas de Markdown

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

const MATERIA = [['LENGUA', 'LANGUAGE'], ['MATEMÁTICAS', 'MATH'], ['CONOCIMIENTO DEL MEDIO', 'KNOWLEDGE']] as const;
type P = { materia: string; dif: 'explorer' | 'boss'; texto: string; opciones: string[]; correcta: number; linea: number };
const ps: P[] = [];
let materia = '', dif: 'explorer' | 'boss' = 'explorer';
readFileSync(archivo, 'utf8').split(/\r?\n/).forEach((l, i) => {
  let m;
  if (l.startsWith('## ')) materia = MATERIA.find(([k]) => l.toUpperCase().includes(k))?.[1] ?? '';
  else if (l.startsWith('### ')) dif = /jefe/i.test(l) ? 'boss' : 'explorer';
  else if ((m = l.match(/^\d+\.\s+(.*)$/))) ps.push({ materia, dif, texto: limpiar(m[1]), opciones: [], correcta: -1, linea: i + 1 });
  else if ((m = l.match(/^\s+- [A-D]\)\s*(.*)$/))) {
    const p = ps.at(-1)!;
    let o = m[1];
    const marca = o.match(/\s*\(Correcta(?:\s*-\s*[^)]*)?\)\s*$/);
    if (marca) { p.correcta = p.opciones.length; o = o.slice(0, marca.index); }
    p.opciones.push(limpiar(o));
  }
});

for (const p of ps) {
  if (!p.materia || p.opciones.length !== 4 || p.correcta < 0) throw new Error(`Línea ${p.linea}: pregunta mal formada`);
  // Nota: paréntesis final solo en la correcta → fuera.
  const nota = finalEntreParentesis(p.opciones[p.correcta]);
  if (nota && !p.opciones.some((o, i) => i !== p.correcta && finalEntreParentesis(o))) p.opciones[p.correcta] = nota[0];
}

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const lineas = ps.map(p => {
  const args = [`Subject.${p.materia}`, `'${p.dif}'`, q(p.texto), `[${p.opciones.map(q).join(', ')}]`, String(p.correcta)];
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
