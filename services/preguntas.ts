import { bateria, type Curso, type Pregunta } from '../data/preguntas/index';

type Dificultad = 'explorer' | 'boss';

// Elige preguntas del curso efectivo. Las pendientes (falladas y aún no acertadas) solo salen por el repaso:
// una de cada 3 preguntas pedidas, si hay alguna de esa materia y dificultad vista hace 3 combates o más.
export class Selector {
  private combate = 0;
  private pedidas = 0;
  private vistas = new Map<string, number>(); // id → combate en que salió

  constructor(private curso: Curso, private pendientes: Set<string>, private azar: () => number = Math.random) {}

  nuevoCombate() { this.combate++; }

  elegir(materia: string, dificultad: Dificultad): Pregunta {
    const todas = bateria(this.curso).filter(q => q.subject === materia && q.difficulty === dificultad);
    const repaso = todas.filter(q => this.pendientes.has(q.id) && (this.vistas.get(q.id) ?? -Infinity) <= this.combate - 3);
    const sabidas = todas.filter(q => !this.pendientes.has(q.id));
    const nuevas = sabidas.filter(q => !this.vistas.has(q.id));
    this.pedidas++;
    const grupo = this.pedidas % 3 === 0 && repaso.length ? repaso
      : nuevas.length ? nuevas
      : sabidas.length ? sabidas
      : todas;
    const q = grupo[Math.floor(this.azar() * grupo.length)];
    this.vistas.set(q.id, this.combate);
    return q;
  }

  apuntar(id: string, correcta: boolean) {
    if (correcta) this.pendientes.delete(id); else this.pendientes.add(id);
  }
}

export let selector = new Selector(5, new Set());
export function configurarPreguntas(curso: Curso, pendientes: string[]) {
  selector = new Selector(curso, new Set(pendientes));
}
