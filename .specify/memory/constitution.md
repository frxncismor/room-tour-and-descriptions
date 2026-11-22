# Constitución de room-tour-and-descriptions (Interior Viewer)

Proyecto de portfolio: visor 3D de una sala (Angular + Three.js) con descripciones de muebles.
Estos principios mandan sobre cualquier plan o tarea. Se redactó el 2026-11-22 (corrida de orquestación 11221609).

## Principios

### I. Repo siempre verde (NO NEGOCIABLE)

Todo commit que se integre deja pasando `npm run lint:check`, `npm run build` (producción) y `npm test`
(headless, sin watch). Un cambio que rompa alguno se corrige o se revierte antes de seguir. Un cambio de
dependencias (salto de Angular, three) va en commits propios y separados de los arreglos funcionales.

### II. Sin regresiones visuales ni de comportamiento

Antes de tocar escena, luces, materiales, cámara o estilos se toma una captura de referencia
(escritorio 1280×800 y móvil 390×844) y se compara después. Una diferencia visual intencionada se
anota en el commit; una no intencionada es un bug. Lo que la UI promete (ayuda, README) debe funcionar.

### III. Accesibilidad básica

Contraste AA en paneles, foco visible en todo control, `Esc` cierra paneles, el canvas tiene `role` y
`aria-label`, hay alternativa de teclado para lo que se hace con el ratón, los cambios dinámicos
se anuncian (`aria-live`), no se usan emojis como único contenido de un control, y se respeta
`prefers-reduced-motion`.

### IV. Rendimiento y limpieza de recursos

El bucle de render no provoca detección de cambios de Angular (fuera de la zona, o sin zona). Todo
`requestAnimationFrame`, listener, geometría, material, textura y renderer que se crea se libera en
`dispose`. Se renderiza con `devicePixelRatio` acotado. Los assets cargados en la primera visita
pesan lo que fija el plan (objetivo ≤ 8 MB), y la carga muestra progreso real.

### V. Errores visibles, nunca mudos

Un fallo de WebGL, de carga o de interacción se muestra al usuario con un mensaje y una acción
(reintentar) además de registrarse. Prohibido `catch` que solo hace `console.error`.

### VI. Cambios pequeños, convencionales y probados

Commits convencionales (`feat|fix|refactor|test|docs|chore|build|ci(ámbito): resumen`). Cada arreglo de
lógica (servicios) lleva un test que falla sin él. Código muerto y dependencias sin uso se eliminan.
Se siguen `.editorconfig`, `.prettierrc` (2 espacios, `lf`) y `CONTRIBUTING.md`; si se contradicen,
se corrige el documento, no el formato.

### VII. Sin secretos, sin sorpresas de red

El proyecto es 100 % cliente y estático. No se añaden claves, analítica ni servicios externos sin
decisión expresa de Paco.

## Flujo de trabajo

- SDD con Spec Kit: spec → plan → tasks antes de implementar (`specs/NNN-nombre/`).
- Quien edita lo hace en su worktree; la integración la hace su orquestador. Nadie hace push a
  `main` directamente; la entrega es por PR con permiso de Paco.
- Una fase del plan solo se da por terminada cuando cumple sus criterios de aceptación (comando o
  comprobación manual concreta), no cuando "parece que funciona".

## Gobernanza

Esta constitución se cambia solo con una nota en el commit y la aprobación de Paco.

**Versión**: 1.0.0 | **Ratificada**: 2026-11-22 (pendiente de la aprobación de Paco) | **Última modificación**: 2026-11-22
