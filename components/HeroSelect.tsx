import React, { useState } from 'react';
import { SKINS, getHeroArt, HeroChoice, Genero } from '../heroes';

interface HeroSelectProps {
  nombre: string;
  inicial: HeroChoice;
  onElegir: (hero: HeroChoice) => void;
}

export default function HeroSelect({ nombre, inicial, onElegir }: HeroSelectProps) {
  const [hero, setHero] = useState<HeroChoice>(inicial);
  const skin = SKINS.find(s => s.id === hero.skin)!;

  return (
    <div className="w-full max-w-5xl mx-auto px-2 entrar">
      <div className="text-center mb-5">
        <h2 className="m-0 text-[clamp(1.5rem,4vw,2.4rem)]" style={{ color: 'var(--dorado)', textShadow: '0 0 22px rgba(232,184,74,.4)' }}>
          Elige tu héroe, {nombre}
        </h2>
        <p className="mt-1" style={{ color: 'var(--tenue)' }}>Cada héroe evoluciona dos veces: en el nivel 4 y en el nivel 7.</p>
        <div className="genero mt-4" role="group" aria-label="Chico o chica">
          {(['chico', 'chica'] as Genero[]).map(g => (
            <button key={g} type="button" aria-pressed={hero.genero === g} onClick={() => setHero({ ...hero, genero: g })}>
              {g === 'chico' ? 'Chico' : 'Chica'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" role="group" aria-label="Héroes">
        {SKINS.map(s => (
          <button key={s.id} type="button" className="carta" aria-pressed={hero.skin === s.id} onClick={() => setHero({ ...hero, skin: s.id })}>
            <img src={getHeroArt({ skin: s.id, genero: hero.genero }, 1)} alt="" />
            <h3>{s.nombre[hero.genero]}</h3>
            <small>{s.formas.join(' → ')}</small>
          </button>
        ))}
      </div>
      <div className="flex flex-col items-center gap-1 mt-5">
        <p className="m-0 text-center" style={{ color: 'var(--tenue)' }}><em>{skin.lema}</em></p>
        <button type="button" className="btn-oro w-full max-w-sm" onClick={() => onElegir(hero)}>Jugar como {skin.nombre[hero.genero]}</button>
      </div>
    </div>
  );
}
