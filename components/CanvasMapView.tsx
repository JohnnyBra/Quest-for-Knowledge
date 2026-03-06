import React, { useRef, useEffect, useState } from 'react';
import { TileType, Player, GameMap, ActiveEnemy } from '../types';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, LevelTheme, ENEMY_TEMPLATES } from '../constants';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface MapViewProps {
  mapData: GameMap;
  player: Player;
  activeEnemies: ActiveEnemy[];
  onMove: (dx: number, dy: number) => void;
  theme: LevelTheme;
}

const getEnemySpriteUrl = (templateId: string) => {
  switch (templateId) {
    case "goblin": return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/302.gif";
    case "ogre": return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/68.gif";
    case "slime": return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/88.gif";
    case "skeleton": return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/105.gif";
    case "bat": return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/41.gif";
    case "ghost": return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/92.gif";
    case "snake": return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/23.gif";
    case "knight": return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/625.gif";
    case "boss": return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/491.gif";
    default: return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/94.gif";
  }
};

const CACHE: Record<string, HTMLImageElement> = {};
const getImage = (url: string) => {
  if (CACHE[url]) return CACHE[url];
  const img = new Image();
  img.src = url;
  img.crossOrigin = "Anonymous";
  CACHE[url] = img;
  return img;
};

// Player Image
const HERO_SPRITE = getImage("https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/475.gif");
const BOSS_SPRITE = getImage("https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/491.gif");

