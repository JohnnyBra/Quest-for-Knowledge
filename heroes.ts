// Los héroes elegibles: 4 skins × chico/chica, cada uno con 3 formas (niveles 1-3, 4-6, 7+).

export type SkinId = 'paladin' | 'mago' | 'explorador' | 'dragon';
export type Genero = 'chico' | 'chica';
export interface HeroChoice { skin: SkinId; genero: Genero }

export interface Skin {
  id: SkinId;
  nombre: Record<Genero, string>;
  lema: string;
  formas: Record<Genero, [string, string, string]>;
}

export const SKINS: Skin[] = [
  { id: 'paladin', nombre: { chico: 'Paladín del Saber', chica: 'Paladina del Saber' }, lema: 'Escudo firme, respuesta certera.', formas: { chico: ['Escudero', 'Caballero', 'Paladín'], chica: ['Escudera', 'Dama caballero', 'Paladina'] } },
  { id: 'mago', nombre: { chico: 'Hechicero de las Runas', chica: 'Hechicera de las Runas' }, lema: 'Cada palabra es un hechizo.', formas: { chico: ['Aprendiz', 'Mago', 'Archimago'], chica: ['Aprendiza', 'Maga', 'Archimaga'] } },
  { id: 'explorador', nombre: { chico: 'Explorador del Bosque', chica: 'Exploradora del Bosque' }, lema: 'Ninguna pregunta se le escapa.', formas: { chico: ['Montaraz', 'Cazador', 'Señor de las Bestias'], chica: ['Montaraz', 'Cazadora', 'Señora de las Bestias'] } },
  { id: 'dragon', nombre: { chico: 'Jinete de Dragón', chica: 'Jinete de Dragón' }, lema: 'Crece con su dragón.', formas: { chico: ['Cuidador', 'Guerrero', 'Jinete'], chica: ['Cuidadora', 'Guerrera', 'Jinete'] } },
];

export const HEROE_POR_DEFECTO: HeroChoice = { skin: 'paladin', genero: 'chico' };

export const formaDe = (level: number): 1 | 2 | 3 => (level >= 7 ? 3 : level >= 4 ? 2 : 1);

export const getHeroArt = (hero: HeroChoice, level: number): string =>
  `/arte/heroes/${hero.skin}-${hero.genero}-${formaDe(level)}.webp`;

export const esHeroeValido = (h: unknown): h is HeroChoice =>
  !!h && SKINS.some(s => s.id === (h as HeroChoice).skin) && ((h as HeroChoice).genero === 'chico' || (h as HeroChoice).genero === 'chica');
