import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { CifrasGrandes, BarrasMaterias } from './Cifras';
import { pct, type ResumenClase, type AlumnoFila } from './tipos';

type Columna = { clave: keyof AlumnoFila; nombre: string; numero?: boolean; pct?: boolean };
const COLUMNAS: Columna[] = [
  { clave: 'nombre', nombre: 'Nombre' },
  { clave: 'curso', nombre: 'Curso', numero: true },
  { clave: 'respuestas', nombre: 'Respuestas', numero: true },
  { clave: 'acierto', nombre: 'Aciertos', numero: true, pct: true },
  { clave: 'sabidas', nombre: 'Ya sabidas', numero: true },
  { clave: 'aprendidas', nombre: 'Aprendidas', numero: true },
  { clave: 'pendientes', nombre: 'Pendientes', numero: true },
  { clave: 'aprendizaje', nombre: 'Aprendizaje', numero: true, pct: true },
];

function ordenar(filas: AlumnoFila[], clave: keyof AlumnoFila, asc: boolean) {
  return [...filas].sort((a, b) => {
    const x = a[clave], y = b[clave];
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1; // sin datos, siempre al final
    const d = typeof x === 'string' ? x.localeCompare(y as string, 'es') : (x as number) - (y as number);
    return asc ? d : -d;
  });
}

export default function VistaClase({ id }: { id: number }) {
  const [datos, setDatos] = useState<ResumenClase | null>(null);
  const [error, setError] = useState('');
  const [orden, setOrden] = useState<{ clave: keyof AlumnoFila; asc: boolean }>({ clave: 'nombre', asc: true });

  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { api<ResumenClase>(`/api/clases/${id}`).then(setDatos).catch(e => setError(e.message)); }, [id]);
  useEffect(() => { if (datos) titulo.current?.focus(); }, [!!datos]);

  if (error) return <p role="alert" className="panel font-bold" style={{ color: '#ff9aa6' }}>{error} <a className="enlace" href="#/">Volver a mis clases</a></p>;
  if (!datos) return <p className="panel" style={{ color: 'var(--tenue)' }}>Cargando la clase…</p>;
  const { clase, total, materias, alumnos, masFalladas } = datos;
  const pulsar = (clave: keyof AlumnoFila) => setOrden(o => ({ clave, asc: o.clave === clave ? !o.asc : clave === 'nombre' }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <a className="miga" href="#/">← Mis clases</a>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mt-2">
          <h2 ref={titulo} tabIndex={-1} className="m-0 text-[clamp(1.8rem,4vw,2.6rem)] outline-none" style={{ color: 'var(--dorado)' }}>{clase.nombre}</h2>
          <p className="m-0" style={{ color: 'var(--tenue)' }}>
            {clase.curso}º de Primaria. Código para entrar: <strong className="titulo tracking-[0.2em]" style={{ color: 'var(--dorado-claro)' }}>{clase.codigo}</strong>
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="panel"><h3 className="panel-titulo">Resumen</h3><CifrasGrandes c={total} /></section>
        <section className="panel"><h3 className="panel-titulo">Por materia</h3><BarrasMaterias materias={materias} /></section>
      </div>

      <section className="panel">
        <h3 className="panel-titulo">Alumnado</h3>
        {alumnos.length === 0 ? (
          <p className="m-0" style={{ color: 'var(--tenue)' }}>Nadie se ha unido todavía. Dales el código <strong>{clase.codigo}</strong> para que se registren en «Tengo un código de clase».</p>
        ) : (
          <div className="overflow-x-auto scroll-fino">
            <table className="tabla">
              <thead>
                <tr>
                  {COLUMNAS.map(c => (
                    <th key={c.clave} className={c.numero ? 'num' : ''} aria-sort={orden.clave === c.clave ? (orden.asc ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => pulsar(c.clave)}>
                        {c.nombre}<span aria-hidden="true">{orden.clave === c.clave ? (orden.asc ? ' ▲' : ' ▼') : ''}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenar(alumnos, orden.clave, orden.asc).map(a => (
                  <tr key={a.id}>
                    <td><a className="enlace" href={`#/alumno/${a.id}`}>{a.nombre}</a></td>
                    <td className="num">{a.curso}º{a.bajado && <span title="Curso bajado" aria-label="(curso bajado)" style={{ color: 'var(--runa)' }}> ↓</span>}</td>
                    <td className="num">{a.respuestas}</td>
                    <td className="num">{pct(a.acierto)}</td>
                    <td className="num">{a.sabidas}</td>
                    <td className="num">{a.aprendidas}</td>
                    <td className="num">{a.pendientes}</td>
                    <td className="num">{pct(a.aprendizaje)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h3 className="panel-titulo">Preguntas que más se fallan</h3>
        {masFalladas.length === 0 ? (
          <p className="m-0" style={{ color: 'var(--tenue)' }}>Aún no hay preguntas con al menos 3 respuestas.</p>
        ) : (
          <ol className="falladas">
            {masFalladas.map(q => (
              <li key={q.pregunta_id}>
                <p className="m-0 font-semibold">{q.texto}</p>
                <p className="m-0 text-sm" style={{ color: 'var(--tenue)' }}>
                  {q.materia}, {q.curso}º. <strong style={{ color: 'var(--dorado-claro)' }}>{pct(q.fallo)} de fallo</strong> ({q.fallos} de {q.respuestas}).
                  {' '}La {q.alumnos === 1 ? 'falló 1 alumno' : `fallaron ${q.alumnos} alumnos`}.
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
