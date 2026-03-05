import React, { useLayoutEffect, useRef, useState } from 'react';
import { TileType, Player, GameMap, Entity, ActiveEnemy } from '../types';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, LevelTheme, ENEMY_TEMPLATES } from '../constants';
import { Skull, Crown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Lock, Cloud, BookOpen, TreeDeciduous, BrickWall } from 'lucide-react';

// THEME STYLES (Moved outside component for stability and performance)
const getThemeStyles = (type: TileType, x: number, y: number, theme: LevelTheme) => {
  const style: React.CSSProperties = {
    width: TILE_SIZE,
    height: TILE_SIZE,
    left: x * TILE_SIZE,
    top: y * TILE_SIZE,
  };
  let className = "absolute flex items-center justify-center "; // removed transition-all duration-100 to reduce lag
  let content = null;

  // --- WALLS & SECRET WALLS ---
  if (type === TileType.WALL || type === TileType.SECRET_WALL) {
    className += "shadow-lg z-10 ";

    // Base Wall Style
    if (theme === 'CLASSROOM') {
      style.backgroundColor = "#7c2d12"; // Wood
      style.backgroundImage = "linear-gradient(90deg, #7c2d12 50%, #451a03 50%)";
      style.backgroundSize = "20px 100%";
      style.boxShadow = "0 4px 0 #271001";
      content = <div className="w-full h-2 bg-[#92400e] mt-4 opacity-50"></div>;
    } else if (theme === 'GARDEN') {
      style.backgroundColor = "#14532d";
      style.backgroundImage = "radial-gradient(circle at 10px 10px, #166534 2px, transparent 3px)";
      style.boxShadow = "0 4px 0 #052e16";
      content = <TreeDeciduous size={24} className="text-green-700 opacity-60" />;
    } else {
      style.backgroundColor = "#1e293b";
      style.border = "1px solid #0f172a";
      style.backgroundImage = `repeating-linear-gradient(45deg, #334155 0, #334155 2px, #1e293b 2px, #1e293b 8px)`;
      style.boxShadow = "0 4px 0 #020617";
    }

    // Secret Wall Distinctions (Subtle)
    if (type === TileType.SECRET_WALL) {
      content = <BrickWall size={20} className="text-white/20 opacity-30" />;
      style.filter = "brightness(0.9)";
    }

    return { style, className, content };
  }

  // --- FLOORS (Grass, Path, Empty) ---
  if (type === TileType.GRASS || type === TileType.PATH || type === TileType.HIDDEN_ENEMY) {
    if (theme === 'CLASSROOM') {
      style.backgroundColor = "#d97706";
      style.backgroundImage = "repeating-linear-gradient(0deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 11px)";
      style.border = "1px solid rgba(0,0,0,0.05)";
    } else if (theme === 'GARDEN') {
      if (type === TileType.PATH) {
        style.backgroundColor = "#a8a29e";
        style.backgroundImage = "radial-gradient(circle, #d6d3d1 1px, transparent 1px)";
      } else {
        style.backgroundColor = "#22c55e";
        style.backgroundImage = `
                  linear-gradient(45deg, #16a34a 25%, transparent 25%, transparent 75%, #16a34a 75%, #16a34a),
                  linear-gradient(45deg, #16a34a 25%, transparent 25%, transparent 75%, #16a34a 75%, #16a34a)
              `;
        style.backgroundSize = "20px 20px";
        style.backgroundPosition = "0 0, 10px 10px";
      }
    } else {
      style.backgroundColor = "#475569";
      style.backgroundImage = "radial-gradient(circle at 24px 24px, #334155 20px, transparent 21px)";
      style.border = "1px solid #1e293b";
    }
    return { style, className, content };
  }

  return { style, className, content };
};

