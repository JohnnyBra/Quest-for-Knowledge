import React, { useState, useEffect, useRef } from 'react';
import { GameState, TileType, Player, Enemy, GameMap, ItemType, Item, ActiveEnemy, Subject } from './types';
import { LEVELS, MAP_HEIGHT, MAP_WIDTH, ENEMY_TEMPLATES, BOSS_TEMPLATE, GAME_ITEMS, GAME_ITEMS_SPECIAL, MAP1_BOULDER_START, LLAVE_MAESTRA, arteObjeto } from './constants';
import CanvasMapView from './components/CanvasMapView';
import Battle from './components/Battle';
import LoginScreen from './components/LoginScreen';
import Leaderboard from './components/Leaderboard';
import { RetroBox, RetroButton } from './components/RetroUI';
import { narrativa } from './data/narrative';
import { api, type Yo } from './services/api';
import { configurarPreguntas } from './services/preguntas';
import { empezarPartida, terminarPartida, vaciarRespuestas } from './services/partida';
import { Heart, Sword, X, Zap, Star } from 'lucide-react';
import Gallery from './components/Gallery';
import HeroSelect from './components/HeroSelect';
import PanelProfe from './components/PanelProfe';
import { Fondo, Icono, Estandarte } from './components/RetroUI';
import { HEROE_POR_DEFECTO, HeroChoice, getHeroArt, SKINS, formaDe } from './heroes';

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
    defense: 0,
    critChance: 0
  },
  score: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  superEffectiveAnswers: 0,
  startTime: Date.now(),
  defeatedEnemies: [],
  hero: HEROE_POR_DEFECTO
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

  const mapDataRef = useRef(mapData);

  const [activeEnemies, setActiveEnemies] = useState<ActiveEnemy[]>([]);
  const [currentEnemy, setCurrentEnemy] = useState<Enemy | null>(null);

  const [narrativeStep, setNarrativeStep] = useState<'PROLOGUE' | 'MISSION'>('PROLOGUE');
  const [showInventory, setShowInventory] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [yo, setYo] = useState<Yo | null | undefined>(undefined);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isEvolving, setIsEvolving] = useState(false);
  const [showShockwave, setShowShockwave] = useState(false);

  // Escape cierra cualquier ventana abierta
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setShowInventory(false); setShowGallery(false); setShowLeaderboard(false);
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, []);

  // Sync refs
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    mapDataRef.current = mapData;
  }, [mapData]);

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
          const currentMap = mapDataRef.current;
          const tile = currentMap.tiles[targetY]?.[targetX];
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
  }, [gameState]);


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

  const alEntrar = (y: Yo) => {
    setYo(y);
    if (y.rol !== 'alumno') return;
    configurarPreguntas(y.curso, y.pendientes);
    setPlayer(prev => ({ ...prev, name: y.nombre, hero: y.heroe ?? prev.hero }));
    setIsLoggedIn(true);
    setGameState(y.heroe ? GameState.START_SCREEN : GameState.HERO_SELECT);
  };
  const salir = async () => {
    await vaciarRespuestas(); // lo que quedó sin enviar por falta de red, antes de cerrar la sesión
    await api('/api/salir', {}).catch(() => {});
    window.location.reload();
  };

  useEffect(() => { api<Yo>('/api/yo').then(alEntrar).catch(() => setYo(null)); }, []);

  const elegirHeroe = (hero: HeroChoice) => {
    api('/api/yo/heroe', hero, 'PUT').catch(() => showNotification('No se ha podido guardar el héroe.'));
    setPlayer(prev => ({ ...prev, hero }));
    setGameState(GameState.START_SCREEN);
  };

  const saveScore = async (finalPlayer: Player) => {
    // Incorporar tiempo transcurrido en el score final
    const elapsedSeconds = Math.floor((Date.now() - finalPlayer.startTime) / 1000);
    // Bonus de velocidad: 3000 menos 3 puntos por segundo
    const timeBonus = Math.max(0, 3000 - (elapsedSeconds * 3));
    const finalScore = finalPlayer.score + timeBonus;

    await terminarPartida({ puntos: finalScore, nivel_heroe: finalPlayer.level, mapa: currentLevelIndex + 1 });
  };

  const startGame = () => {
    void empezarPartida();
    setPlayer(prev => ({
      ...prev,
      startTime: Date.now(),
      score: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      superEffectiveAnswers: 0
    }));
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
    if (gameState !== GameState.MAP || showInventory || showGallery || showLeaderboard || isEvolving) return;

    let newX = player.x + dx;
    let newY = player.y + dy;

    if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return;

    let targetTile = mapData.tiles[newY][newX];

    // Ice Slide Logic
    if (targetTile === TileType.ICE) {
       let finalX = newX;
       let finalY = newY;
       while (true) {
          const nextX = finalX + dx;
          const nextY = finalY + dy;
          if (nextX < 0 || nextX >= MAP_WIDTH || nextY < 0 || nextY >= MAP_HEIGHT) break;
          const nextTile = mapData.tiles[nextY][nextX];
          if ([TileType.WALL, TileType.SECRET_WALL, TileType.BOSS, TileType.CHEST, TileType.TRAP_WALL, TileType.DOOR_CLOSED, TileType.LOCKED_DOOR, TileType.BOULDER, TileType.BUTTON_PRESSED, TileType.SPIKE_UP].includes(nextTile)) break;
          // check enemy collision
          if (activeEnemies.some(e => e.x === nextX && e.y === nextY)) break;
          
          finalX = nextX;
          finalY = nextY;
          if (nextTile !== TileType.ICE) break; // Stop sliding when hitting normal terrain
       }
       newX = finalX;
       newY = finalY;
       targetTile = mapData.tiles[newY][newX];
    }

    // --- COLLISION CHECKS ---

    // 1. Walls
    if (targetTile === TileType.WALL) return;

    // 1.5 Doors
    if (targetTile === TileType.DOOR_CLOSED) {
       showNotification("La puerta está cerrada por un mecanismo mágico...");
       return;
    }

    if (targetTile === TileType.LOCKED_DOOR) {
       const keyIndex = player.inventory.findIndex(i => i.type === ItemType.KEY);
       if (keyIndex !== -1) {
          const newTiles = mapData.tiles.map(row => [...row]);
          newTiles[newY][newX] = TileType.DOOR_OPEN;
          setMapData(prev => ({ ...prev, tiles: newTiles }));
          
          setPlayer(prev => {
             const newInv = [...prev.inventory];
             newInv.splice(keyIndex, 1);
             return { ...prev, inventory: newInv };
          });
          showNotification("¡Has usado una Llave para abrir la puerta!");
          return; // Stop here, tile is open next move
       } else {
          showNotification("Necesitas una LLAVE para abrir esta puerta.");
          return;
       }
    }

    // 1.6 Boulders
    if (targetTile === TileType.BOULDER || targetTile === TileType.BUTTON_PRESSED) {
       const pushX = newX + dx;
       const pushY = newY + dy;
       
       if (pushX >= 0 && pushX < MAP_WIDTH && pushY >= 0 && pushY < MAP_HEIGHT) {
          const backTile = mapData.tiles[pushY][pushX];
          // Can push if the back tile is GRASS, or BUTTON (or ICE but let's stick to GRASS/BUTTON to avoid sliding mechanics for blocks)
          if (backTile === TileType.GRASS || backTile === TileType.BUTTON) {
             const newTiles = mapData.tiles.map(row => [...row]);
             
             // The tile we pushed from
             newTiles[newY][newX] = targetTile === TileType.BUTTON_PRESSED ? TileType.BUTTON : TileType.GRASS;
             
             // The tile we pushed to
             newTiles[pushY][pushX] = backTile === TileType.BUTTON ? TileType.BUTTON_PRESSED : TileType.BOULDER;

             // Check puzzle solved (all BUTTONs are pressed, no empty BUTTONs)
             let isSolved = true;
             let hasButtons = false;
             for (let y = 0; y < MAP_HEIGHT; y++) {
                for (let x = 0; x < MAP_WIDTH; x++) {
                   if (newTiles[y][x] === TileType.BUTTON) isSolved = false;
                   if (newTiles[y][x] === TileType.BUTTON_PRESSED || newTiles[y][x] === TileType.BUTTON) hasButtons = true;
                }
             }

             if (hasButtons && isSolved) {
                // Open all doors
                for (let y = 0; y < MAP_HEIGHT; y++) {
                   for (let x = 0; x < MAP_WIDTH; x++) {
                      if (newTiles[y][x] === TileType.DOOR_CLOSED) {
                         newTiles[y][x] = TileType.DOOR_OPEN;
                      }
                   }
                }
                showNotification("¡Has resuelto el acertijo! La puerta se ha abierto.");
             }

             setMapData(prev => ({ ...prev, tiles: newTiles }));
             setPlayer(prev => ({ ...prev, x: newX, y: newY })); // Player steps into the tile
             updateFogOfWar(newX, newY);
             return;
          }
       }
       return; // Can't push
    }

    // 2. Secret Walls (Reveal and stop)
    if (targetTile === TileType.SECRET_WALL) {
      const newTiles = mapData.tiles.map(row => [...row]);
      newTiles[newY][newX] = TileType.GRASS; // Break the wall
      setMapData(prev => ({ ...prev, tiles: newTiles }));

      const specialItem = GAME_ITEMS_SPECIAL[Math.floor(Math.random() * GAME_ITEMS_SPECIAL.length)];

      setPlayer(prev => {
        let newStats = { ...prev.stats };
        let newHp = prev.hp;
        let newMaxHp = prev.maxHp;

        if (specialItem.type === ItemType.WEAPON) newStats.attack += specialItem.value;
        if (specialItem.type === ItemType.ARMOR) { newMaxHp += specialItem.value; newHp += specialItem.value; }
        if (specialItem.type === ItemType.CRIT_UP) newStats.critChance += specialItem.value;

        return {
          ...prev,
          hp: newHp,
          maxHp: newMaxHp,
          stats: newStats,
          score: prev.score + 500,
          inventory: [...prev.inventory, specialItem]
        };
      });

      showNotification(`¡Secretos y tesoros! +500 PTS y ${specialItem.name}`);
      return;
    }

    // 2.5 Trap Walls (Invisible)
    if (targetTile === TileType.TRAP_WALL) {
      const newTiles = mapData.tiles.map(row => [...row]);
      newTiles[newY][newX] = TileType.GRASS; // Break the wall
      setMapData(prev => ({ ...prev, tiles: newTiles }));

      showNotification("¡TRAMPA INVISIBLE! Un monstruo letal aparece...");

      const difficultyMultiplier = currentLevelIndex + 2;
      const validTemplates = ENEMY_TEMPLATES.map((t, i) => ({ t, i })).filter(({ t }) => currentLevelIndex > 0 || (t.weakness !== Subject.ENGLISH && t.weakness !== Subject.PHYSICAL_ED));
      const templateIndex = validTemplates[Math.floor(Math.random() * validTemplates.length)].i;

      const trapEnemy: ActiveEnemy = {
        id: `trap-${Date.now()}`,
        x: newX,
        y: newY,
        templateIndex: templateIndex,
        hp: 100 + (difficultyMultiplier * 50),
        maxHp: 100 + (difficultyMultiplier * 50)
      };

      triggerBattle(trapEnemy, true);
      return;
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

    // Teleporters
    if (targetTile === TileType.TELEPORT_PAD) {
       let found = false;
       for (let y = 0; y < MAP_HEIGHT; y++) {
          if(found) break;
          for (let x = 0; x < MAP_WIDTH; x++) {
             if (mapData.tiles[y][x] === TileType.TELEPORT_PAD && (x !== newX || y !== newY)) {
                newX = x;
                newY = y;
                found = true;
                showNotification("¡Te has teletransportado!");
                break;
             }
          }
       }
    }

    // Move Player
    setPlayer(prev => ({ ...prev, x: newX, y: newY }));
    
    // Toggle Spikes Globally on valid move step
    setMapData(prev => {
       const newTiles = prev.tiles.map(row => row.map(t => {
          if (t === TileType.SPIKE_UP) return TileType.SPIKE_DOWN;
          if (t === TileType.SPIKE_DOWN) return TileType.SPIKE_UP;
          return t;
       }));
       return { ...prev, tiles: newTiles };
    });

    updateFogOfWar(newX, newY);

    // Process Tile Interaction (Chests, Portal, SPIKE_UP, KEY)
    handleTileInteraction(targetTile, newX, newY);
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const triggerBattle = (activeEnemy: ActiveEnemy, isTrap: boolean = false) => {
    const template = ENEMY_TEMPLATES[activeEnemy.templateIndex];

    setCurrentEnemy({
      id: activeEnemy.id,
      name: isTrap ? `Guardián Letal: ${template.name}` : template.name,
      hp: activeEnemy.hp,
      maxHp: activeEnemy.maxHp,
      difficulty: isTrap ? (currentLevelIndex + 2) * 2 : Math.floor((currentLevelIndex + 1) * 1.5),
      sprite: template.spriteUrl,
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
      sprite: BOSS_TEMPLATE.spriteUrl,
      weakness: BOSS_TEMPLATE.weakness,
      isBoss: true
    });
    setGameState(GameState.BATTLE);
  };

  const handleTileInteraction = async (tile: TileType, x: number, y: number) => {
    // We already moved to the tile
    if (tile === TileType.SPIKE_UP || tile === TileType.SPIKE_DOWN) {
      // The toggle happened in handleMove *before* this check, so targetTile was read BEFORE toggle.
      // Wait, targetTile is passed to this function. It holds the pre-toggled state!
      // If we stepped on SPIKE_UP and it became SPIKE_DOWN, we still take damage because it WAS UP when we stepped.
      if (tile === TileType.SPIKE_UP) {
         setPlayer(prev => {
            const currentHp = Math.max(0, prev.hp - 15);
            if (currentHp === 0) {
               setTimeout(handleDefeat, 500);
            }
            return { ...prev, hp: currentHp };
         });
         showNotification("¡Ouch! Has pisado unos pinchos (-15 HP)");
      }
    }

    if (tile === TileType.KEY_ITEM_TILE) {
       const newTiles = mapData.tiles.map(row => [...row]);
       newTiles[y][x] = TileType.GRASS;
       // We MUST use the updater function for toggling safely too, but Tile interaction sets state manually. Let's make sure it doesn't revert toggles. We will update `setMapData(prev => ...)` instead of breaking it.
       setMapData(prev => {
          const res = prev.tiles.map(r => [...r]);
          res[y][x] = TileType.GRASS;
          return { ...prev, tiles: res };
       });

       setPlayer(prev => ({ ...prev, inventory: [...prev.inventory, LLAVE_MAESTRA] }));
       showNotification("¡Has encontrado una LLAVE MAESTRA!");
    }

    if (tile === TileType.CHEST) {
      setMapData(prev => {
         const res = prev.tiles.map(r => [...r]);
         res[y][x] = TileType.GRASS;
         return { ...prev, tiles: res };
      });

      // 25% chance for a Mimic
      if (Math.random() < 0.25) {
         showNotification("¡OH NO! ¡EL COFRE ERA UN MIMIC!");
         const difficultyMultiplier = currentLevelIndex + 2;
         const validTemplates = ENEMY_TEMPLATES.map((t, i) => ({ t, i })).filter(({ t }) => currentLevelIndex > 0 || (t.weakness !== Subject.ENGLISH && t.weakness !== Subject.PHYSICAL_ED));
         const mimicEnemy: ActiveEnemy = {
           id: `mimic-${Date.now()}`,
           x,
           y,
           templateIndex: validTemplates[Math.floor(Math.random() * validTemplates.length)].i,
           hp: 80 + (difficultyMultiplier * 60),
           maxHp: 80 + (difficultyMultiplier * 60)
         };
         triggerBattle(mimicEnemy, true);
         return;
      }

      const otherItems = GAME_ITEMS.filter(i => i.id !== 'key');
      const newItem = otherItems[Math.floor(Math.random() * otherItems.length)];

      setPlayer(prev => {
        let newStats = { ...prev.stats };
        let newHp = prev.hp;
        let newMaxHp = prev.maxHp;

        if (newItem.type === ItemType.WEAPON) newStats.attack += newItem.value;
        if (newItem.type === ItemType.ARMOR) { newMaxHp += newItem.value; newHp += newItem.value; }
        if (newItem.type === ItemType.CRIT_UP) newStats.critChance += newItem.value;

        return {
          ...prev,
          hp: newHp,
          maxHp: newMaxHp,
          stats: newStats,
          inventory: [...prev.inventory, newItem]
        };
      });

      showNotification(`¡Has encontrado: ${newItem.name}!`);

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
    } else if (item.type === ItemType.BOMB) {
       setPlayer(prev => {
          const newInv = [...prev.inventory];
          newInv.splice(index, 1);
          return { ...prev, inventory: newInv };
       });

       setMapData(prev => {
          const newTiles = prev.tiles.map(row => [...row]);
          let found = false;
          const radius = 2;
          for(let y = Math.max(0, player.y - radius); y <= Math.min(MAP_HEIGHT - 1, player.y + radius); y++) {
             for(let x = Math.max(0, player.x - radius); x <= Math.min(MAP_WIDTH - 1, player.x + radius); x++) {
                if (newTiles[y][x] === TileType.SECRET_WALL || newTiles[y][x] === TileType.TRAP_WALL) {
                   newTiles[y][x] = TileType.GRASS;
                   found = true;
                }
             }
          }
          if (found) showNotification("¡BOMBA! Muros ilusorios destruidos en área.");
          else showNotification("¡BOMBA! ...Pero no derribó ningún muro cercano.");
          return { ...prev, tiles: newTiles };
       });
       setShowInventory(false);
    }
  };

  // --- MAP LOADING ---
  const loadLevel = (index: number) => {
    setCurrentLevelIndex(index);
    const levelData = LEVELS[index];

    const newTiles = levelData.generateMap();

    // 0. Ensure start, boss, and portal areas are clear (3x3 minimum freedom)
    const freeArea = (cx: number, cy: number, radius: number) => {
       for(let y = cy - radius; y <= cy + radius; y++) {
          for(let x = cx - radius; x <= cx + radius; x++) {
             if (y > 0 && y < MAP_HEIGHT - 1 && x > 0 && x < MAP_WIDTH - 1) {
                if (newTiles[y][x] === TileType.WALL || newTiles[y][x] === TileType.SECRET_WALL || newTiles[y][x] === TileType.TRAP_WALL) {
                   newTiles[y][x] = levelData.theme === 'SNOW' ? TileType.ICE : TileType.GRASS;
                }
             }
          }
       }
    };
    
    freeArea(levelData.start.x, levelData.start.y, 1);
    freeArea(levelData.bossPos.x, levelData.bossPos.y, 1);
    freeArea(levelData.portalPos.x, levelData.portalPos.y, 1);

    // 1. Place Static Boss & Portal
    newTiles[levelData.portalPos.y][levelData.portalPos.x] = TileType.PORTAL;
    newTiles[levelData.bossPos.y][levelData.bossPos.x] = TileType.BOSS;

    // 2. Identify Valid Spawns
    const validSpawns: { x: number, y: number }[] = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        // Spawn on Grass or Ice only
        if (newTiles[y][x] === TileType.GRASS || newTiles[y][x] === TileType.ICE) {
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
        const validTemplates = ENEMY_TEMPLATES.map((t, i) => ({ t, i })).filter(({ t }) => index > 0 || (t.weakness !== Subject.ENGLISH && t.weakness !== Subject.PHYSICAL_ED));
        const templateIdx = validTemplates[Math.floor(Math.random() * validTemplates.length)].i;
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

  const resetMap1BoulderIfNeeded = () => {
    setMapData(prev => {
      let boulderPos: { x: number, y: number } | null = null;
      outer:
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (prev.tiles[y][x] === TileType.BOULDER) {
            boulderPos = { x, y };
            break outer;
          }
        }
      }

      // No hay roca en el mapa => el acertijo ya está resuelto (BUTTON_PRESSED). No tocar.
      if (!boulderPos) return prev;

      // La roca ya está en su sitio inicial. No tocar.
      if (boulderPos.x === MAP1_BOULDER_START.x && boulderPos.y === MAP1_BOULDER_START.y) return prev;

      const newTiles = prev.tiles.map(row => [...row]);
      newTiles[boulderPos.y][boulderPos.x] = TileType.GRASS;
      newTiles[MAP1_BOULDER_START.y][MAP1_BOULDER_START.x] = TileType.BOULDER;
      return { ...prev, tiles: newTiles };
    });
  };

  const handleBattleVictory = (xpGained: number, remainingHp: number, stats: { correct: number, incorrect: number, superEffective: number, timeBonus: number }) => {
    const newXp = player.xp + xpGained;
    const levelUp = newXp >= (player.level * 100);

    let isBoss = false;
    let baseEnemyName = '';

    if (currentEnemy) {
      isBoss = !!currentEnemy.isBoss;
      baseEnemyName = currentEnemy.name.replace('Guardián Letal: ', '');
      if (currentEnemy.isBoss) {
        const newTiles = mapData.tiles.map(row => [...row]);
        const bossPos = LEVELS[currentLevelIndex].bossPos;
        newTiles[bossPos.y][bossPos.x] = TileType.GRASS;
        setMapData(prev => ({ ...prev, tiles: newTiles }));
        showNotification(`¡JEFE DERROTADO! ¡EL CAMINO ESTÁ LIBRE!`);
      } else {
        setActiveEnemies(prev => prev.filter(e => e.id !== currentEnemy?.id));
        if (currentLevelIndex === 0) {
          resetMap1BoulderIfNeeded();
        }
      }
    }

    const nextLevel = levelUp ? player.level + 1 : player.level;
    const isEvolvingThisTurn = levelUp && (nextLevel === 4 || nextLevel === 7);

    // Calcular puntos de la batalla
    let pointsGained = isBoss ? 2000 : 200;
    pointsGained += stats.correct * 50;
    pointsGained += stats.superEffective * 50;
    pointsGained += stats.timeBonus;
    pointsGained -= stats.incorrect * 20;

    // Bonus impecable (sin fallos) contra enemigo o jefe
    if (stats.incorrect === 0) {
      pointsGained += isBoss ? 1500 : 100; // Flawless bonus
    }
    
    // Si no recibió daño
    if (remainingHp === player.hp) {
       pointsGained += isBoss ? 1000 : 50; // Untouched bonus
    }

    setPlayer(prev => {
      let newMaxHp = prev.maxHp;
      let currentHp = remainingHp;
      let newAttack = prev.stats.attack;

      if (levelUp) {
        newMaxHp += 20;
        currentHp = newMaxHp;
        newAttack += 5;
        showNotification(`¡NIVEL SUBIDO! ¡Salud restaurada! (+${pointsGained} PTS)`);
      } else {
        if (!isBoss) showNotification(`¡Batalla ganada! (+${pointsGained} PTS)`);
      }

      return {
        ...prev,
        xp: newXp,
        level: levelUp ? prev.level + 1 : prev.level,
        maxHp: newMaxHp,
        hp: currentHp,
        stats: { ...prev.stats, attack: newAttack },
        score: prev.score + pointsGained,
        correctAnswers: prev.correctAnswers + stats.correct,
        incorrectAnswers: prev.incorrectAnswers + stats.incorrect,
        superEffectiveAnswers: prev.superEffectiveAnswers + stats.superEffective,
        defeatedEnemies: (prev.defeatedEnemies || []).includes(baseEnemyName) 
          ? (prev.defeatedEnemies || [])
          : [...(prev.defeatedEnemies || []), baseEnemyName]
      };
    });

    if (baseEnemyName && !(player.defeatedEnemies || []).includes(baseEnemyName)) {
      setTimeout(() => {
        showNotification(`¡Has desbloqueado un nuevo enemigo en el Bestiario: ${baseEnemyName}!`);
      }, 3500); // Show after the battle won msg
    }

    setCurrentEnemy(null);
    setGameState(GameState.MAP);

    if (isEvolvingThisTurn) {
      setIsEvolving(true);
      setTimeout(() => {
        setIsEvolving(false);
        applyShockwave();
      }, 4000);
    }
  };

  const applyShockwave = () => {
     setShowShockwave(true);
     setTimeout(() => setShowShockwave(false), 2000); // UI visual timeout
     
     const px = playerRef.current.x;
     const py = playerRef.current.y;
     
     setActiveEnemies(prev => {
        return prev.map(enemy => {
           const dist = Math.max(Math.abs(enemy.x - px), Math.abs(enemy.y - py));
           // Repeler enemigos en un radio de 5 casillas
           if (dist <= 5 && dist > 0) {
              const dx = Math.sign(enemy.x - px);
              const dy = Math.sign(enemy.y - py);
              const xDir = dx === 0 && dy === 0 ? 1 : dx;
              const yDir = dx === 0 && dy === 0 ? 0 : dy;
              
              let newX = enemy.x;
              let newY = enemy.y;

              for(let i=0; i<3; i++) { // Empuja 3 casillas
                 const testX = newX + xDir;
                 const testY = newY + yDir;
                 if(testX >= 0 && testX < MAP_WIDTH && testY >= 0 && testY < MAP_HEIGHT) {
                    const tile = mapDataRef.current.tiles[testY][testX];
                    if([TileType.WALL, TileType.SECRET_WALL, TileType.TRAP_WALL, TileType.DOOR_CLOSED, TileType.BOULDER, TileType.BUTTON_PRESSED].includes(tile)) {
                       break; // Choca contra una pared real, para
                    }
                    newX = testX;
                    newY = testY;
                 }
              }
              return { ...enemy, x: newX, y: newY };
           }
           return enemy;
        });
     });
     showNotification("¡ONDA DE SABIDURÍA! Enemigos repelidos.");
  };

  const handleBattleHpUpdate = (currentHp: number) => {
    setPlayer(prev => ({ ...prev, hp: currentHp }));
  };

  const handleDefeat = () => {
    setGameState(GameState.GAME_OVER);
    saveScore(player);
  };

  // Vuelve a empezar conservando quién juega y con qué héroe.
  const nuevoJugador = (prev: Player): Player => ({ ...INITIAL_PLAYER, name: prev.name, hero: prev.hero });

  const resetGame = () => {
    setPlayer(nuevoJugador);
    setGameState(GameState.START_SCREEN);
  };

  const handleEndGame = () => {
    saveScore(player);
    setPlayer(nuevoJugador);
    setGameState(GameState.START_SCREEN);
    showNotification("Progreso guardado. ¡Hasta pronto!");
  };

  const currentLevelTitle = LEVELS[currentLevelIndex].title;

  // XP Logic
  const nextLevelXp = player.level * 100;
  const prevLevelXp = (player.level - 1) * 100;
  const xpPercentage = Math.min(100, Math.max(0, ((player.xp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100));

  const enJuego = gameState === GameState.MAP || gameState === GameState.BATTLE;
  const heroeArte = getHeroArt(player.hero, player.level);
  const skin = SKINS.find(s => s.id === player.hero.skin)!;
  const nombreHeroe = `${skin.formas[player.hero.genero][formaDe(player.level) - 1]} · ${skin.nombre[player.hero.genero]}`;
  const vidaBaja = player.hp / player.maxHp <= 0.3;

  if (yo === undefined) return <div className="min-h-screen"><Fondo /></div>;
  if (yo?.rol === 'docente') return <PanelProfe nombre={yo.nombre} onSalir={salir} />;
  if (!isLoggedIn) return <LoginScreen onEntrar={alEntrar} />;
  const alumno = yo?.rol === 'alumno' ? yo : null;
  const textos = narrativa(alumno?.clase ?? '5ºB', alumno?.curso ?? 5);

  return (
    <div className="min-h-screen flex flex-col items-center relative select-none overflow-x-hidden">
      <Fondo />

      {/* EVOLUCIÓN */}
      {isEvolving && (
        <div className="velo z-[100] flex-col overflow-hidden" role="status" aria-live="polite">
          <div className="evolucion-luz" aria-hidden="true" />
          <h2 className="relative text-center text-[clamp(1.6rem,5vw,3.2rem)] m-0" style={{ color: 'var(--dorado-claro)', textShadow: '0 0 30px rgba(232,184,74,.7)' }}>
            ¡La luz del saber te envuelve!
          </h2>
          <div className="relative w-[min(70vw,340px)] aspect-square my-6">
            <img src={getHeroArt(player.hero, player.level - 1)} alt="" className="absolute inset-0 w-full evo-sale" />
            <img src={heroeArte} alt={nombreHeroe} className="absolute inset-0 w-full evo-entra" />
          </div>
          <p className="relative titulo text-xl text-center" style={{ color: 'var(--runa-clara)' }}>
            {player.level >= 7 ? '¡Alcanzas tu forma definitiva!' : '¡Tu héroe se hace más fuerte!'}
          </p>
        </div>
      )}

      {/* ONDA EXPANSIVA */}
      {showShockwave && gameState === GameState.MAP && (
        <div className="fixed inset-0 pointer-events-none z-[40] flex items-center justify-center overflow-hidden" aria-hidden="true">
          <div className="w-10 h-10 border-[20px] rounded-full animate-ping" style={{ borderColor: 'rgba(246,210,122,.8)', animationDuration: '2s' }} />
          <div className="absolute w-10 h-10 border-[10px] rounded-full animate-ping" style={{ borderColor: 'rgba(185,155,255,.6)', animationDuration: '2.2s' }} />
        </div>
      )}

      {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} />}

      {/* HUD */}
      {enJuego && (
        <header className="hud fixed top-0 left-0 w-full z-50 px-3 py-2 flex items-center gap-3">
          <div className="retrato" title={nombreHeroe}>
            <span className="retrato-cara"><img src={heroeArte} alt="" /></span>
            <span className="nivel-chapa" aria-label={`Nivel ${player.level}`}>{player.level}</span>
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3 min-w-0 leading-tight">
              <span className="titulo truncate text-[0.95rem] md:text-[1.05rem]" style={{ color: 'var(--dorado)' }}>{currentLevelTitle}</span>
              <span className="creditos shrink-0 !text-[0.68rem] sm:!text-[0.78rem]">Creado por Javi Barrero</span>
            </div>
            <div className={`barra vida ${vidaBaja ? 'baja' : ''}`} role="meter" aria-label="Vida" aria-valuemin={0} aria-valuemax={player.maxHp} aria-valuenow={player.hp}>
              <i style={{ width: `${Math.max(0, (player.hp / player.maxHp) * 100)}%` }} />
              <span>{player.hp} / {player.maxHp}</span>
            </div>
            <div className="barra xp" role="meter" aria-label="Experiencia" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(xpPercentage)} title={`XP ${player.xp} / ${nextLevelXp}`}>
              <i style={{ width: `${xpPercentage}%` }} />
            </div>
          </div>
          <span className="chapa hidden sm:inline-flex" aria-label="Puntos"><Star size={14} fill="currentColor" /> {player.score}</span>
          <nav className="flex gap-2" aria-label="Menú del juego">
            <button className="medallon" onClick={() => setShowGallery(true)} aria-label="Bestiario" title="Bestiario"><Icono nombre="libro" /></button>
            <button className="medallon" onClick={() => setShowInventory(true)} aria-label="Mochila" title="Mochila"><Icono nombre="mochila" /></button>
            <button className="medallon" onClick={handleEndGame} aria-label="Guardar y salir" title="Guardar y salir"><Icono nombre="puerta" /></button>
          </nav>
        </header>
      )}

      {/* Aviso flotante */}
      {notification && (
        <div className="fixed top-28 left-0 w-full flex justify-center px-4 pointer-events-none z-[55]" role="status" aria-live="polite">
          <div className="aviso w-full max-w-sm">{notification}</div>
        </div>
      )}

      {showGallery && (
        <Gallery defeatedEnemies={player.defeatedEnemies} onClose={() => setShowGallery(false)} />
      )}

      {/* MOCHILA */}
      {showInventory && (
        <div className="velo z-[60]" onClick={() => setShowInventory(false)}>
          <div className="modal max-w-lg" role="dialog" aria-modal="true" aria-labelledby="titulo-mochila" onClick={e => e.stopPropagation()}>
            <div className="modal-cabecera">
              <span className="medallon pointer-events-none"><Icono nombre="mochila" /></span>
              <h2 id="titulo-mochila">Mochila</h2>
              <button className="medallon" onClick={() => setShowInventory(false)} aria-label="Cerrar" autoFocus><X size={22} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4 pb-0">
              {[
                { t: 'Ataque', v: player.stats.attack, i: <Sword size={18} />, c: 'var(--runa-clara)' },
                { t: 'Vida máx.', v: player.maxHp, i: <Heart size={18} />, c: '#ff8a8a' },
                { t: 'Crítico', v: `${player.stats.critChance}%`, i: <Zap size={18} />, c: 'var(--dorado-claro)' },
              ].map(e => (
                <div key={e.t} className="ficha text-center">
                  <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--tenue)' }}>{e.t}</div>
                  <div className="titulo text-xl flex items-center justify-center gap-2" style={{ color: e.c }}>{e.i} {e.v}</div>
                </div>
              ))}
            </div>
            <div className="modal-cuerpo scroll-fino">
              {player.inventory.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--tenue)' }}>
                  <img src="/arte/iconos/mochila.webp" alt="" className="w-20 mx-auto opacity-60 mb-2" />
                  Tu mochila está vacía. Busca cofres por el mapa.
                </div>
              ) : (
                <ul className="grid gap-2 m-0 p-0 list-none">
                  {player.inventory.map((item, idx) => (
                    <li key={idx} className="ficha flex items-center gap-3">
                      <span className="medallon pointer-events-none !w-14 !h-14"><img src={arteObjeto(item)} alt="" /></span>
                      <div className="flex-1 min-w-0">
                        <p className="m-0 font-bold">{item.name}</p>
                        <p className="m-0 text-sm" style={{ color: 'var(--tenue)' }}>{item.description}</p>
                      </div>
                      {item.type === ItemType.POTION && (
                        <button onClick={() => handleUseItem(item, idx)} className="btn-oro !min-h-[44px] !px-4 !text-base shrink-0">Usar</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cabecera de las pantallas fuera del mapa */}
      {!enJuego && (
        <header className="cabecera capa w-full">
          <h1>Quest for Knowledge</h1>
          <Estandarte />
          <span className="creditos text-right">Creado por Javi Barrero</span>
        </header>
      )}

      <main className={`capa w-full flex-1 flex flex-col items-center ${enJuego ? 'max-w-6xl px-1 md:px-4 mt-[92px] mb-2' : 'max-w-5xl px-4 pt-24 pb-10 justify-center'}`}>

        {gameState === GameState.HERO_SELECT && (
          <HeroSelect nombre={player.name} inicial={player.hero} onElegir={elegirHeroe} />
        )}

        {gameState === GameState.START_SCREEN && (
          <div className="w-full grid md:grid-cols-2 gap-6 items-center entrar">
            <div className="escenario w-full max-w-[360px] mx-auto">
              <img className="heroe-img flotar" src={heroeArte} alt={nombreHeroe} />
            </div>
            <div className="panel flex flex-col gap-4 text-center md:text-left">
              <div>
                <p className="m-0 text-sm uppercase tracking-[0.2em]" style={{ color: 'var(--runa-clara)' }}>Repaso de {alumno?.curso ?? 5}º</p>
                <h2 className="m-0 text-[clamp(2rem,5vw,3.2rem)] leading-none" style={{ color: 'var(--dorado)', textShadow: '0 0 26px rgba(232,184,74,.4)' }}>Quest for Knowledge</h2>
                <p className="mt-3 mb-0 text-lg">¡Hola, <strong style={{ color: 'var(--dorado-claro)' }}>{player.name}</strong>! Hoy luchas como <strong style={{ color: 'var(--dorado-claro)' }}>{skin.nombre[player.hero.genero]}</strong>.</p>
              </div>
              <button className="btn-oro text-xl w-full" onClick={startGame}>Jugar</button>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button className="btn-cuero" onClick={() => setShowLeaderboard(true)}>Ver ranking</button>
                <button className="btn-cuero" onClick={() => setGameState(GameState.HERO_SELECT)}>Cambiar héroe</button>
                <button className="btn-cuero" onClick={salir}>Salir</button>
              </div>
            </div>
          </div>
        )}

        {gameState === GameState.NARRATIVE && (
          <RetroBox title={narrativeStep === 'PROLOGUE' ? 'Prólogo' : 'Tu misión'} className="w-full max-w-3xl flex flex-col max-h-[calc(100dvh-140px)] entrar">
            <div className="pergamino overflow-y-auto scroll-fino flex-1 pr-2 mb-5">
              {narrativeStep === 'PROLOGUE' ? textos.PROLOGUE : textos.MISSION}
            </div>
            <button className="btn-oro self-center min-w-[240px]" onClick={advanceNarrative}>
              {narrativeStep === 'PROLOGUE' ? 'Siguiente' : 'Aceptar la misión'}
            </button>
          </RetroBox>
        )}

        {gameState === GameState.MAP && (
          <div className="flex flex-col items-center justify-start w-full flex-1 mt-2">
            <CanvasMapView mapData={mapData} player={player} activeEnemies={activeEnemies} onMove={handleMove} theme={LEVELS[currentLevelIndex].theme} />
            <p className="chapa mt-2 hidden md:inline-flex !font-[Rubik] !text-[0.95rem]">
              {mapData.tiles.some(r => r.includes(TileType.BOSS))
                ? '¡Derrota al Director del Caos para liberar el portal!'
                : '¡El camino está libre! Entra en el portal.'}
            </p>
          </div>
        )}

        {gameState === GameState.BATTLE && currentEnemy && (
          <div className="w-full flex-1 flex justify-center mt-2 md:mt-4">
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
          <div className="w-full max-w-xl text-center entrar">
            <div className="escenario max-w-[260px] mx-auto">
              <img className="heroe-img" style={{ filter: 'grayscale(.8) brightness(.6) drop-shadow(0 12px 18px rgba(0,0,0,.6))' }} src={heroeArte} alt="" />
            </div>
            <RetroBox title="Has caído en combate">
              <p className="text-lg mt-0">El caos ha ganado esta vez, pero todo lo que has aprendido sigue contigo. ¡Inténtalo de nuevo!</p>
              <RetroButton onClick={resetGame} className="w-full">Volver a intentarlo</RetroButton>
            </RetroBox>
          </div>
        )}

        {gameState === GameState.VICTORY && (
          <div className="w-full max-w-xl text-center entrar">
            <div className="escenario max-w-[300px] mx-auto">
              <img className="heroe-img flotar" src={heroeArte} alt="" />
            </div>
            <RetroBox title="¡Gran victoria!">
              <p className="text-lg mt-0 text-left">
                Has completado todos los niveles. El caos ha sido derrotado y el conocimiento ha vuelto al mundo.
                <br /><br />
                <strong style={{ color: 'var(--dorado-claro)' }}>¡Eres un verdadero Guardián de la Memoria!</strong>
              </p>
              <RetroButton onClick={resetGame} className="w-full">Jugar de nuevo</RetroButton>
            </RetroBox>
          </div>
        )}

      </main>
    </div>
  );
}
