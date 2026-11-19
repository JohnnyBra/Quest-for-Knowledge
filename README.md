# Quest for Knowledge

RPG de repaso para Primaria (3º a 6º) del Colegio La Hispanidad. Creado por Javi Barrero.

## Clases y cuentas

- El docente se da de alta con el **código de invitación** (`QUEST_INVITACION` en `.env`) y crea clases (curso 3º–6º).
  Cada clase tiene un código de 6 letras.
- El alumnado se registra una vez con ese código (nombre, usuario y contraseña) y después entra con su cuenta.
- Las preguntas salen de la batería del curso de cada alumno (`data/preguntas/`); las falladas vuelven a salir como
  repaso. Cada respuesta se guarda en `quest.db` (SQLite) para el panel del profe.

## Panel del maestro

Para cada clase: respuestas, % de aciertos, índice de aprendizaje (preguntas que se fallaron al principio y luego se
acertaron), aciertos por materia, tabla del alumnado ordenable y las preguntas que más se fallan. En la ficha de cada
alumno: sus cifras, lo que aún tiene por aprender y lo que ha aprendido, y los ajustes (bajar el curso de sus
preguntas, poner contraseña nueva, quitarlo de la clase).

## En local

```bash
npm install
echo "QUEST_INVITACION=lo-que-quieras" > .env
npm run dev        # http://localhost:3030
npm test           # pruebas
npm run lint       # tipos
```

## En el VPS

`bash scripts/quest-vps.sh actualizar` (copia de `db.json` y de `quest.db`, `git pull`, `npm ci`, compilar, reiniciar
pm2) o `bash scripts/quest-vps.sh diagnostico`. pm2 debe arrancar Quest con `npm start` (`tsx server.ts`) y
`NODE_ENV=production`.
