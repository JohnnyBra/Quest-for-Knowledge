// Convierte las «Baterías Maestras» de Javi (data/preguntas/fuentes/*.md) en data/preguntas/generadas.ts.
// Uso: npx tsx scripts/importar-preguntas.ts
// Fuentes: cN.md = un curso con varias materias (una por bloque «## …»); ingles.md y ef.md = una materia con un bloque
// «## … Nº DE PRIMARIA» por curso.
// Quita la nota entre paréntesis de la correcta («(Correcta)», «(Correcta - …)» y el paréntesis final que solo lleva
// ella: son notas para marcarla, no para el alumnado) y convierte las fórmulas LaTeX en texto. Las opciones las baraja
// el juego cada vez que sale la pregunta.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const FUENTES = 'data/preguntas/fuentes';

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
type P = { curso: number; materia: string; dif: 'explorer' | 'boss'; texto: string; opciones: string[]; correcta: number; donde: string };
const POR_ARCHIVO: Record<string, string> = { 'ingles.md': 'ENGLISH', 'ef.md': 'PHYSICAL_ED' };
const ps: P[] = [];
for (const archivo of readdirSync(FUENTES).filter(f => f.endsWith('.md')).sort()) {
  const fija = POR_ARCHIVO[archivo];
  let curso = Number(archivo.match(/^c(\d)\.md$/)?.[1] ?? 0), materia = fija ?? '', dif: 'explorer' | 'boss' = 'explorer';
  readFileSync(`${FUENTES}/${archivo}`, 'utf8').split(/\r?\n/).forEach((l, i) => {
    let m;
    if (l.startsWith('## ')) {
      if (fija) curso = Number(l.match(/([3-6])º DE PRIMARIA/i)?.[1] ?? 0);
      else materia = MATERIA.find(([k]) => l.toUpperCase().includes(k))?.[1] ?? '';
    }
    else if (l.startsWith('### ')) dif = /jefe|boss/i.test(l) ? 'boss' : 'explorer';
    else if ((m = l.match(/^\d+\.\s+(.*)$/))) ps.push({ curso, materia, dif, texto: limpiar(m[1]), opciones: [], correcta: -1, donde: `${archivo}:${i + 1}` });
    else if ((m = l.match(/^\s+- [A-D]\)\s*(.*)$/))) {
      const p = ps.at(-1)!;
      let o = m[1];
      const marca = o.match(/\s*\(Correcta(?:\s*-\s*[^)]*)?\)\s*$/);
      if (marca) { p.correcta = p.opciones.length; o = o.slice(0, marca.index); }
      p.opciones.push(limpiar(o));
    }
  });
}

for (const p of ps) {
  if (!p.curso || !p.materia || p.opciones.length !== 4 || p.correcta < 0) throw new Error(`${p.donde}: pregunta mal formada`);
  // Nota: paréntesis final solo en la correcta → fuera.
  const nota = finalEntreParentesis(p.opciones[p.correcta]);
  if (nota && !p.opciones.some((o, i) => i !== p.correcta && finalEntreParentesis(o))) p.opciones[p.correcta] = nota[0];
}

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const linea = (p: P) => `    createQ(${[`Subject.${p.materia}`, `'${p.dif}'`, q(p.texto), `[${p.opciones.map(q).join(', ')}]`, String(p.correcta)].join(', ')}),`;

writeFileSync('data/preguntas/generadas.ts', `import { Question, Subject } from '../../types';

// GENERADO: no editar. Para cambiar preguntas, editar data/preguntas/fuentes/*.md y volver a generar:
//   npx tsx scripts/importar-preguntas.ts
const createQ = (s: Subject, d: 'explorer' | 'boss', t: string, o: string[], c: number): Question => ({
    subject: s, difficulty: d, text: t, options: o, correctIndex: c, explanation: ''
});

export const GENERADAS: Record<3 | 4 | 5 | 6, Question[]> = {
${[3, 4, 5, 6].map(c => `  ${c}: [\n${ps.filter(p => p.curso === c).map(linea).join('\n')}\n  ],`).join('\n')}
};
`);
for (const c of [3, 4, 5, 6]) console.log(`${c}º: ${ps.filter(p => p.curso === c).length} preguntas`);
