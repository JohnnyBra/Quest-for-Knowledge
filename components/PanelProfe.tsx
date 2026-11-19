import React, { useEffect, useState } from 'react';
import { Estandarte, Fondo } from './RetroUI';
import { api } from '../services/api';
import VistaClase from './panel/VistaClase';
import VistaAlumno from './panel/VistaAlumno';

interface Clase { id: number; nombre: string; curso: number; codigo: string; alumnos: number }

type Ruta = { vista: 'clases' } | { vista: 'clase'; id: number } | { vista: 'alumno'; id: number };
const leerRuta = (): Ruta => {
  const m = location.hash.match(/^#\/(clase|alumno)\/(\d+)$/);
  return m ? { vista: m[1] as 'clase' | 'alumno', id: Number(m[2]) } : { vista: 'clases' };
};

export default function PanelProfe({ nombre, onSalir }: { nombre: string; onSalir: () => void }) {
  const [ruta, setRuta] = useState<Ruta>(leerRuta);
  useEffect(() => {
    const cambiar = () => { setRuta(leerRuta()); scrollTo(0, 0); };
    addEventListener('hashchange', cambiar);
    return () => removeEventListener('hashchange', cambiar);
  }, []);
  const [clases, setClases] = useState<Clase[] | null>(null);
  const [nueva, setNueva] = useState({ nombre: '', curso: 5 });
  const [error, setError] = useState('');

  useEffect(() => { if (ruta.vista === 'clases') api<Clase[]>('/api/clases').then(setClases).catch(e => setError(e.message)); }, [ruta.vista]);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      const c = await api<Clase>('/api/clases', nueva);
      setClases(cs => [...(cs ?? []), c]);
      setNueva({ nombre: '', curso: nueva.curso });
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Fondo />
      <header className="cabecera capa">
        <h1>Quest for Knowledge</h1>
        <Estandarte />
        <span className="creditos text-right">Creado por Javi Barrero</span>
      </header>
      <main className="capa w-full max-w-5xl mx-auto px-4 pt-24 pb-10 flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="m-0" style={{ color: 'var(--runa-clara)' }}>Panel del maestro de {nombre}</p>
          </div>
          <button className="btn-cuero" onClick={onSalir}>Salir</button>
        </div>

        {/* key: cada clase o alumno empieza con su estado limpio (sin confirmaciones ni errores del anterior) */}
        {ruta.vista === 'clase' ? <div key={`c${ruta.id}`} className="contents"><VistaClase id={ruta.id} /></div>
          : ruta.vista === 'alumno' ? <div key={`a${ruta.id}`} className="contents"><VistaAlumno id={ruta.id} /></div> : (<>

        <section className="panel">
          <h3 className="panel-titulo">Mis clases</h3>
          {clases === null ? <p style={{ color: 'var(--tenue)' }}>Cargando…</p>
            : clases.length === 0 ? <p style={{ color: 'var(--tenue)' }}>Aún no tienes clases. Crea la primera aquí abajo.</p>
            : (
              <ul className="m-0 p-0 list-none grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clases.map(c => (
                  <li key={c.id}><a href={`#/clase/${c.id}`} className="ficha tarjeta-clase flex flex-col gap-1">
                    <span className="titulo text-xl" style={{ color: 'var(--dorado-claro)' }}>{c.nombre}</span>
                    <span style={{ color: 'var(--tenue)' }}>{c.curso}º de Primaria · {c.alumnos} {c.alumnos === 1 ? 'alumno' : 'alumnos'}</span>
                    <span className="text-sm mt-2" style={{ color: 'var(--tenue)' }}>Código para entrar</span>
                    <span className="titulo text-3xl tracking-[0.25em]" style={{ color: 'var(--dorado)' }}>{c.codigo}</span>
                    <span className="enlace mt-2">Ver resultados</span>
                  </a></li>
                ))}
              </ul>
            )}
        </section>

        <form className="panel flex flex-col sm:flex-row gap-3 sm:items-end" onSubmit={crear}>
          <label className="flex flex-col gap-2 font-semibold flex-1">Nombre de la clase
            <input className="campo" value={nueva.nombre} maxLength={40} placeholder="Por ejemplo: 6ºB…" onChange={e => setNueva({ ...nueva, nombre: e.target.value })} />
          </label>
          <label className="flex flex-col gap-2 font-semibold">Curso
            <select className="campo" value={nueva.curso} onChange={e => setNueva({ ...nueva, curso: Number(e.target.value) })}>
              {[3, 4, 5, 6].map(c => <option key={c} value={c}>{c}º de Primaria</option>)}
            </select>
          </label>
          <button className="btn-oro" type="submit">Crear clase</button>
        </form>
        <p role="alert" className="m-0 min-h-[1.4rem] font-bold" style={{ color: '#ff9aa6' }}>{error}</p>
        </>)}
      </main>
    </div>
  );
}
