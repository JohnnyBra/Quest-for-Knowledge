import React, { useRef, useEffect } from 'react';
import { TileType, Player, GameMap, ActiveEnemy } from '../types';
import { TILE_SIZE as T, MAP_WIDTH, MAP_HEIGHT, LevelTheme, ENEMY_TEMPLATES } from '../constants';
import { getHeroArt } from '../heroes';
import { esMuro, caraFrontal, hayAntorcha, alphaNiebla, RevelarNiebla, TEMAS } from '../mapaLogica';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface MapViewProps {
  mapData: GameMap;
  player: Player;
  activeEnemies: ActiveEnemy[];
  onMove: (dx: number, dy: number) => void;
  theme: LevelTheme;
}

const spriteMonstruo = (id: string) => `/arte/monstruos/${id}.webp`;

const CACHE: Record<string, HTMLImageElement> = {};
const img = (url: string) => {
  if (!CACHE[url]) {
    const i = new Image();
        i.src = url;
    CACHE[url] = i;
  }
  return CACHE[url];
};
const listo = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;
const arte = (n: string) => img(`/arte/mapa/${n}.webp`);

// Nubes de niebla: manchas suaves repetibles sin costura (se dibujan también desplazadas una vuelta).
function crearNubes(color: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 40 + Math.random() * 120;
    for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      gr.addColorStop(0, `rgba(${color},0.045)`);
      gr.addColorStop(1, `rgba(${color},0)`);
      g.fillStyle = gr;
      g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  }
  return c;
}

const lienzo = () => document.createElement('canvas');

// Botón de la cruceta: solo onClick (con touchstart además, en tabletas un toque movía dos casillas).
const Flecha = ({ d, onMove, children, className }: { d: [number, number]; onMove: (dx: number, dy: number) => void; children: React.ReactNode; className: string }) => (
  <button
    className={`medallon absolute !w-14 !h-14 ${className}`}
    aria-label={d[1] < 0 ? 'Arriba' : d[1] > 0 ? 'Abajo' : d[0] < 0 ? 'Izquierda' : 'Derecha'}
    onClick={() => onMove(d[0], d[1])}
  >{children}</button>
);

