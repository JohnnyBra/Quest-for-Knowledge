import React, { useState, useEffect, useRef } from 'react';
import { Player, Enemy, Question, Subject } from '../types';
import { generateEducationalContent } from '../services/geminiService';
import { Calculator, Book, Globe, Heart } from 'lucide-react';

interface BattleProps {
  player: Player;
  enemy: Enemy;
  onVictory: (xp: number, remainingHp: number, stats: { correct: number, incorrect: number, superEffective: number }) => void;
  onDefeat: () => void;
  onHpUpdate: (newHp: number) => void;
}

type BattlePhase = 'INIT' | 'SELECT_SUBJECT' | 'GENERATING_QUESTION' | 'ANSWERING' | 'RESULT_PLAYER' | 'ENEMY_TURN' | 'RESULT_ENEMY';

const Battle: React.FC<BattleProps> = ({ player, enemy, onVictory, onDefeat, onHpUpdate }) => {
  const [phase, setPhase] = useState<BattlePhase>('INIT');
  const [question, setQuestion] = useState<Question | null>(null);
  const [message, setMessage] = useState(`¡${enemy.name} ataca!`);
  const [enemyHp, setEnemyHp] = useState(enemy.maxHp);
  const [playerHp, setPlayerHp] = useState(player.hp);

  const [playerAnim, setPlayerAnim] = useState('');
  const [enemyAnim, setEnemyAnim] = useState('');

  const [battleStats, setBattleStats] = useState({ correct: 0, incorrect: 0, superEffective: 0 });

  const askedQuestionsRef = useRef<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('SELECT_SUBJECT');
      setMessage("¡Elige una materia para lanzar tu ataque!");
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSubjectSelect = async (subject: Subject) => {
    setPhase('GENERATING_QUESTION');
    setMessage(`Cargando pregunta de ${subject}...`);
    try {
      const q = await generateEducationalContent(
        enemy.isBoss ? 'boss' : 'combat',
        subject,
        askedQuestionsRef.current
      );
      setQuestion(q);
      askedQuestionsRef.current.push(q.text);
      setPhase('ANSWERING');
      setMessage(q.text);
    } catch (e) {
      setPhase('SELECT_SUBJECT');
      setMessage("Error mágico. Intenta otra vez.");
    }
  };

  const handleAnswer = (index: number) => {
    if (!question) return;

    if (index === question.correctIndex) {
      const attackPower = player.stats.attack;
      const isWeakness = question.subject === enemy.weakness;
      const variance = (Math.random() * 0.4) + 0.8;

      let finalDamage = Math.floor(attackPower * variance);
      if (isWeakness) {
        finalDamage = Math.floor(finalDamage * 1.5);
        setBattleStats(s => ({ ...s, correct: s.correct + 1, superEffective: s.superEffective + 1 }));
      } else {
        setBattleStats(s => ({ ...s, correct: s.correct + 1 }));
      }

      setPlayerAnim('anim-atk-player');
      setTimeout(() => {
        setPlayerAnim('');
        setEnemyAnim('anim-dmg');

        const newHp = Math.max(0, enemyHp - finalDamage);
        setEnemyHp(newHp);

        const weakText = isWeakness ? " ¡Súper efectivo!" : "";
        setMessage(`¡Correcto!${weakText} Daño: ${finalDamage}`);

        setTimeout(() => {
          setEnemyAnim('');
          setPhase('RESULT_PLAYER');
        }, 400);

      }, 150);

    } else {
      setBattleStats(s => ({ ...s, incorrect: s.incorrect + 1 }));
      setMessage(`Fallo... La respuesta era: ${question.options[question.correctIndex]}`);
      setPhase('RESULT_PLAYER');
    }
  };

  const handleContinue = () => {
    if (phase === 'RESULT_PLAYER') {
      if (enemyHp === 0) {
        onVictory(enemy.isBoss ? 500 : 50, playerHp, battleStats);
      } else {
        setPhase('ENEMY_TURN');
        setMessage(`${enemy.name} ataca...`);
        setTimeout(() => {
          setEnemyAnim('anim-atk-enemy');

          setTimeout(() => {
            setEnemyAnim('');
            setPlayerAnim('anim-dmg');

            // REDUCED DAMAGE FORMULA
            // Old: 5 + (diff * 3) + random(5)
            // New: 2 + (diff * 2) + random(3)
            const baseEnemyDmg = 2 + (enemy.difficulty * 2);
            const variance = Math.ceil(Math.random() * 3);
            // Ensure at least 1 damage unless defense is extremely high
            const totalDmg = Math.max(1, (baseEnemyDmg + variance) - Math.floor(player.stats.defense / 2));

            const newPlayerHp = Math.max(0, playerHp - totalDmg);
            setPlayerHp(newPlayerHp);
            onHpUpdate(newPlayerHp);
            setMessage(`¡Te golpea! -${totalDmg} HP`);

            setTimeout(() => {
              setPlayerAnim('');
              setPhase('RESULT_ENEMY');
            }, 400);

          }, 150);

        }, 1000);
      }
    } else if (phase === 'RESULT_ENEMY') {
      if (playerHp === 0) {
        onDefeat();
      } else {
        setPhase('SELECT_SUBJECT');
        setMessage("¡Tu turno! Elige materia.");
      }
    }
  };

  const renderHearts = (current: number, max: number) => {
    const heartCount = 5;
    const percentage = Math.max(0, current / max);
    const filled = Math.ceil(percentage * heartCount);
    return (
      <div className="flex gap-1">
        {[...Array(heartCount)].map((_, i) => (
          <Heart key={i} size={16} className={`${i < filled ? "text-red-500 fill-current" : "text-gray-800 fill-gray-900"} drop-shadow-sm`} />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 w-full max-w-5xl mx-auto border-4 border-[#111] md:border-[#2d2d2d] bg-[#1a1a1a] rounded-lg shadow-2xl overflow-hidden font-retro min-h-[60vh] md:min-h-[500px]">

      {/* 1. SCENE AREA */}
      <div className="relative flex-1 min-h-[40vh] md:min-h-0 w-full overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#2e1065_0%,#7c3aed_40%,#db2777_70%,#f59e0b_100%)]"></div>
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-24 h-24 bg-yellow-200 rounded-full blur-sm opacity-90 mix-blend-screen"></div>
        <div className="absolute bottom-0 w-full h-12 bg-[#0f172a] z-0" style={{ clipPath: "polygon(0% 100%, 0% 20%, 15% 35%, 30% 15%, 50% 40%, 70% 20%, 85% 30%, 100% 10%, 100% 100%)" }}></div>

        <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-20 px-2">
          <div className="flex flex-col bg-black/40 p-1 rounded backdrop-blur-sm border border-white/10">
            <span className="text-[10px] text-white font-bold drop-shadow-md mb-1">{enemy.name}</span>
            {renderHearts(enemyHp, enemy.maxHp)}
            <div className="w-full bg-gray-700 h-1 mt-1 rounded-full overflow-hidden">
              <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${(enemyHp / enemy.maxHp) * 100}%` }}></div>
            </div>
          </div>
          <div className="flex flex-col items-end bg-black/40 p-1 rounded backdrop-blur-sm border border-white/10">
            <span className="text-[10px] text-white font-bold drop-shadow-md mb-1">{player.name}</span>
            {renderHearts(playerHp, player.maxHp)}
            <div className="w-full bg-gray-700 h-1 mt-1 rounded-full overflow-hidden">
              <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${(playerHp / player.maxHp) * 100}%` }}></div>
            </div>
          </div>
        </div>

        <div className={`absolute bottom-4 left-4 md:left-24 z-10 ${enemyAnim === 'anim-atk-enemy' ? 'anim-atk-enemy' : ''} ${enemyAnim === 'anim-dmg' ? 'anim-dmg' : 'animate-bounce-slow'}`}>
          <img src={enemy.sprite} alt="Enemy" className="w-24 h-24 md:w-48 md:h-48 object-contain drop-shadow-2xl" style={{ imageRendering: 'pixelated', transform: 'scaleX(-1)' }} />
        </div>

        <div className={`absolute bottom-4 right-4 md:right-24 z-10 ${playerAnim} ${playerAnim === '' ? 'animate-bounce-slow' : ''}`}>
          <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/475.gif" alt="Player" className="w-24 h-24 md:w-48 md:h-48 object-contain drop-shadow-2xl" style={{ imageRendering: 'pixelated' }} />
        </div>

        {(phase === 'RESULT_PLAYER' || phase === 'RESULT_ENEMY') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-30">
            <button onClick={handleContinue} className="bg-yellow-500 border-b-4 border-yellow-700 text-black font-bold py-3 px-8 rounded animate-pulse shadow-xl hover:bg-yellow-400 text-sm md:text-base">
              CONTINUAR
            </button>
          </div>
        )}
      </div>

      {/* 2. MESSAGE BOX */}
      <div className="bg-[#3b82f6] border-y-4 border-[#1e40af] p-3 w-full min-h-[80px] flex items-center justify-center relative shadow-lg z-10">
        <div className="w-full max-w-full px-2 text-center">
          <p className="text-white text-[11px] md:text-sm font-bold tracking-wide drop-shadow-md leading-relaxed inline-block w-full">
            {message}
          </p>
        </div>
      </div>

      {/* 3. ACTION DECK */}
      <div className="flex-1 bg-[#222] p-3 flex flex-col justify-center overflow-hidden">

        {phase === 'SELECT_SUBJECT' && (
          <div className="grid grid-cols-3 gap-2 md:gap-3 h-full max-h-[180px]">
            <button onClick={() => handleSubjectSelect(Subject.MATH)} className="bg-gradient-to-b from-amber-600 to-amber-800 border-2 border-amber-400 rounded-lg flex flex-col items-center justify-center gap-2 p-1 active:scale-95 transition-transform shadow-[0_4px_0_rgb(146,64,14)] active:shadow-none active:translate-y-[4px] group">
              <Calculator className="text-amber-200" size={24} />
              <span className="text-[8px] md:text-[10px] font-bold text-amber-100 uppercase text-center">Matemáticas</span>
            </button>

            <button onClick={() => handleSubjectSelect(Subject.LANGUAGE)} className="bg-gradient-to-b from-rose-700 to-rose-900 border-2 border-rose-400 rounded-lg flex flex-col items-center justify-center gap-2 p-1 active:scale-95 transition-transform shadow-[0_4px_0_rgb(159,18,57)] active:shadow-none active:translate-y-[4px] group">
              <Book className="text-rose-200" size={24} />
              <span className="text-[8px] md:text-[10px] font-bold text-rose-100 uppercase text-center">Lengua</span>
            </button>

            <button onClick={() => handleSubjectSelect(Subject.KNOWLEDGE)} className="bg-gradient-to-b from-emerald-700 to-emerald-900 border-2 border-emerald-400 rounded-lg flex flex-col items-center justify-center gap-2 p-1 active:scale-95 transition-transform shadow-[0_4px_0_rgb(6,78,59)] active:shadow-none active:translate-y-[4px] group">
              <Globe className="text-emerald-200" size={24} />
              <span className="text-[8px] md:text-[10px] font-bold text-emerald-100 uppercase text-center">C. del Medio</span>
            </button>
          </div>
        )}

        {phase === 'ANSWERING' && question && (
          <div className="flex flex-col gap-2 h-full overflow-y-auto pr-1 custom-scrollbar pb-2">
            {question.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                className="w-full bg-[#333] hover:bg-[#444] border-l-4 border-[#555] hover:border-yellow-500 text-white text-[10px] md:text-sm py-2.5 px-3 rounded-r text-left shadow-sm active:bg-[#222] transition-colors leading-tight"
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {(phase !== 'SELECT_SUBJECT' && phase !== 'ANSWERING') && (
          <div className="flex items-center justify-center h-full text-gray-500 text-xs animate-pulse">
            ...
          </div>
        )}

      </div>
    </div>
  );
};

export default Battle;