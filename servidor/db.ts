import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

export function abrirDb(ruta: string): Db {
  const db = new DatabaseSync(ruta);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS docentes (
      id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, usuario TEXT NOT NULL UNIQUE, clave TEXT NOT NULL,
      creado TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS clases (
      id INTEGER PRIMARY KEY, docente_id INTEGER NOT NULL REFERENCES docentes(id), nombre TEXT NOT NULL,
      curso INTEGER NOT NULL CHECK (curso BETWEEN 3 AND 6), codigo TEXT NOT NULL UNIQUE,
      creada TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS alumnos (
      id INTEGER PRIMARY KEY, clase_id INTEGER NOT NULL REFERENCES clases(id) ON DELETE CASCADE, nombre TEXT NOT NULL,
      usuario TEXT NOT NULL UNIQUE, clave TEXT NOT NULL, curso_propio INTEGER CHECK (curso_propio BETWEEN 3 AND 6),
      heroe TEXT, creado TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS sesiones (
      token TEXT PRIMARY KEY, rol TEXT NOT NULL CHECK (rol IN ('docente', 'alumno')), usuario_id INTEGER NOT NULL,
      creada TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS partidas (
      id INTEGER PRIMARY KEY, alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
      inicio TEXT NOT NULL DEFAULT (datetime('now')), fin TEXT, puntos INTEGER, nivel_heroe INTEGER, mapa INTEGER);
    CREATE TABLE IF NOT EXISTS respuestas (
      id INTEGER PRIMARY KEY, alumno_id INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
      partida_id INTEGER NOT NULL REFERENCES partidas(id) ON DELETE CASCADE, pregunta_id TEXT NOT NULL,
      curso INTEGER NOT NULL, materia TEXT NOT NULL, dificultad TEXT NOT NULL, texto TEXT NOT NULL,
      correcta INTEGER NOT NULL, ms INTEGER, fecha TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')));
    CREATE INDEX IF NOT EXISTS respuestas_alumno ON respuestas(alumno_id, pregunta_id);
  `);
  // Cuentas comunes del Gremio: el id de la cuenta en el portal (servidor/gremio.ts).
  for (const tabla of ['docentes', 'clases', 'alumnos']) {
    if (!(db.prepare(`PRAGMA table_info(${tabla})`).all() as any[]).some(c => c.name === 'cuenta_id')) db.exec(`ALTER TABLE ${tabla} ADD COLUMN cuenta_id INTEGER`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ${tabla}_cuenta ON ${tabla}(cuenta_id)`);
  }
  return db;
}