const CanvasMapView: React.FC<MapViewProps> = ({ mapData, player, activeEnemies, onMove, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const props = useRef({ mapData, player, activeEnemies, theme });
  props.current = { mapData, player, activeEnemies, theme };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const d = ({ ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] } as Record<string, number[]>)[e.key];
      if (d) { e.preventDefault(); onMove(d[0], d[1]); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onMove]);

  // Un solo bucle de dibujo durante toda la vida del mapa; lee el estado del juego de props.current.
  useEffect(() => {
    const canvas = canvasRef.current!, container = containerRef.current!;
    const ctx = canvas.getContext('2d')!;
    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const niebla = new RevelarNiebla();
    const capaLuz = lienzo(), capaNiebla = lienzo(), mascara = lienzo(), mascaraGrande = lienzo();
    mascara.width = MAP_WIDTH; mascara.height = MAP_HEIGHT;
    mascaraGrande.width = MAP_WIDTH * 8; mascaraGrande.height = MAP_HEIGHT * 8;
    const mctx = mascara.getContext('2d')!, mgctx = mascaraGrande.getContext('2d')!;
    const lctx = capaLuz.getContext('2d')!, nctx = capaNiebla.getContext('2d')!;
    const datosMascara = mctx.createImageData(MAP_WIDTH, MAP_HEIGHT);
    const nubes: Record<string, HTMLCanvasElement> = {};

    const heroe = { x: props.current.player.x, y: props.current.player.y, mira: 1, paso: 0 };
    const enemigos = new Map<string, { x: number; y: number }>();
    const cam = { x: 0, y: 0, listo: false };
    const motas = Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random(), v: 0.4 + Math.random() * 0.6, f: Math.random() * 6.28 }));
    let ultimo = performance.now(), raf = 0;

    const frame = (ahora: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (ahora - ultimo) / 1000);
      ultimo = ahora;
      const { mapData: mapa, player: jugador, activeEnemies: activos, theme: tm } = props.current;
      if (!mapa.tiles.length) return;
      const tema = TEMAS[tm];
      const tiles = mapa.tiles;
      const s = ahora / 1000;

      // Tamaño (nítido en pantallas retina)
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = container.clientWidth, ch = container.clientHeight;
      if (!cw || !ch) return;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
        capaLuz.width = capaNiebla.width = cw; capaLuz.height = capaNiebla.height = ch;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;

      // Movimiento suave del héroe y de los monstruos
      const k = reducido ? 1 : 1 - Math.exp(-dt * 16);
      const dx = jugador.x - heroe.x, dy = jugador.y - heroe.y;
      if (Math.abs(dx) + Math.abs(dy) > 2.5) { heroe.x = jugador.x; heroe.y = jugador.y; }
      else { heroe.x += dx * k; heroe.y += dy * k; }
      if (Math.abs(dx) > 0.05) heroe.mira = Math.sign(dx);
      const andando = Math.abs(dx) + Math.abs(dy) > 0.03;
      if (andando) heroe.paso += dt * 14;
      for (const e of activos) {
        const p = enemigos.get(e.id);
        if (!p || Math.abs(e.x - p.x) + Math.abs(e.y - p.y) > 2.5) enemigos.set(e.id, { x: e.x, y: e.y });
        else { p.x += (e.x - p.x) * k * 0.7; p.y += (e.y - p.y) * k * 0.7; }
      }

      // Cámara centrada en el héroe, sin salirse del mapa
      const mw = MAP_WIDTH * T, mh = MAP_HEIGHT * T;
      let tx = cw / 2 - (heroe.x + 0.5) * T, ty = ch / 2 - (heroe.y + 0.5) * T;
      tx = mw < cw ? (cw - mw) / 2 : Math.min(0, Math.max(cw - mw, tx));
      ty = mh < ch ? (ch - mh) / 2 : Math.min(0, Math.max(ch - mh, ty));
      const kc = reducido || !cam.listo ? 1 : 1 - Math.exp(-dt * 9);
      cam.x += (tx - cam.x) * kc; cam.y += (ty - cam.y) * kc; cam.listo = true;
      const ox = Math.round(cam.x), oy = Math.round(cam.y);

      ctx.fillStyle = `rgb(${tema.niebla})`;
      ctx.fillRect(0, 0, cw, ch);
      ctx.save();
      ctx.translate(ox, oy);

      const x0 = Math.max(0, Math.floor(-ox / T) - 1), x1 = Math.min(MAP_WIDTH, Math.ceil((cw - ox) / T) + 1);
      const y0 = Math.max(0, Math.floor(-oy / T) - 1), y1 = Math.min(MAP_HEIGHT, Math.ceil((ch - oy) / T) + 1);

      // 1. Suelo: una textura pintada continua (8×8 casillas)
      const suelo = arte(tema.suelo);
      if (listo(suelo)) {
        const pat = ctx.createPattern(suelo, 'repeat')!;
        pat.setTransform(new DOMMatrix().scaleSelf((T * 8) / suelo.width));
        ctx.fillStyle = pat;
      } else ctx.fillStyle = tema.techo;
      ctx.fillRect(x0 * T, y0 * T, (x1 - x0) * T, (y1 - y0) * T);

      const pared = arte(tema.pared);
      const patPared = listo(pared) ? ctx.createPattern(pared, 'repeat')! : null;
      patPared?.setTransform(new DOMMatrix().scaleSelf((T * 3) / pared.width));
      const luces: { x: number; y: number; r: number; c: string; a: number }[] = [];
      const parpadeo = (n: number) => (reducido ? 1 : 0.9 + Math.sin(s * 9 + n) * 0.05 + Math.sin(s * 23 + n * 3) * 0.05);

      // 2. Casillas: muros con relieve y cosas del suelo
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const t = tiles[y][x], px = x * T, py = y * T;
          if (esMuro(t)) {
            const frente = caraFrontal(tiles, x, y);
            const alto = frente ? Math.round(T * 0.42) : T;
            ctx.fillStyle = tema.techo;
            ctx.fillRect(px, py, T, alto);
            if (patPared) { ctx.globalAlpha = 0.16; ctx.fillStyle = patPared; ctx.fillRect(px, py, T, alto); ctx.globalAlpha = 1; }
            if (y > 0 && !esMuro(tiles[y - 1][x])) { ctx.fillStyle = 'rgba(255,236,200,0.16)'; ctx.fillRect(px, py, T, 2); }
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            if (x > 0 && !esMuro(tiles[y][x - 1])) ctx.fillRect(px, py, 2, alto);
            if (x < MAP_WIDTH - 1 && !esMuro(tiles[y][x + 1])) ctx.fillRect(px + T - 2, py, 2, alto);
            if (frente) {
              ctx.fillStyle = patPared ?? '#3a2a20';
              ctx.fillRect(px, py + alto, T, T - alto);
              const g = ctx.createLinearGradient(0, py + alto, 0, py + T);
              g.addColorStop(0, 'rgba(255,230,190,0.18)'); g.addColorStop(0.12, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
              ctx.fillStyle = g; ctx.fillRect(px, py + alto, T, T - alto);
              if (hayAntorcha(tiles, x, y)) {
                const a = arte('antorcha');
                if (listo(a)) ctx.drawImage(a, px + T * 0.2, py + alto - T * 0.32, T * 0.6, T * 0.6 * (a.height / a.width));
                if (mapa.visited[y][x]) luces.push({ x: px + T / 2, y: py + alto - 4, r: T * 2.2 * parpadeo(x * 7 + y), c: tema.luz, a: 0.32 });
              }
            }
            // Pista de pared secreta para ojos atentos
            if (t === TileType.SECRET_WALL && Math.abs(x - jugador.x) <= 2 && Math.abs(y - jugador.y) <= 2) {
              ctx.fillStyle = `rgba(217,200,255,${0.25 + Math.sin(s * 3) * 0.15})`;
              ctx.font = `${T * 0.4}px Aclonica, serif`; ctx.textAlign = 'center';
              ctx.fillText('?', px + T / 2, py + alto * 0.8);
            }
            continue;
          }
          // Sombra que proyecta el muro de arriba
          if (y > 0 && esMuro(tiles[y - 1][x])) {
            const g = ctx.createLinearGradient(0, py, 0, py + T * 0.4);
            g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.fillRect(px, py, T, T * 0.4);
          }
          if (t === TileType.ICE) {
            ctx.fillStyle = 'rgba(190,230,255,0.55)'; ctx.fillRect(px, py, T, T);
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(px + 6, py + T - 10); ctx.lineTo(px + T * 0.5, py + T * 0.4); ctx.stroke();
            const brillo = ((s * 0.35 + (x + y) * 0.13) % 1.6) - 0.3;
            if (!reducido && brillo > 0 && brillo < 1) {
              const g = ctx.createLinearGradient(px + T * brillo - 10, py, px + T * brillo + 10, py + T);
              g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
              ctx.fillStyle = g; ctx.fillRect(px, py, T, T);
            }
          } else if (t === TileType.BUTTON || t === TileType.BUTTON_PRESSED) {
            const p = arte('placa');
            if (listo(p)) ctx.drawImage(p, px + 3, py + 3, T - 6, T - 6);
            if (t === TileType.BUTTON) luces.push({ x: px + T / 2, y: py + T / 2, r: T * 0.9, c: '255,190,90', a: 0.25 + Math.sin(s * 3) * 0.08 });
          } else if (t === TileType.SPIKE_UP || t === TileType.SPIKE_DOWN) {
            const p = arte('pinchos');
            if (listo(p)) {
              // Bajados: más pequeños y apagados (sin ctx.filter, que es muy lento por casilla)
              if (t === TileType.SPIKE_DOWN) { ctx.globalAlpha = 0.4; ctx.drawImage(p, px + 8, py + 10, T - 16, T - 16); }
              else ctx.drawImage(p, px + 2, py + 2, T - 4, T - 4);
              ctx.globalAlpha = 1;
            }
          } else if (t === TileType.TELEPORT_PAD) {
            const p = arte('teletransporte');
            if (listo(p)) {
              ctx.save(); ctx.translate(px + T / 2, py + T / 2); ctx.rotate(reducido ? 0 : s * 0.6);
              ctx.drawImage(p, -T * 0.48, -T * 0.48, T * 0.96, T * 0.96); ctx.restore();
            }
            luces.push({ x: px + T / 2, y: py + T / 2, r: T * 1.4, c: '90,230,255', a: 0.3 + Math.sin(s * 2.5) * 0.08 });
          }
        }
      }

      // 3. Objetos de pie (de arriba abajo, para que se solapen bien)
      const sombra = (cx: number, cy: number, rx: number) => {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      };
      const dePie = (n: string, px: number, py: number, ancho: number, subir = 0) => {
        const p = arte(n);
        if (!listo(p)) return;
        const alto = ancho * (p.height / p.width);
        ctx.drawImage(p, px + (T - ancho) / 2, py + T - alto - subir, ancho, alto);
      };
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const t = tiles[y][x], px = x * T, py = y * T;
          if (t === TileType.CHEST) {
            sombra(px + T / 2, py + T - 6, T * 0.38);
            dePie('cofre', px, py, T * 0.9, 4 + (reducido ? 0 : Math.max(0, Math.sin(s * 2 + x)) * 2));
            if (!reducido && Math.sin(s * 1.7 + x * 3) > 0.92) luces.push({ x: px + T * 0.7, y: py + T * 0.35, r: T * 0.5, c: '255,240,190', a: 0.7 });
          } else if (t === TileType.KEY_ITEM_TILE) {
            const flota = reducido ? 0 : Math.sin(s * 3) * 4;
            sombra(px + T / 2, py + T - 8, T * 0.22);
            dePie('llave', px, py, T * 0.75, 10 + flota);
            luces.push({ x: px + T / 2, y: py + T / 2, r: T * 1.1, c: '255,210,110', a: 0.35 });
          } else if (t === TileType.BOULDER || t === TileType.BUTTON_PRESSED) {
            sombra(px + T / 2, py + T - 5, T * 0.4);
            dePie('roca', px, py, T * (t === TileType.BUTTON_PRESSED ? 0.8 : 0.95), 3);
          } else if (t === TileType.DOOR_CLOSED) {
            dePie('rastrillo', px, py, T * 1.05);
          } else if (t === TileType.LOCKED_DOOR) {
            dePie('puerta', px, py, T * 0.95);
          } else if (t === TileType.PORTAL) {
            luces.push({ x: px + T / 2, y: py + T / 2, r: T * 2.6 * parpadeo(5), c: '190,120,255', a: 0.45 });
            sombra(px + T / 2, py + T - 4, T * 0.6);
            dePie('portal', px, py, T * 1.5);
          } else if (t === TileType.BOSS) {
            luces.push({ x: px + T / 2, y: py + T / 2, r: T * 2, c: '255,70,90', a: 0.3 + Math.sin(s * 2) * 0.1 });
            const j = img(spriteMonstruo('boss'));
            sombra(px + T / 2, py + T - 4, T * 0.55);
            if (listo(j)) { const l = T * 2.2, flota = reducido ? 0 : Math.sin(s * 1.5) * 3; ctx.drawImage(j, px + T / 2 - l / 2, py + T - l - 2 + flota, l, l); }
          }
        }
      }

      // 4. Monstruos y héroe, ordenados por fila
      const figuras: { y: number; dibujar: () => void }[] = [];
      for (const e of activos) {
        if (!mapa.visited[e.y]?.[e.x]) continue;
        const p = enemigos.get(e.id)!;
        figuras.push({ y: p.y, dibujar: () => {
          const px = p.x * T, py = p.y * T, bote = reducido ? 0 : Math.sin(s * 4 + e.x) * 3;
          sombra(px + T / 2, py + T - 4, T * 0.32);
          const i = img(spriteMonstruo(ENEMY_TEMPLATES[e.templateIndex]?.spriteId || 'ghost'));
          // Miran hacia el héroe
          if (listo(i)) {
            const l = T * 1.6;
            ctx.save(); ctx.translate(px + T / 2, py + T - 2 + bote);
            ctx.scale(heroe.x < p.x ? -1 : 1, 1);
            ctx.drawImage(i, -l / 2, -l, l, l); ctx.restore();
          }
        } });
      }
      figuras.push({ y: heroe.y + 0.01, dibujar: () => {
        const px = heroe.x * T, py = heroe.y * T;
        const h = img(getHeroArt(jugador.hero, jugador.level));
        const bote = andando && !reducido ? Math.abs(Math.sin(heroe.paso)) * 4 : (reducido ? 0 : Math.sin(s * 2.4) * 1);
        sombra(px + T / 2, py + T - 4, T * 0.34);
        if (!listo(h)) return;
        const lado = T * 2.1;
        ctx.save();
        ctx.translate(px + T / 2, py + T - 2 - bote);
        ctx.scale(heroe.mira, andando ? 1 - Math.abs(Math.sin(heroe.paso)) * 0.03 : 1);
        ctx.drawImage(h, -lado / 2, -lado, lado, lado);
        ctx.restore();
      } });
      figuras.sort((a, b) => a.y - b.y).forEach(f => f.dibujar());
      ctx.restore();

      // 5. Luz: lo explorado queda apagado y sin color; el farol del héroe y las antorchas lo iluminan
      const hx = ox + (heroe.x + 0.5) * T, hy = oy + (heroe.y + 0.5) * T;
      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, cw, ch);
      lctx.fillStyle = 'rgba(8,6,20,0.62)';
      lctx.fillRect(0, 0, cw, ch);
      lctx.globalCompositeOperation = 'destination-out';
      const agujero = (x: number, y: number, r0: number, r1: number, a: number) => {
        const g = lctx.createRadialGradient(x, y, r0, x, y, r1);
        g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = g; lctx.fillRect(x - r1, y - r1, r1 * 2, r1 * 2);
      };
      agujero(hx, hy, T * 1.4, T * 4.6 * parpadeo(1), 1);
      for (const l of luces) agujero(ox + l.x, oy + l.y, 0, l.r, Math.min(1, l.a * 2.2));
      ctx.globalCompositeOperation = 'saturation';
      ctx.drawImage(capaLuz, 0, 0, cw, ch);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(capaLuz, 0, 0, cw, ch);
      ctx.globalCompositeOperation = 'lighter';
      const brillo = (x: number, y: number, r: number, c: string, a: number) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      };
      brillo(hx, hy - T * 0.3, T * 3.8 * parpadeo(2), tema.luz, tema.brillo);
      for (const l of luces) brillo(ox + l.x, oy + l.y, l.r, l.c, l.a * tema.brillo / 0.16);
      ctx.globalCompositeOperation = 'source-over';

      // 6. Niebla de lo no descubierto: máscara suave + nubes que se mueven despacio
      niebla.actualizar(mapa.visited, ahora);
      for (let y = 0; y < MAP_HEIGHT; y++) for (let x = 0; x < MAP_WIDTH; x++) {
        datosMascara.data[(y * MAP_WIDTH + x) * 4 + 3] = Math.round(alphaNiebla(mapa.visited, niebla, x, y, ahora) * 255);
      }
      mctx.putImageData(datosMascara, 0, 0);
      mgctx.clearRect(0, 0, mascaraGrande.width, mascaraGrande.height);
      mgctx.imageSmoothingEnabled = true;
      mgctx.filter = 'blur(5px)';
      mgctx.drawImage(mascara, 0, 0, mascaraGrande.width, mascaraGrande.height);
      mgctx.filter = 'none';

      nctx.globalCompositeOperation = 'source-over';
      nctx.fillStyle = `rgb(${tema.niebla})`;
      nctx.fillRect(0, 0, cw, ch);
      const nube = (nubes[tema.nube] ??= crearNubes(tema.nube));
      for (const [vel, esc, alfa] of [[9, 1, 1], [-14, 1.6, 0.8]] as const) {
        const pat = nctx.createPattern(nube, 'repeat')!;
        const desp = reducido ? 0 : s * vel;
        pat.setTransform(new DOMMatrix().translateSelf(ox * 0.6 + desp, oy * 0.6 + desp * 0.4).scaleSelf(esc));
        nctx.globalAlpha = alfa;
        nctx.fillStyle = pat;
        nctx.fillRect(0, 0, cw, ch);
      }
      nctx.globalAlpha = 1;
      nctx.globalCompositeOperation = 'destination-in';
      nctx.imageSmoothingEnabled = true;
      nctx.drawImage(mascaraGrande, ox, oy, mw, mh);
      ctx.drawImage(capaNiebla, 0, 0, cw, ch);

      // 7. Ambiente: polvo dorado, nieve o ascuas
      if (!reducido) {
        for (const m of motas) {
          const tipo = tema.particula;
          if (tipo === 'nieve') { m.y += dt * 0.05 * m.v; m.x += dt * 0.012 * Math.sin(s + m.f); }
          else if (tipo === 'luciernaga') { m.x += dt * 0.02 * Math.sin(s * 0.5 + m.f * 3); m.y += dt * 0.015 * Math.cos(s * 0.4 + m.f * 2); }
          else { m.y -= dt * (tipo === 'ascua' ? 0.04 : 0.012) * m.v; m.x += dt * 0.01 * Math.sin(s * 0.7 + m.f); }
          m.y = (m.y + 1) % 1; m.x = (m.x + 1) % 1;
          const px = m.x * cw, py = m.y * ch;
          if (tipo === 'luciernaga') {
            // Luciérnagas: se encienden y se apagan, con halo
            const a = Math.max(0, Math.sin(s * 1.6 + m.f * 5)) * 0.9;
            if (a > 0.02) {
              const g = ctx.createRadialGradient(px, py, 0, px, py, 9);
              g.addColorStop(0, `rgba(230,255,150,${a})`); g.addColorStop(1, 'rgba(230,255,150,0)');
              ctx.fillStyle = g; ctx.fillRect(px - 9, py - 9, 18, 18);
            }
            continue;
          }
          const r = tipo === 'nieve' ? 1.6 + m.v * 1.4 : 1 + m.v;
          const c = tipo === 'nieve' ? '240,246,255' : tipo === 'ascua' ? '255,150,70' : '255,214,140';
          ctx.fillStyle = `rgba(${c},${(tipo === 'nieve' ? 0.75 : 0.5) * (0.6 + 0.4 * Math.sin(s * 2 + m.f))})`;
          ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        }
      }

      // 8. Viñeta
      const v = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(5,3,12,0.55)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, cw, ch);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="w-full h-full flex-1 flex justify-center items-stretch pt-2 pb-0">
      <div ref={containerRef} className="panel !p-0 relative overflow-hidden w-full flex-1 min-h-[60vh] md:min-h-0" style={{ background: '#0b0916' }}>
        <canvas ref={canvasRef} className="block w-full h-full" aria-label="Mapa del nivel" role="img" />
      </div>

      {/* Cruceta táctil: solo en pantallas táctiles */}
      <div style={{ color: 'var(--dorado-claro)', bottom: 'calc(20px + env(safe-area-inset-bottom))' }} className="dpad fixed right-4 w-[176px] h-[176px] z-[45] select-none">
        <div className="absolute inset-[30px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(34,27,56,.85), rgba(11,9,22,.6))', boxShadow: '0 0 0 2px var(--marco), 0 10px 26px rgba(0,0,0,.6)' }} />
        <Flecha d={[0, -1]} onMove={onMove} className="top-0 left-1/2 -translate-x-1/2"><ChevronUp size={30} /></Flecha>
        <Flecha d={[0, 1]} onMove={onMove} className="bottom-0 left-1/2 -translate-x-1/2"><ChevronDown size={30} /></Flecha>
        <Flecha d={[-1, 0]} onMove={onMove} className="left-0 top-1/2 -translate-y-1/2"><ChevronLeft size={30} /></Flecha>
        <Flecha d={[1, 0]} onMove={onMove} className="right-0 top-1/2 -translate-y-1/2"><ChevronRight size={30} /></Flecha>
      </div>
    </div>
  );
};

export default CanvasMapView;
