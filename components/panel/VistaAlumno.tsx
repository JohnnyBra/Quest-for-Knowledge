import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { CifrasGrandes, BarrasMaterias } from './Cifras';
import { veces, type FichaAlumno, type Pregunteo } from './tipos';

type Aviso = { bien: boolean; texto: string } | null;

function ListaPreguntas({ items, detalle }: { items: Pregunteo[]; detalle: (p: Pregunteo) => string }) {
  if (!items.length) return <p className="m-0" style={{ color: 'var(--tenue)' }}>Ninguna por ahora.</p>;
  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-3">
      {items.map(p => (
        <li key={p.pregunta_id} className="ficha">
          <p className="m-0 font-semibold">{p.texto}</p>
          <p className="m-0 text-sm" style={{ color: 'var(--tenue)' }}>{p.materia}. {detalle(p)}</p>
        </li>
      ))}
    </ul>
  );
}

export default function VistaAlumno({ id }: { id: number }) {
  const [datos, setDatos] = useState<FichaAlumno | null>(null);
  const [error, setError] = useState('');
  const [curso, setCurso] = useState(0);
  const [clave, setClave] = useState('');
  const [aviso, setAviso] = useState<Aviso>(null);
  const [confirmar, setConfirmar] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (datos) titulo.current?.focus(); }, [!!datos]);
  useEffect(() => { if (confirmar) cancelar.current?.focus(); }, [confirmar]);

  const cargar = () => api<FichaAlumno>(`/api/alumnos/${id}`).then(d => { setDatos(d); setCurso(d.alumno.curso); }).catch(e => setError(e.message));
  useEffect(() => { cargar(); }, [id]);

  if (error) return <p role="alert" className="panel font-bold" style={{ color: '#ff9aa6' }}>{error} <a className="enlace" href="#/">Volver a mis clases</a></p>;
  if (!datos) return <p className="panel" style={{ color: 'var(--tenue)' }}>Cargando la ficha…</p>;
  const { alumno, total, materias, pendientes, aprendidas, cursosPosibles } = datos;

  const hacer = async (accion: () => Promise<unknown>, bien: string) => {
    setAviso(null);
    try { await accion(); setAviso({ bien: true, texto: bien }); }
    catch (e) { setAviso({ bien: false, texto: (e as Error).message }); }
  };
  const guardarCurso = () => hacer(async () => { await api(`/api/alumnos/${id}`, { curso }, 'PUT'); await cargar(); },
    `Hecho. Desde ahora a ${alumno.nombre} le salen preguntas de ${curso}º.`);
  const ponerClave = () => hacer(async () => { await api(`/api/alumnos/${id}`, { clave }, 'PUT'); setClave(''); },
    `Contraseña cambiada. Díselo a ${alumno.nombre}: su usuario es ${alumno.usuario}.`);
  const quitar = () => hacer(async () => { await api(`/api/alumnos/${id}`, undefined, 'DELETE'); location.replace(`#/clase/${alumno.clase.id}`); }, ''); // replace: sin dejar en el historial la ficha borrada

  return (
    <div className="flex flex-col gap-6">
      <div>
        <a className="miga" href={`#/clase/${alumno.clase.id}`}>← {alumno.clase.nombre}</a>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mt-2">
          <h2 ref={titulo} tabIndex={-1} className="m-0 text-[clamp(1.8rem,4vw,2.6rem)] outline-none" style={{ color: 'var(--dorado)' }}>{alumno.nombre}</h2>
          <p className="m-0" style={{ color: 'var(--tenue)' }}>
            Usuario <strong style={{ color: 'var(--texto)' }}>{alumno.usuario}</strong>. Juega con preguntas de {alumno.curso}º
            {alumno.curso < alumno.cursoClase ? ` (su clase es de ${alumno.cursoClase}º)` : ''}.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="panel"><h3 className="panel-titulo">Resumen</h3><CifrasGrandes c={total} /></section>
        <section className="panel"><h3 className="panel-titulo">Por materia</h3><BarrasMaterias materias={materias} /></section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <h3 className="panel-titulo">Aún por aprender</h3>
          <ListaPreguntas items={pendientes} detalle={p => `La ha fallado ${veces(p.fallos)}.`} />
        </section>
        <section className="panel">
          <h3 className="panel-titulo">Aprendidas</h3>
          <ListaPreguntas items={aprendidas} detalle={p => `La falló al principio y la acertó al ${p.intentos}º intento.`} />
        </section>
      </div>

      <section className="panel flex flex-col gap-5">
        <h3 className="panel-titulo">Ajustes</h3>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex flex-col gap-2 font-semibold">Curso de sus preguntas
            <select className="campo" value={curso} onChange={e => setCurso(Number(e.target.value))}>
              {cursosPosibles.map(c => <option key={c} value={c}>{c}º{c === alumno.cursoClase ? ' (el de la clase)' : ''}</option>)}
            </select>
          </label>
          <button className="btn-cuero" onClick={guardarCurso} disabled={curso === alumno.curso}>Guardar curso</button>
        </div>
        {cursosPosibles.length === 1 && (
          <p className="m-0 -mt-2 text-sm" style={{ color: 'var(--tenue)' }}>Cuando estén las preguntas de los cursos anteriores podrás bajarle el curso.</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex flex-col gap-2 font-semibold flex-1">Contraseña nueva
            <input className="campo" type="text" autoComplete="off" spellCheck={false} value={clave} onChange={e => setClave(e.target.value)} placeholder="Al menos 4 caracteres…" />
          </label>
          <button className="btn-cuero" onClick={ponerClave} disabled={!clave.trim()}>Poner contraseña</button>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t" style={{ borderColor: 'var(--borde)' }}>
          {confirmar ? (<>
            <span className="font-semibold">¿Seguro? Se borran todas sus respuestas.</span>
            <button className="btn-peligro" onClick={quitar}>Sí, quitar de la clase</button>
            <button ref={cancelar} className="btn-cuero" onClick={() => setConfirmar(false)}>Cancelar</button>
          </>) : (
            <button className="btn-peligro" onClick={() => setConfirmar(true)}>Quitar de la clase</button>
          )}
        </div>
        {/* Siempre montados: los lectores de pantalla solo anuncian los cambios de una región que ya existía */}
        <p role="status" className="m-0 font-bold empty:hidden" style={{ color: 'var(--verde)' }}>{aviso?.bien ? aviso.texto : ''}</p>
        <p role="alert" className="m-0 font-bold empty:hidden" style={{ color: '#ff9aa6' }}>{aviso && !aviso.bien ? aviso.texto : ''}</p>
      </section>
    </div>
  );
}
