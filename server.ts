import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { abrirDb } from './servidor/db.ts';
import { crearApp } from './servidor/app.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* sin .env: valores por defecto */ }

const PORT = Number(process.env.PORT ?? 3030);
// Con GREMIO_URL, las cuentas son las comunes del Gremio (el portal); sin ella, las de Quest.
const gremio = process.env.GREMIO_URL ? { url: process.env.GREMIO_URL, publico: process.env.GREMIO_PUBLICO ?? process.env.GREMIO_URL } : undefined;
const app = crearApp(abrirDb(process.env.QUEST_DB ?? path.join(__dirname, 'quest.db')), { invitacion: process.env.QUEST_INVITACION, gremio });

if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
}

app.listen(PORT, '0.0.0.0', () => console.log(`Quest en http://0.0.0.0:${PORT}`));
