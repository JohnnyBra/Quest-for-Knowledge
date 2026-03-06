import React from 'react';
import { X, BookOpen, Skull } from 'lucide-react';
import { ENEMY_TEMPLATES, BOSS_TEMPLATE } from '../constants';

interface GalleryProps {
  defeatedEnemies: string[];
  onClose: () => void;
}

const ALL_ENEMIES = [...ENEMY_TEMPLATES, BOSS_TEMPLATE];

export default function Gallery({ defeatedEnemies = [], onClose }: GalleryProps) {
  return (
    <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border-4 border-white w-full max-w-3xl rounded-lg p-0 relative shadow-2xl flex flex-col max-h-[85vh]">
        <div className="bg-purple-900 p-4 border-b-4 border-purple-700 flex justify-between items-center">
          <h2 className="text-yellow-400 text-base md:text-xl font-bold flex items-center gap-2">
            <BookOpen /> BESTIARIO ({(defeatedEnemies || []).length}/{ALL_ENEMIES.length})
          </h2>
          <button onClick={onClose} className="text-white hover:text-red-500">
            <X size={28} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar bg-[#111] grid grid-cols-2 md:grid-cols-3 gap-4">
          {ALL_ENEMIES.map((enemy, idx) => {
            const isDefeated = (defeatedEnemies || []).includes(enemy.name);
            return (
              <div key={idx} className={`border-2 rounded-lg p-3 flex flex-col items-center text-center transition-all ${isDefeated ? 'border-purple-500 bg-[#2a2a2a]' : 'border-gray-700 bg-[#161616] opacity-60'}`}>
                <div className="h-24 w-24 mb-2 flex items-center justify-center bg-black/40 rounded border border-gray-700 overflow-hidden">
                  {isDefeated ? (
                    <img src={enemy.spriteUrl} alt={enemy.name} className="w-20 h-20 object-contain drop-shadow-lg" style={{ imageRendering: 'pixelated', transform: 'scaleX(-1)' }} />
                  ) : (
                    <Skull className="text-gray-600 animate-pulse" size={40} />
                  )}
                </div>
                <h3 className={`text-xs md:text-sm font-bold ${isDefeated ? 'text-white' : 'text-gray-500'}`}>
                  {isDefeated ? enemy.name : '???'}
                </h3>
                {isDefeated && (
                  <p className="text-[9px] md:text-[10px] text-gray-400 mt-2 italic leading-tight">
                    {enemy.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
