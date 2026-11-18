#!/usr/bin/env bash
# Quest en el VPS: actualizar a la última versión de GitHub sin perder el ranking.
#
# Uso (en el VPS):  bash ~/quest/scripts/quest-vps.sh actualizar
#                   bash ~/quest/scripts/quest-vps.sh diagnostico
#
# «actualizar» hace copia del ranking (db.json) en copias/, trae el código nuevo (git pull),
# instala dependencias, compila (npm run build) y reinicia el proceso de pm2.
# El proceso de pm2 se busca solo (el que corre en esta carpeta); si no se encuentra,
# se puede indicar a mano:  QUEST_PM2=nombre bash scripts/quest-vps.sh actualizar
set -euo pipefail

APP_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PUERTO=3030
cd "$APP_DIR"

proceso_pm2() {
  if [[ -n "${QUEST_PM2:-}" ]]; then echo "$QUEST_PM2"; return; fi
  pm2 jlist 2>/dev/null | APP_DIR="$APP_DIR" node -e '
    let t = ""; process.stdin.on("data", d => t += d).on("end", () => {
      try {
        const p = JSON.parse(t).find(a => a.pm2_env && a.pm2_env.pm_cwd === process.env.APP_DIR);
        if (p) console.log(p.name);
      } catch {}
    });' || true
}

devolver_ranking() {
  if [[ -n "${RANKING:-}" && -s "$RANKING" ]]; then cp "$RANKING" db.json; fi
  rm -f "${RANKING:-}"; RANKING=""
}

actualizar() {
  echo "== Actualizando Quest en $APP_DIR"
  mkdir -p copias
  local copia="copias/db-$(date +%F-%H%M).json"
  if [[ -f db.json ]]; then
    cp db.json "$copia"
    echo "  ✔ Copia del ranking: $copia"
  fi
  if [[ -f quest.db ]]; then
    local copia_db="copias/quest-$(date +%F-%H%M).db"
    node -e "new (require('node:sqlite').DatabaseSync)('quest.db').exec(\"VACUUM INTO '$copia_db'\")"
    echo "  ✔ Copia de la base de datos: $copia_db"
  fi
  grep -q '^QUEST_INVITACION=' .env 2>/dev/null || echo "  ⚠ Falta QUEST_INVITACION en .env: nadie podrá darse de alta como docente"

  # El ranking vivo cambia con cada partida; se aparta para que no bloquee el «git pull»
  # y se devuelve después, pase lo que pase.
  # (variable global: la trampa EXIT se ejecuta cuando la función ya ha terminado)
  RANKING=$(mktemp)
  if [[ -f db.json ]]; then cp db.json "$RANKING"; fi
  trap devolver_ranking EXIT
  git checkout -- db.json 2>/dev/null || true

  git pull --ff-only
  devolver_ranking
  trap - EXIT
  echo "  ✔ Código actualizado: $(git log -1 --format='%h %s')"

  npm ci
  npm run build
  echo "  ✔ Compilado"

  local nombre
  nombre=$(proceso_pm2)
  if [[ -z "$nombre" ]]; then
    echo "  ✘ No encuentro el proceso de pm2 de Quest (mira «pm2 ls») y vuelve a ejecutar:"
    echo "    QUEST_PM2=<nombre> bash scripts/quest-vps.sh actualizar"
    exit 1
  fi
  pm2 restart "$nombre" --update-env
  sleep 3
  if curl -sf "http://localhost:$PUERTO/api/salud" > /dev/null; then
    echo "  ✔ Quest responde en el puerto $PUERTO (proceso pm2: $nombre)"
  else
    echo "  ✘ Quest no responde en el puerto $PUERTO; revisa «pm2 logs $nombre»"
    exit 1
  fi
}

diagnostico() {
  echo "== Diagnóstico de Quest en $APP_DIR"
  echo "Versión: $(git log -1 --format='%h %s (%cr)')"
  local nombre
  nombre=$(proceso_pm2)
  echo "Proceso pm2: ${nombre:-no encontrado}"
  if [[ -n "$nombre" ]]; then pm2 describe "$nombre" | grep -E "status|restarts|uptime|NODE_ENV" || true; fi
  if curl -sf "http://localhost:$PUERTO/api/salud" > /dev/null; then
    echo "Responde en el puerto $PUERTO: sí"
  else
    echo "Responde en el puerto $PUERTO: NO"
  fi
  if [[ -d dist ]]; then echo "Compilado (dist/): sí"; else echo "Compilado (dist/): no — ejecuta «actualizar»"; fi
}

case "${1:-actualizar}" in
  actualizar) actualizar ;;
  diagnostico) diagnostico ;;
  *) echo "Uso: bash scripts/quest-vps.sh [actualizar|diagnostico]"; exit 1 ;;
esac
