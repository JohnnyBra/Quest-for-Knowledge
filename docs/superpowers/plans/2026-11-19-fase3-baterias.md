# Fase 3: baterías de 3º, 4º y 6º (listados de Javi)

**Spec:** `docs/superpowers/specs/2026-11-19-clases-y-panel-design.md` (fase 3). Javi entregó tres archivos
«Batería Maestra de 300 Preguntas» (3º, 4º, 6º): por curso, Lengua, Matemáticas y Conocimiento del Medio, cada una con
75 de explorador y 25 de jefe. **No traen Inglés ni Educación Física.** El contenido es de Javi: no se reescribe, solo se
adapta al juego.

## Qué hay que adaptar al convertir

1. **La correcta es casi siempre la B** (883 de 900): el juego baraja las opciones cada vez que sale una pregunta
   (también las de 5º), así en el repaso no vale acordarse de la posición.
2. **Notas en la correcta**: «(Correcta)», «(Correcta - …)» y el paréntesis final que solo lleva la correcta («4 sílabas
   (ma-ri-po-sa)») son notas de Javi para marcarla (lo aclaró él): se quitan, no llegan al alumnado.
3. **Fórmulas LaTeX** (`$7 \times 4$`, `^\circ`, `\frac{a}{b}`…) → texto (`7 × 4`, `°`, `a/b`). Negritas `**` fuera.
4. **Pregunta 91 de Lengua de 4º** sin «(Correcta)» en el formato habitual: la marca va como «(Correcta - …)».

## Materias sin preguntas

Un curso sin preguntas de una materia no la ofrece: ni botón en el combate ni monstruos débiles a ella.
(`materiasDe(curso)` en `data/preguntas/index.ts`.) 5º sigue con sus cinco materias.

## Tareas

1. Pruebas de las baterías (300, 75+25 por materia, sin `$`, `\`, `(Correcta`, `**`; correctas repartidas) → rojo.
2. `scripts/importar-preguntas.ts <md> <curso>` genera `data/preguntas/cN.ts` → verde. Quitar el respaldo de 5º en
   `bateria()`; ajustar las pruebas que contaban con él (bajar de curso queda abierto a 3º y 4º).
3. `materiasDe` + filtro en combate y monstruos; opciones barajadas en `Selector.elegir`.
4. Recorrido en navegador con una clase de 3º y otra de 6º; revisión independiente; «¿Fusiono y subo?».

## Después: Inglés y EF (Javi, mismo día)

Javi mandó `ingles.md` y `ef.md`: 100 por curso (75 + 25) de 3º a 6º. El conversor lee ya todas las fuentes y genera un
solo `data/preguntas/generadas.ts` (sin argumentos). 5º suma las suyas a las 40 + 40 que ya tenía (no se sustituyen:
son preguntas ya revisadas y hay pendientes del alumnado con esos ids). Con eso todos los cursos tienen las cinco
materias; `materiasDe` se queda por si un curso pierde alguna.