const CanvasMapView: React.FC<MapViewProps> = ({ mapData, player, activeEnemies, onMove, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keybindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      switch (e.key) {
        case 'ArrowUp': onMove(0, -1); break;
        case 'ArrowDown': onMove(0, 1); break;
        case 'ArrowLeft': onMove(-1, 0); break;
        case 'ArrowRight': onMove(1, 0); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onMove]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    let animationId: number;
    let time = 0;

    const render = () => {
      time++;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        ctx.imageSmoothingEnabled = false;
      }

      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);

      const px = player.x * TILE_SIZE + TILE_SIZE / 2;
      const py = player.y * TILE_SIZE + TILE_SIZE / 2;

      let camX = w / 2 - px;
      let camY = h / 2 - py;

      // Soft constraints
      const mapPixelW = MAP_WIDTH * TILE_SIZE;
      const mapPixelH = MAP_HEIGHT * TILE_SIZE;
      
      camX = Math.min(0, Math.max(w - mapPixelW, camX));
      camY = Math.min(0, Math.max(h - mapPixelH, camY));

      if (mapPixelW < w) camX = (w - mapPixelW) / 2;
      if (mapPixelH < h) camY = (h - mapPixelH) / 2;

      ctx.save();
      ctx.translate(Math.floor(camX), Math.floor(camY));

      // Draw map
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (!mapData.visited[y]?.[x]) continue;

          const tile = mapData.tiles[y][x];
          const tx = x * TILE_SIZE;
          const ty = y * TILE_SIZE;

          // Background
          if (tile === TileType.WALL || tile === TileType.SECRET_WALL || tile === TileType.TRAP_WALL || tile === TileType.DOOR_CLOSED) {
            ctx.fillStyle = tile === TileType.DOOR_CLOSED ? '#334155' : theme === 'CLASSROOM' ? '#7c2d12' : theme === 'GARDEN' ? '#14532d' : theme === 'SNOW' ? '#64748b' : '#1e293b';
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            if (tile === TileType.DOOR_CLOSED) {
              ctx.lineWidth = 2;
              ctx.strokeStyle = '#0f172a';
              ctx.strokeRect(tx + 4, ty + 4, TILE_SIZE - 8, TILE_SIZE - 8);
              ctx.fillStyle = '#f59e0b';
              ctx.beginPath();
              ctx.arc(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2, 4, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillStyle = 'rgba(0,0,0,0.5)';
              ctx.fillRect(tx, ty + TILE_SIZE - 4, TILE_SIZE, 4); // Fake 3D
            }
          } else if (tile === TileType.ICE) {
            ctx.fillStyle = '#e0f2fe';
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#bae6fd';
            ctx.fillRect(tx, ty, TILE_SIZE, 2);
          } else {
            // Include PATH, GRASS, DOOR_OPEN, BUTTON, BOULDER (background is floor)
            ctx.fillStyle = theme === 'CLASSROOM' ? '#d97706' : theme === 'GARDEN' ? '#22c55e' : theme === 'SNOW' ? '#e2e8f0' : '#475569';
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            if (tile === TileType.DOOR_OPEN) {
              ctx.fillStyle = 'rgba(0,0,0,0.2)';
              ctx.fillRect(tx + 4, ty + 4, 8, TILE_SIZE - 8);
              ctx.fillRect(tx + TILE_SIZE - 12, ty + 4, 8, TILE_SIZE - 8);
            }
          }

          // Floor Details / Puzzle Objects
          if (tile === TileType.BUTTON || tile === TileType.BUTTON_PRESSED) {
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(tx + 8, ty + 8, TILE_SIZE - 16, TILE_SIZE - 16);
            ctx.fillStyle = tile === TileType.BUTTON_PRESSED ? '#ef4444' : '#64748b'; // Red when pressed
            ctx.fillRect(tx + 12, ty + 12, TILE_SIZE - 24, TILE_SIZE - 24);
          }

          if (tile === TileType.BOULDER || tile === TileType.BUTTON_PRESSED) {
             ctx.fillStyle = '#57534e';
             ctx.beginPath();
             ctx.arc(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2 - 2, 16, 0, Math.PI * 2);
             ctx.fill();
             ctx.fillStyle = '#78716c';
             ctx.beginPath();
             ctx.arc(tx + TILE_SIZE / 2 - 4, ty + TILE_SIZE / 2 - 6, 6, 0, Math.PI * 2);
             ctx.fill();
          }

          // Objects
          if (tile === TileType.CHEST) {
            ctx.fillStyle = '#ca8a04';
            ctx.fillRect(tx + 8, ty + 12 - (Math.sin(time / 10) * 2), TILE_SIZE - 16, TILE_SIZE - 20);
            ctx.fillStyle = 'black';
            ctx.fillRect(tx + 22, ty + 16 - (Math.sin(time / 10) * 2), 4, 6);
          } else if (tile === TileType.SECRET_WALL || tile === TileType.TRAP_WALL) {
            // Very subtle visual hint for trained eyes (A slight shift or icon hovering)
            const isNearPlayer = Math.abs(x - player.x) <= 2 && Math.abs(y - player.y) <= 2;
            if (isNearPlayer) {
              ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + Math.sin(time / 15) * 0.1})`;
              ctx.font = "bold 16px monospace";
              ctx.textAlign = "center";
              ctx.fillText("?", tx + TILE_SIZE / 2, ty + TILE_SIZE / 2 + 5);
            }
          } else if (tile === TileType.BOSS) {
             if (BOSS_SPRITE.complete && BOSS_SPRITE.naturalWidth !== 0) {
               ctx.drawImage(BOSS_SPRITE, tx - 10, ty - 20, TILE_SIZE + 20, TILE_SIZE + 20);
             } else {
               ctx.fillStyle = '#eab308';
               ctx.beginPath();
               ctx.arc(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2, 16, 0, Math.PI * 2);
               ctx.fill();
             }
          } else if (tile === TileType.PORTAL) {
            ctx.fillStyle = `rgba(168, 85, 247, ${0.5 + Math.sin(time / 5) * 0.3})`;
            ctx.beginPath();
            ctx.arc(tx + TILE_SIZE / 2, ty + TILE_SIZE / 2, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 4;
            ctx.stroke();
          }
        }
      }

      // Draw Enemies
      activeEnemies.forEach(enemy => {
         if (!mapData.visited[enemy.y]?.[enemy.x]) return;
         const spriteUrl = getEnemySpriteUrl(ENEMY_TEMPLATES[enemy.templateIndex]?.spriteId || 'ghost');
         const img = getImage(spriteUrl);
         const tx = enemy.x * TILE_SIZE;
         const ty = enemy.y * TILE_SIZE;

         const bounceOffset = Math.sin(time / 10 + enemy.x) * 3;

         if (img.complete && img.naturalWidth !== 0) {
           ctx.drawImage(img, tx - 8, ty - 16 + bounceOffset, TILE_SIZE + 16, TILE_SIZE + 16);
         } else {
           ctx.fillStyle = 'red';
           ctx.fillRect(tx + 8, ty + 8 + bounceOffset, 32, 32);
         }
      });

      // Draw Hero
      const heroTx = player.x * TILE_SIZE;
      const heroTy = player.y * TILE_SIZE;
      if (HERO_SPRITE.complete && HERO_SPRITE.naturalWidth !== 0) {
         ctx.drawImage(HERO_SPRITE, heroTx - 8, heroTy - 16, TILE_SIZE + 16, TILE_SIZE + 16);
      } else {
         ctx.fillStyle = 'blue';
         ctx.fillRect(heroTx + 8, heroTy + 8, 32, 32);
      }

      // Lighting / Vignette
      const gradient = ctx.createRadialGradient(
        px, py, TILE_SIZE * 2,
        px, py, TILE_SIZE * 6
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(0.5, 'rgba(0,0,0,0.5)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.95)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, mapPixelW, mapPixelH);

      // Draw unvisited fog completely black
      ctx.fillStyle = '#000000';
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
           if (!mapData.visited[y]?.[x]) {
             ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
           }
        }
      }

      ctx.restore();

      // Scanline CRT Effect 16-bit
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for(let i = 0; i < h; i += 4) {
         ctx.fillRect(0, i, w, 1);
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [mapData, player, activeEnemies, theme]);

  return (
    <div className="w-full h-full flex-1 flex justify-center items-stretch pt-2 pb-0">
      <div ref={containerRef} className="relative overflow-hidden border-4 md:border-8 border-[#333] rounded-lg shadow-2xl bg-[#050505] w-full flex-1 min-h-[60vh] md:min-h-0">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

       {/* D-Pad Overlay */}
      <div className="fixed bottom-6 right-6 w-36 h-36 md:hidden z-[100] opacity-90 touch-none select-none">
        <div className="relative w-full h-full bg-black/40 rounded-full backdrop-blur-sm border border-white/20 p-2 shadow-xl">
          <button onClick={() => onMove(0, -1)} className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-12 bg-gray-800 border-2 border-white/30 rounded-t-lg flex items-center justify-center"><ChevronUp className="text-white" size={32} /></button>
          <button onClick={() => onMove(0, 1)} className="absolute bottom-1 left-1/2 -translate-x-1/2 w-12 h-12 bg-gray-800 border-2 border-white/30 rounded-b-lg flex items-center justify-center"><ChevronDown className="text-white" size={32} /></button>
          <button onClick={() => onMove(-1, 0)} className="absolute left-1 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800 border-2 border-white/30 rounded-l-lg flex items-center justify-center"><ChevronLeft className="text-white" size={32} /></button>
          <button onClick={() => onMove(1, 0)} className="absolute right-1 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800 border-2 border-white/30 rounded-r-lg flex items-center justify-center"><ChevronRight className="text-white" size={32} /></button>
        </div>
      </div>
    </div>
  );
};

export default CanvasMapView;
