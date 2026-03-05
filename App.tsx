import React, { useState, useEffect, useRef } from 'react';
import { GameState, TileType, Player, Enemy, GameMap, ItemType, Item, ActiveEnemy } from './types';
import { LEVELS, MAP_HEIGHT, MAP_WIDTH, ENEMY_TEMPLATES, BOSS_TEMPLATE, GAME_ITEMS } from './constants';
import MapView from './components/MapView';
import Battle from './components/Battle';
import LoginScreen from './components/LoginScreen';
import Leaderboard from './components/Leaderboard';
import { RetroBox, RetroButton } from './components/RetroUI';
import { NARRATIVE } from './data/narrative';
import { Sparkles, Skull, ScrollText, Heart, Shield, Sword, Key, Backpack, X, Zap, Star } from 'lucide-react';

const INITIAL_PLAYER: Player = {
  x: LEVELS[0].start.x,
  y: LEVELS[0].start.y,
  hp: 100,
  maxHp: 100,
  xp: 0,
  level: 1,
  inventory: [],
  name: "Estudiante Heroico",
  stats: {
    attack: 10,
    defense: 0
  }
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.START_SCREEN);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [player, setPlayer] = useState<Player>(INITIAL_PLAYER);

  // Ref to access player position inside the interval without resetting it
  const playerRef = useRef(player);

  const [mapData, setMapData] = useState<GameMap>({
    tiles: [],
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    visited: Array(MAP_HEIGHT).fill(false).map(() => Array(MAP_WIDTH).fill(false))
  });

  const [activeEnemies, setActiveEnemies] = useState<ActiveEnemy[]>([]);
  const [currentEnemy, setCurrentEnemy] = useState<Enemy | null>(null);

  const [narrativeStep, setNarrativeStep] = useState<'PROLOGUE' | 'MISSION'>('PROLOGUE');
  const [showInventory, setShowInventory] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Sync player ref
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  // Initialize Fog of War (Only on GameState change)
  useEffect(() => {
    if (gameState === GameState.MAP) {
      updateFogOfWar(player.x, player.y);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // CONSTANT ENEMY MOVEMENT LOGIC WITH AGGRO
  useEffect(() => {
    if (gameState !== GameState.MAP) return;

    const moveInterval = setInterval(() => {
      setActiveEnemies(prevEnemies => {
        let battleTriggered = false;
        let collidingEnemy: ActiveEnemy | null = null;
        const playerPos = playerRef.current;

        const nextEnemies = prevEnemies.map(enemy => {
          if (battleTriggered) return enemy;

          let moves = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];

          // --- CHASE LOGIC (AGGRO) ---
          const distX = playerPos.x - enemy.x;
          const distY = playerPos.y - enemy.y;
          const distance = Math.abs(distX) + Math.abs(distY);

          let chosenMove = { x: 0, y: 0 };

          // If within 6 tiles, CHASE PLAYER
          if (distance < 6) {
            // Try to reduce the largest distance first
            if (Math.abs(distX) > Math.abs(distY)) {
              chosenMove = { x: Math.sign(distX), y: 0 };
            } else {
              chosenMove = { x: 0, y: Math.sign(distY) };
            }
          } else {
            // Random movement if far away
            // 20% chance to stand still
            if (Math.random() < 0.2) return enemy;
            chosenMove = moves[Math.floor(Math.random() * moves.length)];
          }

          const targetX = enemy.x + chosenMove.x;
          const targetY = enemy.y + chosenMove.y;

          // 1. Bounds Check
          if (targetX < 0 || targetX >= MAP_WIDTH || targetY < 0 || targetY >= MAP_HEIGHT) return enemy;

          // 2. Wall/Object Check
          const tile = mapData.tiles[targetY][targetX];
          if (tile === TileType.WALL || tile === TileType.SECRET_WALL || tile === TileType.BOSS || tile === TileType.PORTAL) {
            // If stuck chasing, try random move as fallback
            return enemy;
          }

          // 3. Other Enemy Check
          if (prevEnemies.some(e => e.id !== enemy.id && e.x === targetX && e.y === targetY)) return enemy;

          // 4. Player Collision Check (Triggers Battle)
          if (targetX === playerPos.x && targetY === playerPos.y) {
            battleTriggered = true;
            collidingEnemy = enemy;
            return enemy;
          }

          return { ...enemy, x: targetX, y: targetY };
        });

        if (battleTriggered && collidingEnemy) {
          setTimeout(() => {
            triggerBattle(collidingEnemy!);
          }, 0);
          return prevEnemies;
        }

        return nextEnemies;
      });
    }, 550); // Move every 550ms (Slightly faster)

    return () => clearInterval(moveInterval);
  }, [gameState, mapData]);


  const updateFogOfWar = (px: number, py: number) => {
    setMapData(prev => {
      const newVisited = prev.visited.map(row => [...row]);
      const radius = 4; // increased sight radius

      for (let y = py - radius; y <= py + radius; y++) {
        for (let x = px - radius; x <= px + radius; x++) {
          if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
            // Circular field of view
            if (Math.sqrt(Math.pow(x - px, 2) + Math.pow(y - py, 2)) <= 4.2) {
              newVisited[y][x] = true;
            }
          }
        }
      }
      return { ...prev, visited: newVisited };
    });
  };

  const handleLogin = (name: string) => {
    setPlayer(prev => ({ ...prev, name }));
    setIsLoggedIn(true);
  };

  const saveScore = async (finalPlayer: Player) => {
    const score = finalPlayer.level * 1000 + finalPlayer.xp;
    try {
      await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalPlayer.name,
          score,
          level: finalPlayer.level
        })
      });
    } catch (error) {
      console.error('Error saving score:', error);
    }
  };

  const startGame = () => {
    setNarrativeStep('PROLOGUE');
    setGameState(GameState.NARRATIVE);
  };

  const advanceNarrative = () => {
    if (narrativeStep === 'PROLOGUE') {
      setNarrativeStep('MISSION');
    } else {
      loadLevel(0);
      setGameState(GameState.MAP);
    }
  };

  const handleMove = (dx: number, dy: number) => {
    if (gameState !== GameState.MAP) return;

    const newX = player.x + dx;
    const newY = player.y + dy;

    if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return;

    const targetTile = mapData.tiles[newY][newX];

    // --- COLLISION CHECKS ---

    // 1. Walls
    if (targetTile === TileType.WALL) return;

    // 2. Secret Walls (Reveal and stop)
    if (targetTile === TileType.SECRET_WALL) {
      const newTiles = mapData.tiles.map(row => [...row]);
      newTiles[newY][newX] = TileType.GRASS; // Break the wall
      setMapData(prev => ({ ...prev, tiles: newTiles }));
      showNotification("¡Has descubierto un pasadizo secreto!");
      return; // Consume turn breaking wall
    }

    // 3. Enemies (Entities)
    const enemyAtTarget = activeEnemies.find(e => e.x === newX && e.y === newY);
    if (enemyAtTarget) {
      triggerBattle(enemyAtTarget);
      return;
    }

    // 4. Boss (Static Tile)
    if (targetTile === TileType.BOSS) {
      triggerBossBattle();
      return;
    }

    // Move Player
    setPlayer(prev => ({ ...prev, x: newX, y: newY }));
    updateFogOfWar(newX, newY);

    // Process Tile Interaction (Chests, Portal)
    handleTileInteraction(targetTile, newX, newY);
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const triggerBattle = (activeEnemy: ActiveEnemy) => {
    const template = ENEMY_TEMPLATES[activeEnemy.templateIndex];

    // Determine Sprite URL based on ID
    let spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/94.gif"; // Gengar default

    switch (template.spriteId) {
      case "goblin": spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/302.gif"; break; // Sableye
      case "ogre": spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/68.gif"; break; // Machamp
      case "slime": spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/88.gif"; break; // Grimer
      case "skeleton": spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/105.gif"; break; // Marowak
      case "bat": spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/41.gif"; break; // Zubat
      case "ghost": spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/92.gif"; break; // Gastly
      case "snake": spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/23.gif"; break; // Ekans
      case "knight": spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/625.gif"; break; // Bisharp
    }

    setCurrentEnemy({
      id: activeEnemy.id,
      name: template.name,
      hp: activeEnemy.hp,
      maxHp: activeEnemy.maxHp,
      difficulty: (currentLevelIndex + 1),
      sprite: spriteUrl,
      weakness: template.weakness,
      isBoss: false
    });
    setGameState(GameState.BATTLE);
  };

  const triggerBossBattle = () => {
    const difficultyMultiplier = currentLevelIndex + 1;
    setCurrentEnemy({
      id: 'boss',
      name: BOSS_TEMPLATE.name,
      hp: 300 + (difficultyMultiplier * 50),
      maxHp: 300 + (difficultyMultiplier * 50),
      difficulty: 3,
      sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/491.gif", // Darkrai
      weakness: BOSS_TEMPLATE.weakness,
      isBoss: true
    });
    setGameState(GameState.BATTLE);
  };

  const handleTileInteraction = async (tile: TileType, x: number, y: number) => {
    if (tile === TileType.CHEST) {
      const otherItems = GAME_ITEMS.filter(i => i.id !== 'key');
      const newItem = otherItems[Math.floor(Math.random() * otherItems.length)];

      setPlayer(prev => {
        let newStats = { ...prev.stats };
        let newHp = prev.hp;
        let newMaxHp = prev.maxHp;

        if (newItem.type === ItemType.WEAPON) newStats.attack += newItem.value;
        if (newItem.type === ItemType.ARMOR) { newMaxHp += newItem.value; newHp += newItem.value; }

        return {
          ...prev,
          hp: newHp,
          maxHp: newMaxHp,
          stats: newStats,
          inventory: [...prev.inventory, newItem]
        };
      });

      showNotification(`¡Has encontrado: ${newItem.name}!`);

      const newTiles = mapData.tiles.map(row => [...row]);
      newTiles[y][x] = TileType.GRASS;
      setMapData(prev => ({ ...prev, tiles: newTiles }));

    } else if (tile === TileType.PORTAL) {
      if (currentLevelIndex < LEVELS.length - 1) {
        loadLevel(currentLevelIndex + 1);
      } else {
        setGameState(GameState.VICTORY);
        saveScore(player);
      }
    }
  };

  const handleUseItem = (item: Item, index: number) => {
    if (item.type === ItemType.POTION) {
      setPlayer(prev => {
        const healedHp = Math.min(prev.maxHp, prev.hp + item.value);
        const newInv = [...prev.inventory];
        newInv.splice(index, 1);
        showNotification(`¡Salud recuperada! +${item.value}`);
        return {
          ...prev,
          hp: healedHp,
          inventory: newInv
        };
      });
    }
  };

  // --- MAP LOADING ---
  const loadLevel = (index: number) => {
    setCurrentLevelIndex(index);
    const levelData = LEVELS[index];

    // Deep copy map
    const newTiles = levelData.map.map(row => [...row]);

    // 1. Place Static Boss & Portal
    newTiles[levelData.portalPos.y][levelData.portalPos.x] = TileType.PORTAL;
    newTiles[levelData.bossPos.y][levelData.bossPos.x] = TileType.BOSS;

    // 2. Identify Valid Spawns
    const validSpawns: { x: number, y: number }[] = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        // Spawn on Grass only
        if (newTiles[y][x] === TileType.GRASS) {
          const distStart = Math.abs(x - levelData.start.x) + Math.abs(y - levelData.start.y);
          if (distStart > 4) { // Further away 
            validSpawns.push({ x, y });
          }
        }
      }
    }

    // Shuffle
    for (let i = validSpawns.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [validSpawns[i], validSpawns[j]] = [validSpawns[j], validSpawns[i]];
    }

    // 3. Spawn Entities (Enemies)
    const newActiveEnemies: ActiveEnemy[] = [];
    let spawnIndex = 0;

    for (let i = 0; i < levelData.enemyCount; i++) {
      if (spawnIndex < validSpawns.length) {
        const { x, y } = validSpawns[spawnIndex];
        const templateIdx = Math.floor(Math.random() * ENEMY_TEMPLATES.length);
        const difficultyMultiplier = index + 1;

        newActiveEnemies.push({
          id: `enemy-${index}-${i}-${Date.now()}`,
          x,
          y,
          templateIndex: templateIdx,
          hp: 40 + (difficultyMultiplier * 20),
          maxHp: 40 + (difficultyMultiplier * 20)
        });
        spawnIndex++;
      }
    }

    // 4. Place Chests (Still Tiles)
    for (let i = 0; i < levelData.chestCount; i++) {
      if (spawnIndex < validSpawns.length) {
        const { x, y } = validSpawns[spawnIndex];
        newTiles[y][x] = TileType.CHEST;
        spawnIndex++;
      }
    }

    setActiveEnemies(newActiveEnemies);

    setPlayer(prev => ({
      ...prev,
      x: levelData.start.x,
      y: levelData.start.y
    }));

    setMapData({
      tiles: newTiles,
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      visited: Array(MAP_HEIGHT).fill(false).map(() => Array(MAP_WIDTH).fill(false))
    });

    showNotification(levelData.title);
  };

  const handleBattleVictory = (xpGained: number, remainingHp: number) => {
    const newXp = player.xp + xpGained;
    const levelUp = newXp >= (player.level * 100);

    if (currentEnemy) {
      if (currentEnemy.isBoss) {
        const newTiles = mapData.tiles.map(row => [...row]);
        const bossPos = LEVELS[currentLevelIndex].bossPos;
        newTiles[bossPos.y][bossPos.x] = TileType.GRASS;
        setMapData(prev => ({ ...prev, tiles: newTiles }));
        showNotification("¡JEFE DERROTADO! ¡EL CAMINO ESTÁ LIBRE!");
      } else {
        // Remove the specific active enemy
        setActiveEnemies(prev => prev.filter(e => e.id !== currentEnemy.id));
      }
    }

    setPlayer(prev => {
      let newMaxHp = prev.maxHp;
      let currentHp = remainingHp;
      let newAttack = prev.stats.attack;

      if (levelUp) {
        newMaxHp += 20;
        currentHp = newMaxHp;
        newAttack += 5;
        showNotification("¡NIVEL SUBIDO! ¡Salud restaurada!");
      }

      return {
        ...prev,
        xp: newXp,
        level: levelUp ? prev.level + 1 : prev.level,
        maxHp: newMaxHp,
        hp: currentHp,
        stats: { ...prev.stats, attack: newAttack }
      };
    });

    setCurrentEnemy(null);
    setGameState(GameState.MAP);
  };

  const handleBattleHpUpdate = (currentHp: number) => {
    setPlayer(prev => ({ ...prev, hp: currentHp }));
  };

  const handleDefeat = () => {
    setGameState(GameState.GAME_OVER);
    saveScore(player);
  };

  const resetGame = () => {
    setPlayer(INITIAL_PLAYER);
    setGameState(GameState.START_SCREEN);
  };

  const currentLevelTitle = LEVELS[currentLevelIndex].title;

  // XP Logic
  const nextLevelXp = player.level * 100;
  const prevLevelXp = (player.level - 1) * 100;
  const xpPercentage = Math.min(100, Math.max(0, ((player.xp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100));

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col items-center justify-start font-retro select-none overflow-x-hidden relative">

      {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} />}
      {(gameState === GameState.MAP || gameState === GameState.BATTLE) && (
        <div className="fixed top-0 left-0 w-full z-50 pointer-events-none flex flex-col">

          <div className="bg-[#1a1a1a] border-b-4 border-[#333] px-3 py-2 flex justify-between items-center text-[10px] md:text-xs tracking-wider font-bold shadow-lg pointer-events-auto">
            <span className="text-yellow-500 uppercase truncate max-w-[40%]">{currentLevelTitle}</span>
            <div className="flex gap-3 text-white items-center">
              <button onClick={() => setShowInventory(true)} className="flex items-center gap-1 bg-blue-900 border-2 border-blue-500 px-3 py-1 rounded hover:bg-blue-800 transition-colors shadow-[0_2px_0_rgb(30,58,138)] active:shadow-none active:translate-y-[2px]">
                <Backpack size={14} />
                <span>MOCHILA</span>
              </button>
              <span className="text-yellow-200">LVL {player.level}</span>
            </div>
          </div>

          <div className="bg-[#222] px-3 py-2 border-b-4 border-[#111] flex flex-col gap-2 pointer-events-auto w-full shadow-xl">
            {/* HP Row */}
            <div className="flex items-center gap-3">
              <Heart className="text-red-500 fill-current shrink-0" size={20} />
              <div className="relative flex-1 h-6 bg-[#333] border-2 border-[#555] rounded-sm box-content">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-300 relative overflow-hidden"
                  style={{ width: `${Math.max(0, (player.hp / player.maxHp) * 100)}%` }}
                >
                  <div className="absolute top-0 left-0 w-full h-[50%] bg-white/20"></div>
                </div>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tracking-widest z-10">
                  {player.hp}/{player.maxHp}
                </span>
              </div>
            </div>

            {/* XP Row */}
            <div className="flex items-center gap-3">
              <Star className="text-yellow-400 fill-current shrink-0" size={16} />
              <div className="relative flex-1 h-3 bg-[#333] border border-[#555] rounded-sm box-content">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 relative overflow-hidden"
                  style={{ width: `${xpPercentage}%` }}
                >
                  <div className="absolute top-0 left-0 w-full h-[50%] bg-white/20"></div>
                </div>
                <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white/90 font-bold tracking-widest z-10 drop-shadow-md">
                  XP {player.xp} / {nextLevelXp}
                </span>
              </div>
            </div>
          </div>

          {/* Notification Toast - Fixed Centering */}
          {notification && (
            <div className="fixed top-32 left-0 w-full flex justify-center px-4 pointer-events-none z-[100]">
              <div className="bg-yellow-600 text-white border-2 border-white px-4 py-3 rounded shadow-xl animate-bounce text-[10px] md:text-base font-bold text-center w-full max-w-sm">
                {notification}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inventory Modal */}
      {showInventory && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border-4 border-white w-full max-w-lg rounded-lg p-0 relative shadow-2xl flex flex-col max-h-[80vh]">
            <div className="bg-blue-900 p-4 border-b-4 border-blue-700 flex justify-between items-center">
              <h2 className="text-yellow-400 text-xl font-bold flex items-center gap-2">
                <Backpack /> INVENTARIO
              </h2>
              <button onClick={() => setShowInventory(false)} className="text-white hover:text-red-500">
                <X size={28} />
              </button>
            </div>

            <div className="bg-[#222] p-4 flex justify-around border-b-2 border-gray-700">
              <div className="flex flex-col items-center">
                <span className="text-gray-400 text-[8px] md:text-xs uppercase">Ataque</span>
                <div className="flex items-center gap-2 text-blue-400 font-bold text-base md:text-xl">
                  <Sword size={20} /> {player.stats.attack}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-gray-400 text-[8px] md:text-xs uppercase">Salud Máx</span>
                <div className="flex items-center gap-2 text-green-400 font-bold text-base md:text-xl">
                  <Heart size={20} /> {player.maxHp}
                </div>
              </div>
            </div>

            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-[#111]">
              <h3 className="text-gray-500 text-[8px] mb-2 uppercase tracking-widest border-b border-gray-800 pb-1">Objetos Recogidos</h3>
              {player.inventory.length === 0 ? (
                <div className="text-center py-10 opacity-50 flex flex-col items-center">
                  <Backpack size={48} className="mb-2" />
                  <p className="text-xs">Tu mochila está vacía.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {player.inventory.map((item, idx) => (
                    <div key={idx} className="bg-[#2a2a2a] p-3 flex items-center gap-3 border-2 border-gray-700 rounded relative">
                      <div className="p-2 rounded bg-black/20 text-yellow-400 shrink-0">
                        {item.type === ItemType.KEY ? <Key size={16} /> : item.type === ItemType.WEAPON ? <Sword size={16} /> : <Heart size={16} />}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <p className="text-[10px] md:text-xs font-bold text-white truncate">{item.name}</p>
                        <p className="text-[8px] text-gray-400 mt-1 truncate">{item.description}</p>
                      </div>
                      {item.type === ItemType.POTION && (
                        <button
                          onClick={() => handleUseItem(item, idx)}
                          className="ml-2 bg-green-700 hover:bg-green-600 text-white text-[9px] px-2 py-1 rounded border border-green-500 shadow-sm shrink-0 flex items-center gap-1 active:scale-95 transition-transform"
                        >
                          <Zap size={10} /> USAR
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="w-full max-w-5xl px-2 md:px-4 mt-28 md:mt-32 mb-10 flex flex-col items-center relative z-10">

        {gameState === GameState.START_SCREEN && (
          <div className="text-center space-y-8 animate-fade-in pt-12 flex flex-col items-center">
            <h1 className="text-2xl md:text-5xl text-yellow-400 pixel-text-shadow mb-8 leading-tight tracking-tighter text-center">
              QUEST FOR KNOWLEDGE
              <br />
              <span className="text-xs md:text-lg text-blue-300">Grade 5 Heroes</span>
            </h1>
            <div className="flex justify-center mb-8">
              <div className="relative group cursor-pointer" onClick={startGame}>
                <div className="relative w-32 h-32 md:w-48 md:h-48 bg-black border-4 border-white flex items-center justify-center overflow-hidden rounded-lg">
                  <ScrollText size={60} className="text-yellow-200 animate-bounce" />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4 w-full max-w-xs">
              <RetroButton onClick={startGame} className="text-lg md:text-2xl px-8 py-4 animate-pulse bg-indigo-600 border-indigo-400 shadow-[0_4px_0_rgb(49,46,129)] active:shadow-none active:translate-y-[4px]">
                JUGAR
              </RetroButton>
              <RetroButton onClick={() => setShowLeaderboard(true)} className="text-sm md:text-base px-6 py-3 bg-yellow-700 border-yellow-500 shadow-[0_4px_0_rgb(161,98,7)] active:shadow-none active:translate-y-[4px]">
                VER RANKING
              </RetroButton>
            </div>
          </div>
        )}

        {gameState === GameState.NARRATIVE && (
          <div className="w-full flex justify-center">
            <RetroBox title={narrativeStep === 'PROLOGUE' ? "PRÓLOGO" : "MISIÓN"} className="w-full max-w-2xl text-center py-6 md:py-10 bg-gray-900 border-yellow-600 mt-8 flex flex-col max-h-[85vh]">
              <div className="text-[10px] md:text-base leading-5 md:leading-8 mb-8 whitespace-pre-wrap text-left font-sans text-gray-200 px-2 overflow-y-auto custom-scrollbar flex-1">
                {narrativeStep === 'PROLOGUE' ? NARRATIVE.PROLOGUE : NARRATIVE.MISSION}
              </div>
              <div className="shrink-0">
                <RetroButton onClick={advanceNarrative} className="animate-pulse bg-yellow-700 border-yellow-500 shadow-[0_4px_0_rgb(161,98,7)] active:translate-y-[4px] active:shadow-none">
                  {narrativeStep === 'PROLOGUE' ? "SIGUIENTE ▶" : "ACEPTAR MISIÓN"}
                </RetroButton>
              </div>
            </RetroBox>
          </div>
        )}

        {gameState === GameState.MAP && (
          <div className="flex flex-col items-center justify-center w-full">
            <MapView mapData={mapData} player={player} activeEnemies={activeEnemies} onMove={handleMove} theme={LEVELS[currentLevelIndex].theme} />
            {/* Objective Box */}
            <div className="mt-4 mx-2 bg-[#2a2a2a] border-4 border-[#4a4a4a] p-2 rounded shadow-lg w-full max-w-md border-t-white/20 z-20">
              <p className="text-[10px] md:text-sm text-gray-200 text-center leading-tight">
                {mapData.tiles.some(r => r.includes(TileType.BOSS))
                  ? "¡Derrota al Director del Caos para liberar el portal!"
                  : "¡El camino está libre! Entra en el portal."}
              </p>
            </div>
          </div>
        )}

        {gameState === GameState.BATTLE && currentEnemy && (
          <div className="w-full flex justify-center mt-4">
            <Battle
              player={player}
              enemy={currentEnemy}
              onVictory={handleBattleVictory}
              onDefeat={handleDefeat}
              onHpUpdate={handleBattleHpUpdate}
            />
          </div>
        )}

        {gameState === GameState.GAME_OVER && (
          <div className="text-center pt-20">
            <Skull size={100} className="mx-auto text-red-600 mb-6" />
            <h2 className="text-2xl md:text-4xl text-red-500 mb-8 pixel-text-shadow">GAME OVER</h2>
            <RetroButton onClick={resetGame} variant="danger">REINTENTAR</RetroButton>
          </div>
        )}

        {gameState === GameState.VICTORY && (
          <div className="text-center max-w-3xl mx-auto pt-20 flex flex-col items-center">
            <Sparkles size={80} className="mx-auto text-yellow-400 mb-6 animate-spin-slow" />
            <h2 className="text-2xl md:text-4xl text-green-400 mb-6 pixel-text-shadow">¡GRAN VICTORIA!</h2>
            <RetroBox className="mb-8 text-left bg-green-950 border-green-500">
              <p className="text-xs md:text-base leading-relaxed whitespace-pre-wrap text-green-100 p-2">
                Has completado todos los niveles. El caos ha sido derrotado y el conocimiento ha vuelto al mundo.
                <br /><br />
                ¡Eres un verdadero Guardián de la Memoria!
              </p>
            </RetroBox>
            <RetroButton onClick={resetGame} variant="success">JUGAR DE NUEVO</RetroButton>
          </div>
        )}

      </div>
    </div>
  );
}