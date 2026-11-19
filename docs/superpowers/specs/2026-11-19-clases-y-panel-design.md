# Quest: clases con código, baterías por curso y panel del profe

Fecha: 2026-11-19. Acordado con Javi en el chat.

## Qué quiere Javi

- Crear una clase y que tenga un **código**, como en la Forja y la Mina. El alumnado **se registra** con ese código
  (usuario y contraseña) y después entra con su cuenta.
- Cada clase tiene un **curso, de 3º a 6º**, y las preguntas salen de la **batería de ese curso**. A un alumno o alumna
  concreto se le puede **bajar el curso**.
- Un **panel del profe** con aciertos y fallos en global y por materia, qué preguntas se fallan, y un **análisis del
  aprendizaje** (cuántas preguntas se fallaron al principio y después salieron bien). Todo **por clase y por alumno**.
- **Sin el núcleo común** (`plataforma-cole-juegos`): todo vive en `~/quest`.

Lo que no cambia: el juego (mapa, combates, héroes, puntos) y el aspecto Gremio de Quest (violeta y oro).

## Decisiones

- **Base de datos:** SQLite con `node:sqlite` (viene con Node; el VPS tiene Node 22.23). Sin dependencias nuevas.
  Archivo `quest.db` (ignorado por git), ruta configurable con `QUEST_DB`.
- **Contraseñas:** `crypto.scrypt` con sal. **Sesión:** token aleatorio en cookie `httpOnly`, `SameSite=Lax`, guardado
  en la tabla `sesiones`.
- **Docente:** se registra con un código de invitación (`QUEST_INVITACION` en el `.env` del VPS). Sin esa variable no se
  pueden registrar docentes.
- **Preguntas:** una batería por curso, `data/preguntas/c3.ts`, `c4.ts`, `c5.ts` (la actual, movida) y `c6.ts`. Las
  mismas 5 materias y dos dificultades; **200 preguntas por curso** con el reparto de 5º (por materia 27 «explorador» +
  13 «jefe», salvo Matemáticas 30 + 10). Las de 3º, 4º y 6º las redacto yo a partir del currículo LOMLOE de Andalucía
  y Javi las revisa (o entrega luego un documento que las sustituye).
- **Identificador de pregunta:** `c<curso>-<materia>-<hash corto del texto>` (p. ej. `c6-mat-3f9a1c`), calculado al
  cargar la batería. Borrar o mover preguntas no cambia los demás identificadores; cambiar el texto crea una pregunta
  nueva (es otra pregunta). Una prueba comprueba que no hay identificadores repetidos.
- **Ranking:** por clase (mejor puntuación de cada alumno). El `db.json` antiguo se queda como archivo y deja de usarse.

## Datos (SQLite)

```
docentes   (id, nombre, usuario UNIQUE, clave, creado)
clases     (id, docente_id, nombre, curso 3..6, codigo UNIQUE de 6 letras, creada)
alumnos    (id, clase_id, nombre, usuario UNIQUE, clave, curso_propio NULL|3..6, heroe JSON, creado)
sesiones   (token PK, rol 'docente'|'alumno', usuario_id, creada)
partidas   (id, alumno_id, inicio, fin NULL, puntos NULL, nivel_heroe NULL, mapa NULL)
respuestas (id, alumno_id, partida_id, pregunta_id, curso, materia, dificultad, texto, correcta 0|1, ms, fecha)
```

- Usuarios únicos entre docentes y alumnos por separado; el login dice el rol (dos pestañas en la pantalla de entrada).
- **Curso efectivo** del alumno = `curso_propio ?? clase.curso`. El docente puede ponerle cualquier curso de 3º hasta el
  de su clase (bajar y volver a subir), nunca por encima.
- En `respuestas` se guardan `curso`, `materia`, `dificultad` y `texto` **sacados de la batería en el servidor** (el
  cliente solo manda `pregunta_id`, `correcta` y `ms`), para que el panel siga leyendo bien aunque la batería cambie.
  Un `pregunta_id` que no existe se rechaza (400).

## API

| Método y ruta | Quién | Qué |
|---|---|---|
| `POST /api/docente/registro` | — | `{invitacion, nombre, usuario, clave}` |
| `POST /api/alumno/registro` | — | `{codigo, nombre, usuario, clave}` → entra ya |
| `POST /api/entrar` | — | `{rol, usuario, clave}` |
| `POST /api/salir` | sesión | borra la sesión |
| `GET /api/yo` | sesión | alumno: nombre, clase, curso efectivo, héroe, **pendientes** (ids falladas aún no acertadas); docente: nombre |
| `PUT /api/yo/heroe` | alumno | guarda el héroe elegido |
| `POST /api/partidas` | alumno | empieza partida → `{id}` |
| `POST /api/partidas/:id/fin` | alumno | `{puntos, nivel_heroe, mapa}` (solo su partida, solo una vez) |
| `POST /api/respuestas` | alumno | `{partida_id, pregunta_id, correcta, ms}` |
| `GET /api/ranking` | alumno | ranking de su clase |
| `GET/POST /api/clases` | docente | sus clases / crear `{nombre, curso}` |
| `GET /api/clases/:id` | docente | resumen de la clase (ver Panel) |
| `GET /api/alumnos/:id` | docente | ficha del alumno |
| `PUT /api/alumnos/:id` | docente | `{curso_propio}` o `{clave}` nueva |
| `DELETE /api/alumnos/:id` | docente | quitar de la clase (borra sus datos) |

