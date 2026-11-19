import React from 'react';
import { pct, type Cifras, type CifrasMateria } from './tipos';

// Colores validados (modo oscuro, daltonismo y contraste) con la skill dataviz: ya sabidas, aprendidas, pendientes.
const TRAMOS = [
  { clave: 'sabidas', nombre: 'Ya la sabía', color: '#1f9e8a' },
  { clave: 'aprendidas', nombre: 'Aprendida', color: '#b9862a' },
  { clave: 'pendientes', nombre: 'Aún pendiente', color: '#9b7be0' },
] as const;

export function CifrasGrandes({ c }: { c: Cifras & { activos?: number } }) {
  const pares = c.sabidas + c.aprendidas + c.pendientes;
  return (
    <div className="flex flex-col gap-5">
      <dl className="datos">
        <div className="dato"><dt>Respuestas</dt><dd>{c.respuestas.toLocaleString('es-ES')}</dd></div>
        <div className="dato"><dt>Aciertos</dt><dd>{pct(c.acierto)}</dd></div>
        <div className="dato"><dt>Índice de aprendizaje</dt><dd>{pct(c.aprendizaje)}</dd></div>
        {c.activos !== undefined && <div className="dato"><dt>Han jugado</dt><dd>{c.activos}</dd></div>}
      </dl>
      {pares === 0 ? (
        <p className="m-0" style={{ color: 'var(--tenue)' }}>Todavía no hay respuestas. Las cifras aparecen en cuanto alguien juegue.</p>
      ) : (
        <figure className="m-0 flex flex-col gap-2">
          <figcaption className="text-sm" style={{ color: 'var(--tenue)' }}>
            Preguntas contestadas ({pares}), según cómo fue la primera vez y si después se acertaron
          </figcaption>
          <div className="tramos" aria-hidden="true">
            {TRAMOS.filter(t => c[t.clave] > 0).map(t => (
              <span key={t.clave} style={{ flexGrow: c[t.clave], background: t.color }} title={`${t.nombre}: ${c[t.clave]}`} />
            ))}
          </div>
          <ul className="leyenda">
            {TRAMOS.map(t => (
              <li key={t.clave}><span className="muestra" style={{ background: t.color }} />{t.nombre}: <strong>{c[t.clave]}</strong></li>
            ))}
          </ul>
        </figure>
      )}
    </div>
  );
}

export function BarrasMaterias({ materias }: { materias: CifrasMateria[] }) {
  if (!materias.length) return <p className="m-0" style={{ color: 'var(--tenue)' }}>Sin respuestas todavía.</p>;
  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-4">
      {materias.map(m => (
        <li key={m.materia} className="materia-fila">
          <span className="font-bold">{m.materia}</span>
          <span className="barra" aria-hidden="true"><span className="barra-relleno" style={{ width: `${(m.acierto ?? 0) * 100}%` }} /></span>
          <span className="tabular-nums font-bold text-right">{pct(m.acierto)}</span>
          <span className="materia-nota">
            {m.respuestas} {m.respuestas === 1 ? 'respuesta' : 'respuestas'}, aprendizaje {pct(m.aprendizaje)}
          </span>
        </li>
      ))}
    </ul>
  );
}
