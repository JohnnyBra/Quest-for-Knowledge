import React from 'react';
import { X } from 'lucide-react';
import { ENEMY_TEMPLATES, BOSS_TEMPLATE } from '../constants';
import { Icono } from './RetroUI';

interface GalleryProps {
  defeatedEnemies: string[];
  onClose: () => void;
}

const ALL_ENEMIES = [...ENEMY_TEMPLATES, BOSS_TEMPLATE];

export default function Gallery({ defeatedEnemies = [], onClose }: GalleryProps) {
  const vistos = defeatedEnemies || [];
  return (
    <div className="velo z-[70]" onClick={onClose}>
      <div className="modal max-w-3xl" role="dialog" aria-modal="true" aria-labelledby="titulo-bestiario" onClick={e => e.stopPropagation()}>
        <div className="modal-cabecera">
          <span className="medallon pointer-events-none"><Icono nombre="libro" /></span>
          <h2 id="titulo-bestiario">Bestiario <small className="text-base" style={{ color: 'var(--tenue)' }}>{vistos.length} / {ALL_ENEMIES.length}</small></h2>
          <button className="medallon" onClick={onClose} aria-label="Cerrar"><X size={22} /></button>
        </div>

        <div className="modal-cuerpo scroll-fino grid grid-cols-2 md:grid-cols-3 gap-3">
          {ALL_ENEMIES.map((enemy, idx) => {
            const visto = vistos.includes(enemy.name);
            return (
              <div key={idx} className="ficha flex flex-col items-center text-center" style={visto ? { borderColor: 'var(--marco)' } : { opacity: 0.6 }}>
                <div className="w-24 h-24 mb-2 grid place-items-center rounded-full" style={{ background: 'radial-gradient(circle at 50% 35%, #3a2f5c, var(--roca))', boxShadow: 'inset 0 0 0 2px var(--borde)' }}>
                  {visto ? (
                    <img src={enemy.spriteUrl} alt="" className="w-20 h-20 object-contain" style={{ imageRendering: 'pixelated', transform: 'scaleX(-1)' }} />
                  ) : (
                    <span className="titulo text-4xl" style={{ color: 'var(--borde)' }}>?</span>
                  )}
                </div>
                <h3 className="m-0 text-[0.95rem]" style={{ color: visto ? 'var(--dorado-claro)' : 'var(--tenue)' }}>{visto ? enemy.name : '???'}</h3>
                {visto && <p className="text-sm mt-1 mb-0" style={{ color: 'var(--tenue)' }}>{enemy.description}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
