import React, { useEffect, useState } from 'react';
import { RetroBox, RetroButton } from './RetroUI';
import { Trophy, User, Calendar } from 'lucide-react';

interface Score {
  name: string;
  score: number;
  level: number;
  date: string;
}

interface LeaderboardProps {
  onClose: () => void;
}

export default function Leaderboard({ onClose }: LeaderboardProps) {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setScores(data);
        } else {
          console.error('Invalid leaderboard data format', data);
          setScores([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch leaderboard', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4">
      <RetroBox title="TABLA DE CLASIFICACIÓN" className="w-full max-w-2xl bg-[#1a1a1a] border-yellow-500 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {loading ? (
            <div className="text-center text-yellow-500 animate-pulse py-10">CARGANDO...</div>
          ) : scores.length === 0 ? (
            <div className="text-center text-gray-500 py-10">NO HAY REGISTROS AÚN</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-yellow-500 border-b-2 border-yellow-700 text-[10px] md:text-xs uppercase tracking-wider">
                  <th className="p-2">#</th>
                  <th className="p-2">Héroe</th>
                  <th className="p-2 text-right">Nivel</th>
                  <th className="p-2 text-right">Puntuación</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score, index) => (
                  <tr key={index} className={`border-b border-gray-800 hover:bg-white/5 transition-colors ${index < 3 ? 'text-yellow-200 font-bold' : 'text-gray-300'}`}>
                    <td className="p-2 flex items-center gap-2">
                      {index === 0 && <Trophy size={14} className="text-yellow-400" />}
                      {index === 1 && <Trophy size={14} className="text-gray-400" />}
                      {index === 2 && <Trophy size={14} className="text-orange-400" />}
                      {index + 1}
                    </td>
                    <td className="p-2 truncate max-w-[120px] md:max-w-[200px]">{score.name}</td>
                    <td className="p-2 text-right">{score.level}</td>
                    <td className="p-2 text-right font-mono">{score.score.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 border-t-2 border-gray-800 flex justify-center">
          <RetroButton onClick={onClose} variant="primary">CERRAR</RetroButton>
        </div>
      </RetroBox>
    </div>
  );
}
