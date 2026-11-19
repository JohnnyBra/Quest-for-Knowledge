# Fase 3: baterías de 3º, 4º y 6º (listados de Javi)

**Spec:** `docs/superpowers/specs/2026-11-19-clases-y-panel-design.md` (fase 3). Javi entregó tres archivos
«Batería Maestra de 300 Preguntas» (3º, 4º, 6º): por curso, Lengua, Matemáticas y Conocimiento del Medio, cada una con
75 de explorador y 25 de jefe. **No traen Inglés ni Educación Física.** El contenido es de Javi: no se reescribe, solo se
adapta al juego.

## Qué hay que adaptar al convertir

1. **La correcta es casi siempre la B** (883 de 900). Las opciones se barajan en la conversión, con una semilla sacada de
   la huella del enunciado (siempre igual, se puede repetir la conversión).
2. **Pistas en la correcta**: la correcta suele llevar un paréntesis final que las demás no («4 sílabas (ma-ri-po-sa)»).
   Si ninguna otra opción acaba en paréntesis, ese paréntesis pasa a `explanation`. Lo mismo con «(Correcta - …)».
   El juego muestra la explicación al fallar, junto a la respuesta correcta.
3. **Fórmulas LaTeX** (`$7 \times 4$`, `^\circ`, `\frac{a}{b}`…) → texto (`7 × 4`, `°`, `a/b`). Negritas `**` fuera.
4. **Pregunta 91 de Lengua de 4º** sin «(Correcta)» en el formato habitual: la marca va como «(Correcta - …)».

## Materias sin preguntas

Un curso sin preguntas de una materia no la ofrece: ni botón en el combate ni monstruos débiles a ella.
(`materiasDe(curso)` en `data/preguntas/index.ts`.) 5º sigue con sus cinco materias.

## Tareas

1. Pruebas de las baterías (300, 75+25 por materia, sin `$`, `\`, `(Correcta`, `**`; correctas repartidas) → rojo.
2. `scripts/importar-preguntas.ts <md> <curso>` genera `data/preguntas/cN.ts` → verde. Quitar el respaldo de 5º en
   `bateria()`; ajustar las pruebas que contaban con él (bajar de curso queda abierto a 3º y 4º).
3. `materiasDe` + filtro en combate y monstruos; explicación en el mensaje de fallo.
4. Recorrido en navegador con una clase de 3º y otra de 6º; revisión independiente; «¿Fusiono y subo?».
