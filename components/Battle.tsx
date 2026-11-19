import React, { useState, useEffect, useRef } from 'react';
import { Player, Enemy, Subject } from '../types';
import { selector } from '../services/preguntas';
import { enviarRespuesta } from '../services/partida';
import type { Pregunta } from '../data/preguntas/index';
import { Calculator, Book, Globe, MessageCircle, Dumbbell } from 'lucide-react';
import { getHeroArt } from '../heroes';

interface BattleProps {
  player: Player;
  enemy: Enemy;
  onVictory: (xp: number, remainingHp: number, stats: { correct: number, incorrect: number, superEffective: number, timeBonus: number }) => void;
  onDefeat: () => void;
  onHpUpdate: (newHp: number) => void;
}

type BattlePhase = 'INIT' | 'SELECT_SUBJECT' | 'GENERATING_QUESTION' | 'ANSWERING' | 'RESULT_PLAYER' | 'ENEMY_TURN' | 'RESULT_ENEMY';

const Battle: React.FC<BattleProps> = ({ player, enemy, onVictory, onDefeat, onHpUpdate }) => {
  const [phase, setPhase] = useState<BattlePhase>('INIT');
  const [question, setQuestion] = useState<Pregunta | null>(null);
  const [message, setMessage] = useState(`¡${enemy.name} ataca!`);
  const [enemyHp, setEnemyHp] = useState(enemy.maxHp);
  const [playerHp, setPlayerHp] = useState(player.hp);

  const [playerAnim, setPlayerAnim] = useState('');
  const [enemyAnim, setEnemyAnim] = useState('');
  const [golpe, setGolpe] = useState<{ en: 'heroe' | 'enemigo'; texto: string; id: number } | null>(null);

  const [timeLeft, setTimeLeft] = useState(15);
  const maxTime = 15;

  // El temporizador llama a handleAnswer desde un cierre viejo: la pregunta en pantalla se lee de aquí.
  const preguntaRef = useRef<Pregunta | null>(null);
  const inicioRef = useRef(0);
  const respondidaRef = useRef(false);
  const criticoRef = useRef(false);   // este ataque puede ser crítico
  const segundaRef = useRef(false);   // está en pantalla la 2ª pregunta del crítico
  const mostrar = (q: Pregunta) => { preguntaRef.current = q; inicioRef.current = Date.now(); respondidaRef.current = false; setQuestion(q); };
  // StrictMode monta los efectos dos veces en desarrollo: el ref evita contar dos combates.
  const contadoRef = useRef(false);
  useEffect(() => { if (!contadoRef.current) { contadoRef.current = true; selector.nuevoCombate(); } }, []);

  const [battleStats, setBattleStats] = useState({ correct: 0, incorrect: 0, superEffective: 0, timeBonus: 0 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('SELECT_SUBJECT');
      setMessage("¡Elige una materia para lanzar tu ataque!");
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // ATB Timer
  useEffect(() => {
    if (phase === 'ANSWERING') {
      const interval = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(interval);
            handleAnswer(-1, true);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phase]);

  const handleSubjectSelect = (subject: Subject) => {
    const dificultad = enemy.isBoss ? 'boss' : 'explorer';
    const isCrit = Math.random() * 100 < (player.stats.critChance || 0);
    criticoRef.current = isCrit;
    segundaRef.current = false;

    const q = selector.elegir(subject, dificultad);
    mostrar(q);

    setPhase('ANSWERING');
    setTimeLeft(maxTime);
    setMessage(isCrit ? `¡OPORTUNIDAD DE CRÍTICO! Pregunta 1: ${q.text}` : q.text);
  };

  const handleAnswer = (index: number, isTimeout: boolean = false) => {
    const question = preguntaRef.current;
    if (!question || respondidaRef.current) return;
    respondidaRef.current = true;
    const correcta = !isTimeout && index === question.correctIndex;
    const segunda = segundaRef.current;
    selector.apuntar(question.id, correcta);
    enviarRespuesta(question.id, correcta, Date.now() - inicioRef.current);

    if (correcta) {
      if (criticoRef.current && !segunda) {
         // La 2ª pregunta se elige ahora: si falla la 1ª, no se gasta ninguna (ni una del repaso).
         segundaRef.current = true;
         const q2 = selector.elegir(question.subject, enemy.isBoss ? 'boss' : 'explorer');
         mostrar(q2);
         setTimeLeft(maxTime);
         setMessage(`¡Correcto! Fase 2 Crítica: ${q2.text}`);
         return;
      }

      const attackPower = player.stats.attack;
      const isWeakness = question.subject === enemy.weakness;
      const variance = (Math.random() * 0.4) + 0.8;

      let finalDamage = Math.floor(attackPower * variance);
      
      const timeBonusPoints = Math.max(0, timeLeft * 5); // Faster answers = more points

      if (isWeakness) {
        finalDamage = Math.floor(finalDamage * 1.5);
      }
      
      if (criticoRef.current && segunda) {
        finalDamage = Math.floor(finalDamage * 2.5); // CRITICAL HIT MULTIPLIER
      }

      if (isWeakness) {
        setBattleStats(s => ({ ...s, correct: s.correct + 1, superEffective: s.superEffective + 1, timeBonus: s.timeBonus + timeBonusPoints }));
      } else {
        setBattleStats(s => ({ ...s, correct: s.correct + 1, timeBonus: s.timeBonus + timeBonusPoints }));
      }

      setPlayerAnim('anim-atk-heroe');
      setTimeout(() => {
        setPlayerAnim('');
        setEnemyAnim('anim-dano');

        setGolpe({ en: 'enemigo', texto: `-${finalDamage}`, id: Date.now() });
        const newHp = Math.max(0, enemyHp - finalDamage);
        setEnemyHp(newHp);

        const weakText = isWeakness ? " ¡Súper efectivo!" : "";
        const critText = (criticoRef.current && segunda) ? " ¡GOLPE CRÍTICO!" : "";
        setMessage(`¡Correcto!${critText}${weakText} Daño: ${finalDamage}`);

        setTimeout(() => {
          setEnemyAnim('');
          setPhase('RESULT_PLAYER');
        }, 400);

      }, 150);

    } else {
      setBattleStats(s => ({ ...s, incorrect: s.incorrect + 1 }));
      let errorMsg = "";
      if (isTimeout) {
        errorMsg = `¡Se acabó el tiempo! La respuesta era: ${question.options[question.correctIndex]}`;
      } else {
        errorMsg = `Fallo... La respuesta era: ${question.options[question.correctIndex]}`;
      }
      
      if (criticoRef.current && segunda) {
         errorMsg = "¡Fallo en el golpe crítico! " + errorMsg;
      }
      setMessage(errorMsg);
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
          setEnemyAnim('anim-atk-enemigo');

          setTimeout(() => {
            setEnemyAnim('');
            setPlayerAnim('anim-dano');

            // REDUCED DAMAGE FORMULA
            // Old: 5 + (diff * 3) + random(5)
            // New: 2 + (diff * 2) + random(3)
            const baseEnemyDmg = 2 + (enemy.difficulty * 2);
            const variance = Math.ceil(Math.random() * 3);
            // Ensure at least 1 damage unless defense is extremely high
            const totalDmg = Math.max(1, (baseEnemyDmg + variance) - Math.floor(player.stats.defense / 2));

            setGolpe({ en: 'heroe', texto: `-${totalDmg}`, id: Date.now() });
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

  const MATERIAS = [
    { s: Subject.MATH, icono: <Calculator size={28} />, veta: '#ffb24a', desde: 1 },
    { s: Subject.LANGUAGE, icono: <Book size={28} />, veta: '#ff7a9a', desde: 1 },
    { s: Subject.KNOWLEDGE, icono: <Globe size={28} />, veta: '#6fe3a1', desde: 1 },
    { s: Subject.ENGLISH, icono: <MessageCircle size={28} />, veta: '#7fb6ff', desde: 4 },
    { s: Subject.PHYSICAL_ED, icono: <Dumbbell size={28} />, veta: '#ff9a4d', desde: 7 },
  ].filter(m => player.level >= m.desde);

  const Placa = ({ nombre, hp, max, color, alinear }: { nombre: string; hp: number; max: number; color: string; alinear: string }) => (
    <div className={`placa w-[min(46%,260px)] ${alinear}`}>
      <b>{nombre}</b>
      <div className="barra mt-1" style={{ height: 14 }} role="meter" aria-label={`Vida de ${nombre}`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp}>
        <i style={{ width: `${Math.max(0, (hp / max) * 100)}%`, background: color }} />
        <span style={{ fontSize: '0.66rem' }}>{hp} / {max}</span>
      </div>
    </div>
  );

  return (
    <div className="panel !p-0 flex flex-col flex-1 w-full max-w-5xl mx-auto overflow-hidden min-h-[60vh] md:min-h-[520px]">

      {/* 1. ESCENA */}
      <div className="arena relative flex-1 min-h-[42vh] md:min-h-[330px] w-full shrink-0">
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-20 gap-2">
          <Placa nombre={enemy.name} hp={enemyHp} max={enemy.maxHp} color="linear-gradient(90deg,#7d1820,#ff5c5c)" alinear="" />
          <Placa nombre={player.name} hp={playerHp} max={player.maxHp} color="linear-gradient(90deg,#1f8a55,#6fe3a1)" alinear="text-right" />
        </div>

        <div className={`pedestal absolute bottom-5 left-[4%] md:left-[12%] z-10 ${enemy.isBoss ? 'aura-jefe' : ''} ${enemyHp === 0 ? 'anim-ceniza' : enemyAnim}`}>
          <img src={enemy.sprite} alt={enemy.name} className={`luchador ${enemy.isBoss ? 'jefe' : ''} ${enemyAnim || enemyHp === 0 ? '' : 'respira'}`} />
          {golpe?.en === 'enemigo' && <><span key={`c${golpe.id}`} className="chispazo" /><span key={golpe.id} className="numero-dano">{golpe.texto}</span></>}
        </div>

        <div className={`pedestal absolute bottom-5 right-[4%] md:right-[12%] z-10 ${playerAnim}`}>
          <img src={getHeroArt(player.hero, player.level)} alt={player.name} className={`luchador ${playerAnim ? '' : 'respira'}`} style={{ scale: '-1 1', animationDelay: '-1.1s' }} />
          {golpe?.en === 'heroe' && <><span key={`c${golpe.id}`} className="chispazo rojo" /><span key={golpe.id} className="numero-dano">{golpe.texto}</span></>}
        </div>

        {(phase === 'RESULT_PLAYER' || phase === 'RESULT_ENEMY') && (
          <div className="absolute inset-0 flex items-end md:items-center justify-center pb-6 md:pb-0 z-30" style={{ background: 'rgba(5,3,12,.35)' }}>
            <button onClick={handleContinue} className="btn-oro min-w-[220px]" autoFocus>Continuar</button>
          </div>
        )}
      </div>

      {/* 2. MENSAJE Y RELOJ */}
      <div className="mensaje" role="status" aria-live="polite">
        {message}
        {phase === 'ANSWERING' && (
          <div className={`reloj ${timeLeft <= 5 ? 'apura' : ''}`} aria-hidden="true">
            <i style={{ width: `${(timeLeft / maxTime) * 100}%` }} />
          </div>
        )}
      </div>

      {/* 3. ACCIONES */}
      <div className="p-3 md:p-4 flex flex-col justify-center" style={{ background: 'rgba(0,0,0,.25)' }}>
        {phase === 'SELECT_SUBJECT' && (
          <div className="grid gap-2 md:gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${MATERIAS.length > 3 ? 104 : 96}px, 1fr))` }}>
            {MATERIAS.map(m => (
              <button key={m.s} className="materia" style={{ '--veta': m.veta } as React.CSSProperties} onClick={() => handleSubjectSelect(m.s)}>
                {m.icono}
                <span>{m.s}</span>
              </button>
            ))}
          </div>
        )}

        {phase === 'ANSWERING' && question && (
          <div className="grid gap-2 md:grid-cols-2">
            {question.options.map((opt, idx) => (
              <button key={idx} onClick={() => handleAnswer(idx)} className="respuesta">
                <span className="letra">{'ABCD'[idx]}</span>
                <span>{opt}</span>
              </button>
            ))}
          </div>
        )}

        {(phase !== 'SELECT_SUBJECT' && phase !== 'ANSWERING') && (
          <div className="flex items-center justify-center min-h-[92px] gap-2" style={{ color: 'var(--tenue)' }} aria-hidden="true">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--runa)' }} />
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--runa)', animationDelay: '.2s' }} />
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--runa)', animationDelay: '.4s' }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Battle;
