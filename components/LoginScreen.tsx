import React, { useState } from 'react';
import { Estandarte, Fondo } from './RetroUI';
import { SKINS, getHeroArt } from '../heroes';
import { api, type Yo } from '../services/api';

type Modo = 'entrar' | 'registro' | 'docente' | 'docente-registro';
type Campo = 'codigo' | 'invitacion' | 'nombre' | 'usuario' | 'clave';

const CAMPOS: Record<Modo, Campo[]> = {
  entrar: ['usuario', 'clave'],
  registro: ['codigo', 'nombre', 'usuario', 'clave'],
  docente: ['usuario', 'clave'],
  'docente-registro': ['invitacion', 'nombre', 'usuario', 'clave'],
};
const ETIQUETA: Record<Campo, string> = { codigo: 'Código de la clase', invitacion: 'Código de invitación', nombre: 'Tu nombre', usuario: 'Usuario', clave: 'Contraseña' };
const TITULO: Record<Modo, string> = { entrar: 'Identifícate, héroe', registro: 'Únete a tu clase', docente: 'Entrada del maestro', 'docente-registro': 'Alta de docente' };
const AYUDA: Record<Modo, string> = {
  entrar: 'Escribe tu usuario y tu contraseña para seguir la aventura.',
  registro: 'Tu maestro o maestra te dará el código de la clase. Solo se hace una vez.',
  docente: 'Entra para ver tus clases y sus códigos.',
  'docente-registro': 'Necesitas el código de invitación del centro.',
};
const EJEMPLO: Partial<Record<Campo, string>> = { codigo: 'Por ejemplo: K7M2PQ', nombre: 'Por ejemplo: Lucía', usuario: 'Por ejemplo: lucia.g' };

const autocompletar = (campo: Campo, modo: Modo) =>
  campo === 'usuario' ? 'username' : campo === 'clave' ? (modo.includes('registro') ? 'new-password' : 'current-password') : 'off';

// aviso: en vez del formulario, un mensaje con un botón (cuentas del Gremio: Quest cerrado para la clase, portal sin contestar).
export type Aviso = { titulo: string; texto: string; enlace: string; boton: string };
export default function LoginScreen({ onEntrar, aviso }: { onEntrar: (yo: Yo) => void; aviso?: Aviso }) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [datos, setDatos] = useState<Partial<Record<Campo, string>>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const docente = modo === 'docente' || modo === 'docente-registro';
  const alta = modo === 'registro' || modo === 'docente-registro';

  const cambiar = (m: Modo) => { setModo(m); setError(''); };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const falta = CAMPOS[modo].find(c => !datos[c]?.trim());
    if (falta) return setError(`Falta: ${ETIQUETA[falta].toLowerCase()}.`);
    setEnviando(true); setError('');
    try {
      const ruta = modo === 'registro' ? '/api/alumno/registro' : modo === 'docente-registro' ? '/api/docente/registro' : '/api/entrar';
      await api(ruta, { ...datos, rol: docente ? 'docente' : 'alumno' });
      onEntrar(await api<Yo>('/api/yo'));
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Fondo />
      <header className="cabecera capa">
        <h1>Quest for Knowledge</h1>
        <Estandarte />
        <span className="creditos text-right">Creado por Javi Barrero</span>
      </header>

      <main className="capa flex-1 w-full max-w-5xl mx-auto px-4 pt-20 md:pt-24 pb-10 grid md:grid-cols-2 gap-2 md:gap-8 items-center">
        <div className="escenario entrar w-full max-w-[420px] md:max-w-none mx-auto" aria-hidden="true">
          <div className="flex justify-center items-end">
            {SKINS.map((s, i) => (
              <img key={s.id} className="heroe-img flotar relative w-[29%] -mx-[2%]" style={{ animationDelay: `${i * 0.7}s`, zIndex: i === 1 || i === 2 ? 2 : 1 }}
                src={getHeroArt({ skin: s.id, genero: i % 2 ? 'chica' : 'chico' }, 1)} alt="" />
            ))}
          </div>
        </div>

        {aviso ? (
          <div className="panel entrar w-full max-w-md mx-auto flex flex-col gap-4 text-center">
            <h2 className="panel-titulo">{aviso.titulo}</h2>
            <p className="m-0 text-[1.05rem]" style={{ color: 'var(--tenue)' }}>{aviso.texto}</p>
            <a className="btn-oro w-full no-underline" href={aviso.enlace}>{aviso.boton}</a>
            <p className="creditos text-center pt-3 border-t" style={{ borderColor: 'var(--borde)' }}>Creado por Javi Barrero</p>
          </div>
        ) : (
        <form onSubmit={enviar} className="panel entrar w-full max-w-md mx-auto flex flex-col gap-4" noValidate>
          {!docente && (
            <div className="pestanas" role="tablist" aria-label="Cómo quieres entrar">
              <button type="button" role="tab" aria-selected={modo === 'entrar'} onClick={() => cambiar('entrar')}>Entrar</button>
              <button type="button" role="tab" aria-selected={modo === 'registro'} onClick={() => cambiar('registro')}>Tengo un código de clase</button>
            </div>
          )}

          <div>
            <h2 className="panel-titulo">{TITULO[modo]}</h2>
            <p className="m-0 text-[1.05rem]" style={{ color: 'var(--tenue)' }}>{AYUDA[modo]}</p>
          </div>

          {CAMPOS[modo].map((campo, i) => (
            <label key={`${modo}-${campo}`} className="flex flex-col gap-2 font-semibold">
              {ETIQUETA[campo]}
              <input
                type={campo === 'clave' ? 'password' : 'text'}
                name={campo}
                className="campo"
                autoComplete={autocompletar(campo, modo)}
                autoCapitalize={campo === 'codigo' ? 'characters' : 'off'}
                style={campo === 'codigo' ? { textTransform: 'uppercase' } : undefined}
                spellCheck={false}
                placeholder={EJEMPLO[campo] ? `${EJEMPLO[campo]}…` : undefined}
                value={datos[campo] ?? ''}
                onChange={e => { setDatos({ ...datos, [campo]: e.target.value }); setError(''); }}
                aria-invalid={!!error}
                aria-describedby="error-entrada"
                autoFocus={i === 0 && typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches}
              />
            </label>
          ))}

          <p id="error-entrada" role="alert" className="m-0 min-h-[1.4rem] font-bold" style={{ color: '#ff9aa6' }}>{error}</p>

          <button type="submit" className="btn-oro w-full" disabled={enviando}>
            {enviando ? 'Un momento…' : alta ? 'Crear mi cuenta' : 'Entrar'}
          </button>

          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            {docente ? (
              <>
                <button type="button" className="enlace" onClick={() => cambiar(modo === 'docente' ? 'docente-registro' : 'docente')}>
                  {modo === 'docente' ? '¿Primera vez? Darme de alta' : 'Ya tengo cuenta'}
                </button>
                <button type="button" className="enlace" onClick={() => cambiar('entrar')}>Volver al alumnado</button>
              </>
            ) : (
              <button type="button" className="enlace" onClick={() => cambiar('docente')}>Soy docente</button>
            )}
          </div>

          <p className="creditos text-center pt-3 border-t" style={{ borderColor: 'var(--borde)' }}>Creado por Javi Barrero</p>
        </form>
        )}
      </main>
    </div>
  );
}