const TileCell = React.memo(({ type, x, y, isVisible, theme }: { type: TileType, x: number, y: number, isVisible: boolean, theme: LevelTheme }) => {
  if (!isVisible) {
    return (
      <div
        className="absolute z-40 bg-[#050505] transition-none pointer-events-none"
        style={{
          width: TILE_SIZE + 2,
          height: TILE_SIZE + 2,
          left: x * TILE_SIZE - 1,
          top: y * TILE_SIZE - 1,
          boxShadow: '0 0 16px 8px #050505',
          zIndex: 40
        }}
      />
    );
  }

  const { style, className, content } = getThemeStyles(type, x, y, theme);
  let ObjectContent = content;

  switch (type) {
    case TileType.CHEST:
      ObjectContent = (
        <div className="relative w-8 h-6 bg-yellow-600 border-2 border-yellow-900 rounded-sm flex items-center justify-center shadow-lg animate-bounce z-20">
          <div className="absolute top-0 w-full h-2 bg-yellow-400 border-b border-yellow-900"></div>
          <div className="w-1 h-2 bg-black/40 mt-1"></div>
        </div>
      );
      break;
    case TileType.BOSS:
      ObjectContent = <Crown size={32} className="text-yellow-400 drop-shadow-[0_0_5px_rgba(234,179,8,0.9)] animate-pulse z-20 bg-black/50 rounded-full p-1" />;
      break;
    case TileType.PORTAL:
      ObjectContent = (
        <div className="w-full h-full bg-purple-600/60 animate-pulse border-2 border-purple-400 flex items-center justify-center shadow-[0_0_15px_#a855f7] z-20 rounded-full">
          <div className="w-4 h-6 bg-white/80 rounded-full blur-sm"></div>
        </div>
      );
      break;
  }

  return (
    <div className={className} style={style}>
      {ObjectContent}
    </div>
  );
});

interface MapViewProps {
  mapData: GameMap;
  player: Player;
  activeEnemies: ActiveEnemy[];
  onMove: (dx: number, dy: number) => void;
  interactionTarget?: Entity | null;
  theme: LevelTheme;
}