Un docente solo ve y toca sus clases y su alumnado (403 en otro caso). Errores en español, en `{error}`.

## Juego (cliente)

- **Entrada** (`LoginScreen`): pestañas «Entrar», «Registrarme con código de clase» y, discreto, «Soy docente». Mismo
  aspecto que ahora, con «Creado por Javi Barrero». Si `/api/yo` responde, se entra directamente.
- El héroe se guarda en la cuenta (`PUT /api/yo/heroe`), ya no en `localStorage`.
- Al empezar partida, `POST /api/partidas`. Al morir o ganar, `…/fin` (sustituye a `/api/score`).
- `services/geminiService.ts` pasa a `services/preguntas.ts`: elige de la batería del **curso efectivo** y, tras cada
  respuesta (también la del crítico y la del tiempo agotado), manda `POST /api/respuestas`. Si falla la red, la
  respuesta se guarda en una cola y se reintenta en el siguiente envío (no se pierde el combate por la red).
- **Repaso:** las preguntas falladas y aún no acertadas (las `pendientes`, también las de días anteriores) vuelven a
  salir: si la materia y dificultad elegidas tienen pendientes que no han salido en los **3 últimos combates**, una de
  cada **3** preguntas es una pendiente. Al acertarla deja de estar pendiente.
- Textos con el curso: «Repaso de 5º» y la narrativa («5ºB», «alumnos de 5º») usan el curso efectivo.
- Ranking: el de la clase.

## Panel del profe

Pantalla propia en el mismo SPA (entra quien inicia sesión como docente), con el aspecto Gremio de Quest.

- **Mis clases:** tarjetas con nombre, curso, código (grande, para proyectar), nº de alumnos; «Crear clase».
- **Clase:**
  - Cifras: respuestas, % de acierto, **índice de aprendizaje**, alumnos activos.
  - **Por materia:** barra de % de acierto y su índice de aprendizaje.
  - **Alumnado:** tabla con nombre, curso (marcado si está bajado), respuestas, % acierto, ya sabidas, aprendidas,
    pendientes, índice; ordenable; clic → ficha.
  - **Preguntas más falladas:** las 10 con más % de fallo (mínimo 3 respuestas), con materia, curso y nº de alumnos que
    la fallaron.
- **Ficha del alumno:** lo mismo por materia, lista de pendientes y de aprendidas (texto de la pregunta), cambiar curso,
  nueva contraseña, quitar de la clase.

### Cómo se calcula (función pura `analizar(respuestas)`, con pruebas)

- **% acierto** = aciertos ÷ respuestas.
- Por cada par alumno–pregunta, mirando las respuestas en orden de fecha:
  - **Ya la sabía:** la primera respuesta es acierto.
  - **Aprendida:** la primera es fallo y alguna posterior es acierto.
  - **Pendiente:** todas son fallo.
- **Índice de aprendizaje** = aprendidas ÷ (aprendidas + pendientes); «—» si no hay fallos.
- En la clase, «Preguntas más falladas» cuenta respuestas; las cifras de aprendizaje cuentan pares alumno–pregunta.

## Fases

1. **Cuentas y respuestas** (hecha 2026-11-19): base de datos, API de cuentas, clases, partidas y respuestas; entrada con registro; héroe
   en la cuenta; ranking por clase; batería de 5º con identificadores y selector por curso con repaso.
2. **Panel del profe** (hecha 2026-11-19): `analizar`, rutas de resumen y ficha, pantallas del panel.
3. **Baterías de 3º, 4º y 6º:** 600 preguntas en `c3.ts`, `c4.ts`, `c6.ts`, revisables por Javi (también en un
   `preguntas-cN.md` legible, como `preguntasquest.md`).

Cada fase en la rama `clases-panel`, con TDD, recorrido en navegador real y revisión independiente al final.

## Pruebas

- Servidor contra una base en memoria (`:memory:`), con `fetch` a un puerto libre: registro, entrar, permisos (un
  docente no ve otra clase, un alumno no cierra la partida de otro), curso efectivo y su límite, respuesta con id falso.
- `analizar`: sabida, aprendida, pendiente, índice sin fallos.
- Baterías: 200 por curso, reparto por materia y dificultad, 4 opciones, `correctIndex` válido, ids únicos.
- Selector: usa el curso efectivo; mete pendientes según la regla del repaso.

## Despliegue

- `.env` del VPS: `QUEST_INVITACION`. `quest.db` y sus copias, fuera de git.
- `scripts/quest-vps.sh`: antes de actualizar, copia en caliente de `quest.db` (`VACUUM INTO`, nunca `cp` con WAL).
- El servidor importa las baterías (TypeScript con `enum`): comprobar en el VPS que pm2 lo arranca con `tsx` y no con
  `node server.ts` (el modo de Node de quitar tipos no admite `enum`).

## Fuera (por ahora)

Mover alumnos entre clases, varios docentes en una clase, filtros por fechas, exportar CSV, criterios de evaluación,
entrar sin cuenta.
