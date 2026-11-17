import React, { useState } from 'react';
import { Estandarte, Fondo } from './RetroUI';
import { SKINS, getHeroArt } from '../heroes';

interface LoginScreenProps {
  onLogin: (name: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Escribe tu nombre para empezar.');
      return;
    }
    if (name.length > 15) {
      setError('El nombre es demasiado largo (máximo 15 letras).');
      return;
    }
    onLogin(name.trim());
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

        <form onSubmit={handleSubmit} className="panel entrar w-full max-w-md mx-auto flex flex-col gap-5" noValidate>
          <div>
            <h2 className="panel-titulo">Identifícate, héroe</h2>
            <p className="text-[1.05rem]" style={{ color: 'var(--tenue)' }}>
              El caos ha borrado el saber del mundo. Escribe tu nombre para empezar la aventura y entrar en el ranking.
            </p>
          </div>

          <label className="flex flex-col gap-2 font-semibold">
            Tu nombre
            <input
              type="text"
              name="nombre"
              autoComplete="off"
              spellCheck={false}
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="Por ejemplo: Lucía…"
              className="campo"
              aria-invalid={!!error}
              aria-describedby="error-nombre"
              autoFocus={typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches}
            />
          </label>

          <p id="error-nombre" role="alert" className="min-h-[1.4rem] font-bold" style={{ color: '#ff9aa6' }}>{error}</p>

          <button type="submit" className="btn-oro w-full">Comenzar la aventura</button>

          <p className="creditos text-center pt-3 border-t" style={{ borderColor: 'var(--borde)' }}>Creado por Javi Barrero</p>
        </form>
      </main>
    </div>
  );
}
