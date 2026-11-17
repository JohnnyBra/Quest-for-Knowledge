import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Icono } from './RetroUI';

interface Score {
  name: string;
  score: number;
  level: number;
  date: string;
}

interface LeaderboardProps {
  onClose: () => void;
}

const COPAS = ['#f6d27a', '#d6dde6', '#e0915a'];

export default function Leaderboard({ onClose }: LeaderboardProps) {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => setScores(Array.isArray(data) ? data : []))
      .catch(() => setFallo(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="velo z-[70]" onClick={onClose}>
      <div className="modal max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="titulo-ranking" onClick={e => e.stopPropagation()}>
        <div className="modal-cabecera">
          <span className="medallon pointer-events-none"><Icono nombre="medalla" /></span>
          <h2 id="titulo-ranking">Salón de los héroes</h2>
          <button className="medallon" onClick={onClose} aria-label="Cerrar" autoFocus><X size={22} /></button>
        </div>
        <div className="modal-cuerpo scroll-fino">
          {loading ? (
            <p className="text-center py-10 animate-pulse" style={{ color: 'var(--dorado)' }}>Cargando…</p>
          ) : fallo ? (
            <p className="text-center py-10" style={{ color: '#ff9aa6' }}>No se ha podido cargar el ranking. Inténtalo más tarde.</p>
          ) : scores.length === 0 ? (
            <p className="text-center py-10" style={{ color: 'var(--tenue)' }}>Todavía no hay héroes en el salón. ¡Sé el primero!</p>
          ) : (
            <ol className="m-0 p-0 list-none grid gap-2">
              {scores.map((s, i) => (
                <li key={i} className="ficha flex items-center gap-3" style={i < 3 ? { borderColor: COPAS[i] } : undefined}>
                  <span className="titulo w-9 h-9 shrink-0 grid place-items-center rounded-full"
                    style={i < 3 ? { background: COPAS[i], color: '#2a1a00' } : { background: 'var(--roca)', color: 'var(--tenue)' }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0 truncate font-bold">{s.name}</span>
                  <span className="text-sm shrink-0" style={{ color: 'var(--tenue)' }}>Nivel {s.level}</span>
                  <span className="titulo shrink-0 tabular-nums" style={{ color: 'var(--dorado-claro)' }}>{s.score.toLocaleString('es-ES')}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