const MapView: React.FC<MapViewProps> = ({ mapData, player, activeEnemies, onMove, theme }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  const [isReady, setIsReady] = useState(false);

  const onMoveRef = useRef(onMove);

  // Update ref whenever onMove changes
  useLayoutEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default scrolling for arrow keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowUp': onMoveRef.current(0, -1); break;
        case 'ArrowDown': onMoveRef.current(0, 1); break;
        case 'ArrowLeft': onMoveRef.current(-1, 0); break;
        case 'ArrowRight': onMoveRef.current(1, 0); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty dependency array = listener attached once!

  // Camera Logic
  useLayoutEffect(() => {
    let animationFrameId: number;

    const updateCamera = () => {
      if (!containerRef.current) return;
      const containerW = containerRef.current.clientWidth;
      const containerH = containerRef.current.clientHeight;

      const playerPixelX = player.x * TILE_SIZE + TILE_SIZE / 2;
      const playerPixelY = player.y * TILE_SIZE + TILE_SIZE / 2;

      let newX = (containerW / 2) - playerPixelX;
      let newY = (containerH / 2) - playerPixelY;

      // Soft clamping logic
      const minX = containerW - (MAP_WIDTH * TILE_SIZE);
      const maxX = 0;
      const minY = containerH - (MAP_HEIGHT * TILE_SIZE);
      const maxY = 0;

      if (MAP_WIDTH * TILE_SIZE > containerW) {
        newX = Math.min(maxX, Math.max(minX, newX));
      } else {
        newX = (containerW - MAP_WIDTH * TILE_SIZE) / 2;
      }

      if (MAP_HEIGHT * TILE_SIZE > containerH) {
        newY = Math.min(maxY, Math.max(minY, newY));
      } else {
        newY = (containerH - MAP_HEIGHT * TILE_SIZE) / 2;
      }

      setCameraOffset({ x: newX, y: newY });
      if (!isReady) setIsReady(true);
    };

    updateCamera();

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(updateCamera);
    });

    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, [player.x, player.y, mapData.width, mapData.height, isReady]);

  return (
    <div className="w-full h-full flex-1 flex justify-center items-stretch pt-2 pb-0">
      {/* VIEWPORT */}
      <div
        ref={containerRef}
        className={`relative overflow-hidden border-4 md:border-8 border-[#111] md:border-[#333] rounded-sm md:rounded-lg shadow-2xl bg-[#050505] w-full flex-1 min-h-[60vh] md:min-h-0 transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* THE WORLD */}
        <div
          className="absolute top-0 left-0 transition-none will-change-[transform]"
          style={{
            width: MAP_WIDTH * TILE_SIZE,
            height: MAP_HEIGHT * TILE_SIZE,
            transform: `translate3d(${cameraOffset.x}px, ${cameraOffset.y}px, 0)`
          }}
        >
          {/* TILES LAYER */}
          {mapData.tiles.map((row, y) =>
            row.map((tile, x) => (
              <TileCell
                key={`${x}-${y}`}
                type={tile}
                x={x}
                y={y}
                isVisible={mapData.visited[y][x]}
                theme={theme}
              />
            ))
          )}

          {/* ENEMIES LAYER */}
          {activeEnemies.map((enemy) => {
            const isVisible = mapData.visited[enemy.y][enemy.x];
            if (!isVisible) return null;

            const template = ENEMY_TEMPLATES[enemy.templateIndex];
            let spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/94.gif"; // Gengar

            if (template.spriteId === "goblin") spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/302.gif";
            else if (template.spriteId === "ogre") spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/68.gif";
            else if (template.spriteId === "slime") spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/88.gif";
            else if (template.spriteId === "skeleton") spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/105.gif";
            else if (template.spriteId === "bat") spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/41.gif"; // Zubat
            else if (template.spriteId === "ghost") spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/92.gif"; // Gastly
            else if (template.spriteId === "snake") spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/23.gif"; // Ekans
            else if (template.spriteId === "knight") spriteUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/625.gif"; // Bisharp

            return (
              <div
                key={enemy.id}
                className="absolute transition-all duration-300 z-30"
                style={{
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                  left: enemy.x * TILE_SIZE,
                  top: enemy.y * TILE_SIZE,
                }}
              >
                <div className="w-full h-full flex items-center justify-center -mt-3">
                  <img
                    src={spriteUrl}
                    alt="Enemy"
                    className="w-12 h-12 object-contain drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              </div>
            );
          })}

          {/* Player Sprite */}
          <div
            className="absolute transition-none z-30 will-change-[left,top]"
            style={{
              width: TILE_SIZE,
              height: TILE_SIZE,
              left: player.x * TILE_SIZE,
              top: player.y * TILE_SIZE,
            }}
          >
            <div className="w-full h-full flex items-center justify-center -mt-3">
              <img
                src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/475.gif"
                alt="Hero"
                className="w-14 h-14 object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>

          {/* DYNAMIC LIGHTING / PROGRESSIVE FOG OVERLAY */}
          <div
            className="absolute top-0 left-0 pointer-events-none z-50 transition-none"
            style={{
              width: MAP_WIDTH * TILE_SIZE,
              height: MAP_HEIGHT * TILE_SIZE,
              background: `radial-gradient(circle at ${player.x * TILE_SIZE + TILE_SIZE / 2}px ${player.y * TILE_SIZE + TILE_SIZE / 2}px, transparent 0px, rgba(0,0,0,0.1) ${TILE_SIZE * 2}px, rgba(0,0,0,0.5) ${TILE_SIZE * 3.5}px, rgba(0,0,0,0.85) ${TILE_SIZE * 5.5}px, rgba(0,0,0,0.9) 100%)`
            }}
          />
        </div>

        {/* Scanline overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-50"></div>
      </div>

      {/* D-Pad Overlay */}
      <div className="fixed bottom-6 right-6 w-36 h-36 md:hidden z-[100] opacity-90 touch-none select-none">
        <div className="relative w-full h-full bg-black/40 rounded-full backdrop-blur-sm border border-white/20 p-2 shadow-xl">
          <button
            onClick={() => onMove(0, -1)}
            className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-12 bg-gray-800/90 border-2 border-white/30 rounded-t-lg active:bg-blue-600 active:border-blue-300 flex items-center justify-center shadow-lg transition-colors"
          >
            <ChevronUp className="text-white" size={32} />
          </button>
          <button
            onClick={() => onMove(0, 1)}
            className="absolute bottom-1 left-1/2 -translate-x-1/2 w-12 h-12 bg-gray-800/90 border-2 border-white/30 rounded-b-lg active:bg-blue-600 active:border-blue-300 flex items-center justify-center shadow-lg transition-colors"
          >
            <ChevronDown className="text-white" size={32} />
          </button>
          <button
            onClick={() => onMove(-1, 0)}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800/90 border-2 border-white/30 rounded-l-lg active:bg-blue-600 active:border-blue-300 flex items-center justify-center shadow-lg transition-colors"
          >
            <ChevronLeft className="text-white" size={32} />
          </button>
          <button
            onClick={() => onMove(1, 0)}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800/90 border-2 border-white/30 rounded-r-lg active:bg-blue-600 active:border-blue-300 flex items-center justify-center shadow-lg transition-colors"
          >
            <ChevronRight className="text-white" size={32} />
          </button>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-gray-900/80 rounded-full border border-white/20"></div>
        </div>
      </div>
    </div>
  );
};

export default MapView;