# Especificación: Sala completa, decorada e interactuable

**Feature**: `004-sala-completa` · **Fecha**: 2026-11-23 · **Estado**: Borrador para aprobación del principal (cada decisión lleva su recomendación y su alternativa; `tasks.md` las asume todas)
**Base**: rama `orq/11221609` @ `352056d` (Angular 21, three 0.187, Vitest, PR #3). **Idioma de spec/plan/tasks**: español; la UI sigue siendo bilingüe EN/ES (spec 003).
**Insumos**: `runs/11221609/11221609-explorador-escena4.md` (inventario, interacción, cámara, rendimiento, bundle), `…-especialista-assets4.md` (10 piezas Poly Haven medidas), `…-especialista-layout4.md` (bug del visor), capturas `11.png`/`12.png` de Paco y mediciones propias de esta spec (§A.4, §F; descargas fuera del repo, borradas al acabar).
**Relación con 001–003**: no revierte nada. Añade piezas, un registro de piezas interactivas, acciones reales (TV, escritorio, tocadiscos, lámparas), paredes seleccionables con encuadre y una lista agrupada. Sustituye D-315 de la 003 («ninguna pieza nueva es interactiva»). La constitución sigue vigente entera.

## Contexto y objetivo

Paco probó la ronda 3 y pidió: _«Me gustó mucho cómo adornaste la habitación, pero le faltan más cosas. También debe estar decorado, y con opciones de acercarse con zoom, las paredes que están detrás del espectador. Todo el espacio del cuarto debe ser interactuable.»_ Después precisó: **3–4 piezas interactuables «de verdad»** (que hagan algo al pulsarlas además de la ficha EN/ES), con prioridad para la **TV** (se enciende y muestra contenido) y el **escritorio** (pantalla y/o lámpara que se enciende), y 1–2 más con sentido (tocadiscos con plato que gira y sonido opcional silenciado; rincón de lectura con lámpara). Le encanta la vista inicial; girada 180° la sala le parece «demasiado vacía». Criterio rector de la corrida: **profesional, sobrio, cálido, coherente con lo que ya le gusta; llenar sin recargar**.

Traducción operativa:

- **Vista inicial intacta.** Lo que Paco ve al abrir la app (pared verde, láminas, apliques, estantería, reloj, ventana, díptico) **no se mueve ni se toca**. Toda la decoración nueva va fuera de los conos de visión de las cámaras iniciales (escritorio, ultraancha 2,2:1 y retrato 390×844); lo único que cambia en esa vista es una **cornisa** fina (D-416, decisión de Paco 3).
- **Media sala nueva.** La mitad delantera (z > 0) y los laterales hoy no tienen nada. Se organiza en **cuatro zonas** (TV, trabajo, lectura, música) con 24 piezas nuevas; la pared de la tele (z = +8) copia el lenguaje de la verde (simetría, eje de 1,60 m, láminas).
- **Interacción «de verdad»**: 4 familias con acción real (TV, escritorio = monitor + flexo, tocadiscos, rincón de lectura = lámpara de lectura + lámpara de pie) con máquinas de estados, accesibles por teclado y respetando `prefers-reduced-motion`.
- **Todo seleccionable**: **35 piezas** con ficha EN/ES (incluida la decoración de las rondas 2 y 3) y **5 superficies** (4 paredes + techo) que encuadran de frente al pulsarlas; zoom libre hacia el cursor dentro de la sala.
- **Presupuestos**: bundle inicial ≤ 890 kB sin subir límites, frame móvil ×4 < 16,7 ms en **dos** vistas (inicial y girada 180°), assets ≤ 6,5 MiB, A11y 100, EN/ES completo.

**Fuera de alcance**: mover o reescalar sala, sofá, mesa, estantería o cualquier pieza existente; reducir la sala (D-400); vídeo o música con derechos de terceros; luces con sombra nuevas o `PointLight` nuevas (D-407); alfombras seleccionables (son suelo: el clic sigue teletransportando); puerta que se abre, ventana animada, modo oscuro, niebla; backend o analítica; tocar el fix de la cámara inicial; más de dos idiomas.

## Estado de partida (verificado en el código, @352056d)

- Sala 16×16×4 m. Solo 5 muebles son interactivos (`MODEL_CONFIGURATIONS`); reloj y jarrón (glTF) y toda la decoración 3 (fusionada por material, raycast anulado) se ven pero no se pueden seleccionar. Las paredes **entran en el raycast pero se ignoran**: el clic en una pared solo cierra la ficha (`scene.service.ts:789-791`).
- Cámara: `maxDistance` = 8 m, objetivo y cámara fijados a ±7,5 m (0,5 m de margen), `focusOn` ya encuadra planos finos de frente; **no existe «encuadrar pared»**. Una pared de 16 m cabe justo a 8 m en 16:10 y **no cabe** en retrato (anchura visible ≈ 7,5 m).
- Bundle inicial **884,8 kB** (build: 886,95 kB con CSS); aviso 890, error 900: margen ≈ 3–5 kB. Todo texto nuevo en `en.ts` entra en el inicial; `es.ts` y la decoración 3 son perezosos.
- Rendimiento: frame móvil ×4 **14,05 ms** de mediana (p95 34,3; límite 16,7), sombra directa de 2048² con 3 casters, 6 luces en cada shader, 0 instancing, fusión por material. Assets: `src/assets` = 4 044 814 B (3,86 MiB).
- **Visor**: la lista aparece cortada en `11.png`. Causa raíz probable: scroll programático de `.viewer-container` (`overflow: hidden` es desplazable por código) por `scrollIntoView` en `object-list.component.ts:251` o `focus()` sin `preventScroll` en `help-panel.component.ts:247` (ver §E).
- **El icono circular oscuro del borde derecho de `11.png` no es nuestro**: se buscó en `src/` (`position: fixed`, `border-radius: 50%/999px`, botones circulares) y no existe ningún elemento así; el único elemento anclado a la derecha es «Controls». Es casi seguro una extensión del navegador de Paco (no verificable sin su navegador).

## Historias de usuario

### US41 — La sala se ve completa desde cualquier orientación (P1)

Como visitante, al girar 180° desde la vista inicial veo la pared de la tele con aparador, televisión de marco, láminas, ficus y un rincón de estar con alfombra, sillón, mesa de centro y lámpara colgante; los laterales (ventana, escritorio, lectura, música) tienen composición propia. Nada recarga y nada compite con la vista que ya me gusta.
**Prueba independiente**: capturas 1280×800 y 390×844 de la vista inicial (idéntica salvo cornisa) y de la vista 180° frente a `mockups/walls.png`/`plan.png`.
**Escenarios**:

1. _Dado_ la vista inicial de escritorio, ultraancha o retrato, _entonces_ no aparece ninguna pieza nueva (SC-400, SC-412) salvo la cornisa.
2. _Dado_ la cámara en (0; 1,7; 4,5) mirando a +z, _entonces_ se ven la TV centrada con aparador, dos láminas, el ficus, el sillón y la alfombra, equilibrados respecto a x = 0.
3. _Dado_ cualquier pared, _entonces_ lleva composición propia con el eje de 1,60 m para láminas y espejo (± 0,02) y sin solapes (SC-412).

### US42 — Las cosas «hacen algo» al pulsarlas (P1)

Como visitante, pulso la TV y se enciende mostrando una lámina; pulso el monitor o el flexo del escritorio y se encienden; pulso el tocadiscos y el plato gira; pulso la lámpara de lectura o la de pie y se encienden o apagan. Todo tiene botón en la ficha para teclado y lector de pantalla; el sonido, si lo activo, parte silenciado.
**Prueba independiente**: tests de máquina de estados (TV, monitor, lámparas, tocadiscos) + recorrido por teclado + capturas de cada estado (SC-402, SC-403).
**Escenarios**:

1. _Dado_ la TV apagada, _cuando_ la pulso en la escena, _entonces_ la cámara la encuadra, se enciende en modo arte y la ficha muestra «Apagar» (`aria-pressed`) y la lámina actual en un `aria-live`.
2. _Dado_ la TV seleccionada desde la lista con el teclado, _entonces_ **no** se enciende sola; se enciende con el botón de la ficha (Intro/Espacio).
3. _Dado_ `prefers-reduced-motion: reduce`, _entonces_ la TV no hace fundidos ni avanza sola (solo «Siguiente lámina») y el plato del tocadiscos no gira: aparece el brazo apoyado y el texto «reproduciendo».
4. _Dado_ el tocadiscos girando y el botón «Sonido» sin pulsar, _entonces_ no se crea `AudioContext` ni suena nada.

### US43 — Todo el espacio es seleccionable y las paredes se pueden acercar (P1)

Como visitante, pulso cualquier pieza (incluidos reloj, jarrón, láminas, apliques, ventana, cojines) y obtengo su ficha EN/ES; pulso una pared y la cámara la encuadra de frente (por tramos si no cabe entera); con la rueda o el pellizco me acerco hacia el punto señalado hasta leer una lámina a 1 m.
**Prueba independiente**: tests de prioridad de raycast (pieza > pared > suelo), de encuadre (esquinas del tramo dentro del frustum a 1,6:1, 1,33:1 y 0,46:1) y de límites del zoom (SC-408, SC-409).
**Escenarios**:

1. _Dado_ un clic en un hueco de la pared verde, _entonces_ se encuadra la pared entera (escritorio) o su primer/segundo tramo (retrato) y la ficha de pared lo anuncia; con una pieza delante, el clic selecciona la pieza.
2. _Dado_ una pared encuadrada en retrato, _entonces_ los botones «Tramo anterior/siguiente» de la ficha recorren los tramos.
3. _Dado_ un clic en suelo libre, _entonces_ sigue teletransportando (sin cambios); un clic en alfombra también.
4. _Dado_ el zoom con la rueda sobre una lámina, _entonces_ la cámara se acerca hacia el cursor sin atravesar la pared (≥ 0,5 m) ni salir de la sala.

### US44 — La lista sigue siendo usable con 35 entradas (P1)

Como visitante de escritorio veo la lista agrupada por pared/zona con contador, una entrada «Ver pared» por grupo y una búsqueda; como visitante móvil veo una tira de zonas y debajo la tira de piezas de la zona activa.
**Escenarios**: (1) 6 grupos, 35 entradas, un grupo abierto a la vez (el de la selección); (2) buscar «lám» en ES filtra sin distinguir acentos y mantiene el orden; (3) lista y ficha por teclado (Tab, Intro, `Esc`); (4) en 390 px las dos tiras no tapan «Controls/Controles» ni el selector EN/ES.

### US45 — La lista y el visor no se desplazan solos (P1, fix)

Como visitante, la lista «Pieces», el selector EN/ES y «Controls» nunca se cortan ni se desplazan, hagas lo que hagas (seleccionar, ayuda, teclado, zoom del navegador al 125 %).
**Prueba independiente**: script CDP + tests unitarios (SC-411).

### US46 — Sigue siendo rápido y ligero (P2)

Como visitante en un móvil, la app carga y se mueve como hoy: el bundle inicial no sube, el frame no pasa de 16,7 ms ni en la vista inicial ni mirando a la pared de la tele, y los assets nuevos no pasan de 6,5 MiB.

## A. Composición

### A.1 Reglas

1. **Intocable**: la vista inicial (desktop, ultraancha, retrato) y todas las piezas existentes (posición, escala, material). Cualquier pieza nueva queda fuera de los conos de la planta `mockups/plan.png` (comprobado por script: 0 solapes, 0 piezas nuevas en cono; el cono ultraancho usa aspecto 2,2:1, el de la captura de Paco es 2,17:1). Consecuencia: en las paredes laterales solo se coloca decoración nueva con **z ≥ 0** (la ventana y el díptico existentes cubren z < −3,3).
2. **Eje 1,60 m** para láminas y centro del espejo (± 0,02); TV centrada a 1,40; apliques fuera de esta ronda. Marco único de láminas (0,69×0,89 m, `#1f1b18`, paspartú `#f4efe6`) para las 4 láminas nuevas.
3. **Simetría** en la pared de la tele respecto a x = 0 (TV y aparador al centro; láminas a ±2,75; puerta a +5,6 y espejo a −5,6; ficus a −3,8 contra el sillón a +1,85).
4. **Zonas por alfombra y agrupación, no por paredes.** Se valoró acercar las paredes (sala de 12×12): se **descarta** (D-400): cambia el encuadre inicial que le encanta, obliga a reescalar sofá/mesa/estantería y la 003 ya lo rechazó (D-325). En su lugar la sala se subdivide con **dos alfombras nuevas** (salón de TV 4,0×2,6 m en (0,2; 5,95), rincón de lectura redonda Ø2,3 m en (−6,4; 4,5), ambas con la textura y los colores de la alfombra existente: 0 B) y con la disposición de los asientos. Los pasillos libres entre piezas nuevas son ≥ 0,9 m.
5. **Distancias a pared**: láminas, espejo, puerta y TV a 0,02–0,06 m de la pared (regla SC-203/SC-307).
6. **Paleta**: nogal (`#5a4333`), roble (textura del suelo), latón `#a8823f`, lino/crema `#e8dcc3`, cuero negro/marrón de los glTF, verde hoja `#4d7048`. Sin colores nuevos fuera de la gama terracota/teal/crema que ya gusta.

### A.2 Inventario: 35 piezas seleccionables

Coordenadas de escena (m, Y arriba). Centro del volumen salvo indicación; rotación Y: pared verde 0, derecha −π/2, frontal π, izquierda +π/2. Tamaño = ancho a lo largo de la pared × alto × fondo. Peso: glTF Poly Haven **medido** (glTF + bin + texturas WebP q85, 512 px, método de §A.4); procedural 0 B; láminas **estimadas** a 57 kB (media de las 4 de la 003: 56,6 kB). Los tris de glTF son medidos (accessors); los procedurales, estimaciones de diseño (se miden en F5). Las rotaciones de glTF marcadas «≈» se **verifican con captura** en T-453 (el frente del modelo no está documentado). Todas las piezas nuevas llevan ficha EN/ES (§B.5) y una o varias cajas de raycast («proxies», §C.1).

**Green wall / Pared verde**

| id                  | Pieza (EN / ES)                         | Centro (x; y; z) · rot. Y  | Tamaño an×al×fo (m) | Fuente · licencia · autor        | Peso          | Tris | Acción |
| ------------------- | --------------------------------------- | -------------------------- | ------------------- | -------------------------------- | ------------- | ---- | ------ |
| `landscapePainting` | Landscape painting / Cuadro de paisaje  | (−4,00; 1,60; −7,97) · 0   | 1,21×0,93×0,07      | existente                        | ya en el repo | —    | —      |
| `bookshelf`         | Bookshelf / Estantería                  | (0,00; 1,07; −7,60) · 0    | 1,83×2,13×0,39      | existente                        | ya en el repo | —    | —      |
| `succulent`         | Potted succulent / Suculenta en maceta  | (1,85; 0,30; −7,55) · +π/6 | 0,37×0,59×0,37      | existente                        | ya en el repo | —    | —      |
| `clock`             | Wall clock / Reloj de pared             | (4,00; 1,60; −7,95) · 0    | 0,64×0,64×0,06      | existente (hoy decorativo)       | ya en el repo | —    | —      |
| `vase`              | Ceramic vase / Jarrón de cerámica       | (−1,85; 0,34; −7,55) · 0   | 0,48×0,68×0,48      | existente (hoy decorativo)       | ya en el repo | —    | —      |
| `printSpiraea`      | Cyanotype: Spiraea / Cianotipo: Spiraea | (−6,35; 1,60; −7,95) · 0   | 0,69×0,89×0,03      | existente (003, A. Atkins)       | ya en el repo | —    | —      |
| `printFelce`        | Salt print: Felce / Papel salado: Felce | (6,35; 1,60; −7,95) · 0    | 0,69×0,89×0,03      | existente (003, W. H. F. Talbot) | ya en el repo | —    | —      |
| `sconcesBack`       | Brass wall sconces / Apliques de latón  | (0,00; 1,70; −7,93) · 0    | 3,70×0,30×0,16      | existente (003)                  | ya en el repo | —    | —      |

**Window wall / Pared de la ventana**

| id             | Pieza (EN / ES)                                           | Centro (x; y; z) · rot. Y   | Tamaño an×al×fo (m) | Fuente · licencia · autor                                                                 | Peso          | Tris | Acción                       |
| -------------- | --------------------------------------------------------- | --------------------------- | ------------------- | ----------------------------------------------------------------------------------------- | ------------- | ---- | ---------------------------- |
| `window`       | Window with linen curtains / Ventana con cortinas de lino | (−7,85; 1,45; −5,00) · +π/2 | 3,00×2,90×0,20      | existente (003)                                                                           | ya en el repo | —    | —                            |
| `floorLamp`    | Floor lamp / Lámpara de pie                               | (−7,20; 0,82; −7,20) · 0    | 0,45×1,65×0,45      | existente (003) + acción                                                                  | ya en el repo | —    | luz (encendida de inicio)    |
| `readingChair` | Reading chair & side table / Sillón de lectura y mesita   | (−6,35; 0,59; 3,90) · 1,27  | 1,01×1,17×1,19      | Poly Haven `mid_century_lounge_chair` + `side_table_01` · CC0 · K. Siitonen · J. R. Cock  | 0,43 MiB      | 8904 | —                            |
| `readingLamp`  | Reading lamp / Lámpara de lectura                         | (−6,55; 0,83; 5,20) · 0     | 0,30×0,55×0,30      | procedural                                                                                | 0 B           | 230  | luz (apagada de inicio)      |
| `sideboard`    | Sideboard with records / Aparador con discos              | (−7,69; 0,33; 0,90) · +π/2  | 1,03×0,65×0,61      | Poly Haven `vintage_wooden_drawer_01` (esc. 0,6) + discos procedurales · CC0 · J. R. Cock | 0,30 MiB      | 5284 | —                            |
| `turntable`    | Turntable / Tocadiscos                                    | (−7,66; 0,69; 0,90) · +π/2  | 0,43×0,08×0,35      | procedural                                                                                | 0 B           | 520  | plato gira + sonido opcional |
| `bookcaseLeft` | Reading-corner bookcase / Librería del rincón             | (−7,80; 1,07; 6,90) · +π/2  | 1,83×2,13×0,39      | clon de `bookshelf` (existente)                                                           | 0 B           | 3000 | —                            |
| `printNook`    | Botanical print (nook) / Lámina botánica (rincón)         | (−7,95; 1,60; 3,20) · +π/2  | 0,69×0,89×0,03      | lámina nueva G (dominio público, §A.3)                                                    | 57 kB         | 104  | —                            |

**TV wall / Pared de la tele**

| id            | Pieza (EN / ES)                                                   | Centro (x; y; z) · rot. Y | Tamaño an×al×fo (m) | Fuente · licencia · autor                         | Peso     | Tris | Acción                          |
| ------------- | ----------------------------------------------------------------- | ------------------------- | ------------------- | ------------------------------------------------- | -------- | ---- | ------------------------------- |
| `tv`          | Television / Televisión                                           | (0,00; 1,40; 7,96) · π    | 1,26×0,72×0,04      | procedural (marco de nogal)                       | 0 B      | 70   | enciende: modo arte + siguiente |
| `credenza`    | Walnut sideboard / Aparador de nogal                              | (0,00; 0,40; 7,74) · π    | 2,00×0,90×0,50      | procedural + clon de `vase` + libros procedurales | 0 B      | 3342 | —                               |
| `printsFront` | Botanical prints (TV wall) / Láminas botánicas (pared de la tele) | (0,00; 1,60; 7,95) · π    | 6,20×0,89×0,03      | láminas nuevas E, F (dominio público, §A.3)       | 0,11 MiB | 208  | —                               |
| `plantFicus`  | Rubber plant / Ficus de hoja grande                               | (−3,80; 0,88; 7,30) · 0   | 0,90×1,75×0,90      | procedural (maceta + hojas curvas)                | 0 B      | 620  | —                               |
| `door`        | Panel door / Puerta de paneles                                    | (5,60; 1,05; 7,97) · π    | 1,08×2,10×0,06      | procedural (hoja, cerco, manilla de latón)        | 0 B      | 260  | —                               |
| `archMirror`  | Arched mirror / Espejo de arco                                    | (−5,60; 1,45; 7,96) · π   | 0,80×1,70×0,03      | procedural (marco de latón, vidrio con brillo)    | 0 B      | 220  | —                               |

**Desk wall / Pared del escritorio**

| id               | Pieza (EN / ES)                                                      | Centro (x; y; z) · rot. Y  | Tamaño an×al×fo (m) | Fuente · licencia · autor                                                                                                       | Peso          | Tris | Acción                     |
| ---------------- | -------------------------------------------------------------------- | -------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---- | -------------------------- |
| `diptych`        | Cyanotype diptych / Díptico de cianotipos                            | (7,95; 1,60; −5,50) · −π/2 | 1,52×0,89×0,03      | existente (003, A. Atkins)                                                                                                      | ya en el repo | —    | —                          |
| `tallCabinet`    | Painted armoire / Armario pintado                                    | (7,63; 1,28; 0,00) · −π/2  | 1,00×2,57×0,73      | Poly Haven `painted_wooden_cabinet_02` (teñido crema) · CC0 · K. Sannikov                                                       | 0,11 MiB      | 966  | —                          |
| `printRight`     | Botanical print (desk wall) / Lámina botánica (pared del escritorio) | (7,95; 1,60; 1,30) · −π/2  | 0,69×0,89×0,03      | lámina nueva H (dominio público, §A.3)                                                                                          | 57 kB         | 104  | —                          |
| `desk`           | Oak desk, chair & shelf / Escritorio de roble, silla y estante       | (7,62; 0,38; 3,50) · −π/2  | 1,50×0,75×0,70      | procedural (roble con la textura del suelo) + Poly Haven `painted_wooden_chair_02` (teñida) · CC0 (silla) · K. Sannikov (silla) | 0,16 MiB      | 1626 | —                          |
| `monitor`        | Monitor / Monitor                                                    | (7,68; 1,02; 3,50) · −π/2  | 0,63×0,45×0,14      | procedural (pantalla con textura de canvas)                                                                                     | 0 B           | 140  | enciende/apaga la pantalla |
| `deskLamp`       | Desk lamp / Flexo                                                    | (7,52; 1,03; 2,95) · −π/2  | 0,30×0,55×0,34      | procedural (latón, pantalla emisiva)                                                                                            | 0 B           | 220  | luz (apagada de inicio)    |
| `displayShelves` | Display shelves / Estantería de cubos                                | (7,78; 0,78; 6,25) · −π/2  | 1,08×1,56×0,37      | Poly Haven `wooden_display_shelves_01` + objetos procedurales · CC0 · J. R. Cock                                                | 0,17 MiB      | 3474 | —                          |

**Floor & seating / Suelo y asientos**

| id              | Pieza (EN / ES)                    | Centro (x; y; z) · rot. Y   | Tamaño an×al×fo (m) | Fuente · licencia · autor                               | Peso          | Tris | Acción |
| --------------- | ---------------------------------- | --------------------------- | ------------------- | ------------------------------------------------------- | ------------- | ---- | ------ |
| `sofa`          | Sectional sofa / Sofá modular      | (−3,00; 0,67; −3,00) · +π/4 | 3,90×1,33×3,60      | existente                                               | ya en el repo | —    | —      |
| `cushionsThrow` | Cushions & throw / Cojines y manta | (−3,30; 0,70; −3,90) · 0    | 2,00×0,50×1,60      | existente (003, hoy decorativos)                        | ya en el repo | —    | —      |
| `pokerTable`    | Poker table / Mesa de póker        | (3,00; 0,55; −3,00) · 0     | 1,30×1,09×1,30      | existente                                               | ya en el repo | —    | —      |
| `armchair`      | Leather armchair / Sillón de cuero | (1,85; 0,51; 5,70) · -0,63  | 0,82×1,02×0,99      | Poly Haven `modern_arm_chair_01` · CC0 · Vibrant Nordic | 0,33 MiB      | 8916 | —      |
| `coffeeTable`   | Coffee table / Mesa de centro      | (0,15; 0,20; 5,90) · +π/2   | 0,60×0,39×1,20      | Poly Haven `modern_coffee_table_01` · CC0 · Amin        | 0,19 MiB      | 4504 | —      |

**Ceiling / Techo**

| id        | Pieza (EN / ES)                       | Centro (x; y; z) · rot. Y | Tamaño an×al×fo (m) | Fuente · licencia · autor                              | Peso     | Tris | Acción |
| --------- | ------------------------------------- | ------------------------- | ------------------- | ------------------------------------------------------ | -------- | ---- | ------ |
| `pendant` | Glass pendant lamp / Lámpara colgante | (0,15; 3,52; 5,90) · 0    | 0,43×0,95×0,43      | Poly Haven `modern_ceiling_lamp_01` · CC0 · J. R. Cock | 0,19 MiB | 5602 | —      |

**Otros elementos nuevos no seleccionables**: cornisa perimetral (0,09 × 0,07 m, `#f3ece1`, 4 tramos fusionados, ≈ 200 tris, 1 malla); **alfombra del salón de TV** y **alfombra redonda del rincón** (0 B, ≈ 80 tris, 4 mallas); 4 halos aditivos y 4 «charcos» de luz para las fuentes emisivas (0 B, texturas radiales de canvas ya existentes en la 003).

**Totales nuevos**: 24 piezas nuevas + 11 existentes que pasan a ser seleccionables = 35 entradas · **≈ 49 000 tris** (≈ 44,5 k de glTF medidos + ≈ 4,4 k procedurales estimados) · **≈ 2,10 MiB** de assets listados (9 modelos 1,88 MiB + 4 láminas ≈ 0,22 MiB), ver §F.

### A.3 Láminas nuevas (E, F, G, H) y créditos

Mismas reglas que la 003 §A.3: obras de **dominio público** (botánica en cianotipo de Anna Atkins, NYPL/Wikimedia Commons, y papel salado de W. H. F. Talbot), recortadas a 5:7 y exportadas a WebP q85 de 512×717. Las 4 nuevas deben ser **distintas** de A–D y de tono azul/sepia para leerse como colección. T-412 elige las obras concretas, **verifica la licencia en la página de cada archivo** y las registra en `README.md` (obra, autor, año, fuente, licencia). El modo arte de la TV muestra **las 8** láminas. Peso estimado 4 × 57 kB ≈ 228 kB (≤ 110 kB cada una, se mide). Sin CC-BY: no hay atribución legal obligatoria; los créditos van igualmente al README.

### A.4 Cómo se midió

- **glTF**: descarga real de glTF 1k de Poly Haven (API `files/<id>`), conteo de triángulos desde los accessors y nodos del propio glTF, textura reducida a 512 px y WebP q85 con ImageMagick 7.1.2; dimensiones de la caja desde `POSITION.min/max` con la transformación de los nodos (las cifras de `info` de la API no coinciden). Medidos en esta spec: `vintage_wooden_drawer_01` (5 184 tris · 0,30 MiB), `modern_coffee_table_01` (4 504 · 0,19), `Ottoman_01` (4 240 · 0,19, **descartado**), `wicker_basket_02` (17 850 · 0,60, **descartado**). El resto procede de `especialista-assets4` (mismo método). `meshopt` **no** está medido: el bin real será menor (cota superior).
- **Miniaturas revisadas** (Poly Haven, 256 px) antes de elegir: sillón de lectura de cuero marrón, sillón de cuero negro con brazos de madera, cómoda de madera con tiradores de latón y armario pintado encajan en la paleta; el aparador `modern_wooden_cabinet` también, pero pesa 1,19 MiB y 25 k tris (D-401); las dos tele CRT (`Television_01/02`), los marcos `fancy_*` y la cesta de mimbre se descartan por estilo o peso. **El escritorio `metal_office_desk` se descarta** (industrial, gris) y se hace de roble procedural.
- **Visibilidad**: cámara inicial de escritorio (0; 1,7; 4,5) con FOV vertical 65° y aspectos 1,6 y 2,2; cámara de retrato (7; 3,8; −1,5) → (0; 0,5; −4,5) con FOV horizontal mínimo de 50°. Script de comprobación con esos conos sobre las cajas de `A.2`: 0 solapes entre piezas nuevas y existentes y 0 piezas nuevas visibles (los 4 avisos restantes son las propias piezas existentes, p. ej. cojines dentro del sofá).

### A.5 Requisitos funcionales — composición

- **FR-400**: `src/app/pieces/pieces.config.ts` (nuevo, **perezoso**) describe las 24 piezas nuevas y los datos de las 11 existentes que se hacen seleccionables (id, grupo, posición, rotación, tamaño, proxies, orientación frontal, acciones). Los números de esta spec viven allí y solo allí.
- **FR-401**: la construcción vive en un chunk perezoso (`import()` en `SceneService`); el bundle inicial **no** importa `pieces.config.ts` ni sus builders (D-412/D-413).
- **FR-402**: glTF nuevos con `mergeMeshes` por modelo, `castShadow: false` salvo sillones, aparador de nogal y armario (≤ 6 casters nuevos); procedurales fusionados **por material y por zona** (cada zona es un `Group` con su esfera envolvente para el frustum culling).
- **FR-403**: las alfombras nuevas reutilizan `RUG_TEXTURES`; la alfombra no es seleccionable y no captura el clic (teletransporte intacto).
- **FR-404**: ninguna pieza nueva interseca otra, un mueble o una pared (tests con `Box3`, SC-412) y ninguna cae en los frustums de las vistas iniciales.

## B. Interacciones «de verdad»

### B.1 Máquinas de estados

Estado **solo de sesión** (no se guarda). Estado inicial: **todo apagado excepto la lámpara de pie, que sigue encendida** (así la vista inicial no cambia). Reducir movimiento (`prefers-reduced-motion`) se lee en cada transición.

| Pieza                                                                                      | Estados                                           | Eventos → transición                                                                                                                                                                                                                                          | Efecto visual                                                                                                                                                                                                                              | Reducir movimiento                                                                                 |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **TV** `tv`                                                                                | `off` · `on(i)` con `i ∈ 0..7`                    | `POWER`: off→on(0) / on→off · `NEXT` (solo on): i→(i+1) mod 8 · `TICK` (cada 8 s, solo on): igual que `NEXT`                                                                                                                                                  | **off**: cristal oscuro con brillo tenue; **on**: pantalla `MeshBasic` (`toneMapped:false`) con la lámina `i` centrada sobre paspartú `#f4efe6`, fundido de 1,2 s entre dos planos, halo cálido aditivo detrás (opacidad 0 → 0,3 en 0,4 s) | sin fundidos (corte), sin `TICK`; solo `NEXT` manual                                               |
| **Monitor** `monitor`                                                                      | `off` · `on`                                      | `POWER`                                                                                                                                                                                                                                                       | **on**: textura de canvas 512×288 dibujada **una vez** (barras de «código» sin texto legible, tonos cálidos) con material emisivo; halo azulado pequeño sobre la mesa (opacidad 0,18). **off**: vidrio oscuro                              | instantáneo                                                                                        |
| **Flexo** `deskLamp`, **Lámpara de lectura** `readingLamp`, **Lámpara de pie** `floorLamp` | `off` · `on`                                      | `POWER`                                                                                                                                                                                                                                                       | pantalla con `emissiveIntensity` 0 ↔ 0,9, **halo aditivo** (pared) y **charco de luz** aditivo (mesa/suelo) con opacidad 0 ↔ 0,35; la lámpara de pie además atenúa su `PointLight` existente (2,2 ↔ 0). Transición 0,3 s                | instantáneo                                                                                        |
| **Tocadiscos** `turntable`                                                                 | `spin: stopped·spinning` y `sound: muted·audible` | `SPIN_ON`: plato 33⅓ rpm (≈ 0,56 vueltas/s), brazo apoyado · `SPIN_OFF`: frena en 1 s, brazo en reposo, **fuerza `sound = muted`** · `SOUND_ON` (solo si `spinning`): crea `AudioContext` en ese gesto, fundido de entrada 0,6 s · `SOUND_OFF`: fundido 0,3 s | plato (malla propia) gira en `update(dt)`; sin trabajo por frame cuando está parado                                                                                                                                                        | **no gira**: el brazo pasa a «apoyado» y la ficha dice «reproduciendo»; el sonido sigue disponible |

Reglas comunes: `visibilitychange` → oculta suspende audio y `TICK`; `dispose` cierra el `AudioContext`, cancela temporizadores y libera geometrías, materiales y texturas de canvas.

### B.2 Contenido de la TV (D-402)

**Modo arte**: pase de las 8 láminas de dominio público de la sala (A–D existentes + E–H nuevas), con pilar (paspartú) lateral por ser 5:7 en pantalla 16:9. Cero derechos de terceros, **0 B** extra (las texturas ya están cargadas), 2 mallas + 1 halo. La ficha muestra y anuncia la obra en pantalla («En pantalla: Pteris aquilina, Anna Atkins, h. 1850»; los títulos son nombres propios y no se traducen). _Alternativas_: canvas generativo (menos coherente con el resto), vídeo corto en bucle (peso y derechos), TV CRT de Poly Haven (estilo retro, no sobrio).

### B.3 Sonido del tocadiscos (D-404)

Generado con **Web Audio** (sin ficheros ni derechos): acordes de pad lento (4 compases de 8 s, osciladores triangulares con filtro paso bajo a 900 Hz) + crepitar de vinilo (ruido filtrado y disperso) a volumen máximo bajo (≈ −24 dB). Se crea solo al pulsar «Sonido» (política de autoplay), **desactivado por defecto**; el botón es `aria-pressed`, tiene etiqueta con estado («Sonido: apagado/encendido») y queda **deshabilitado con aria-disabled y pista** mientras el plato no gira. Coste: ≈ 1,5–2 kB en un chunk perezoso propio, 0 B de assets. _Alternativa_: sin audio en esta ronda (plato gira y ya) o una pista CC0 concreta (peso a medir).

### B.4 Cómo se activa (D-406)

| Gesto                                    | Efecto                                                                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clic/tap en la pieza en la escena**    | selecciona + encuadra + ficha; **si la acción principal está apagada, la ejecuta** (enciende); si la pieza ya estaba seleccionada, **alterna** |
| **Lista, teclado, Intro sobre la pieza** | selecciona + encuadra + ficha; **no** ejecuta (sin sorpresas para teclado y lector de pantalla)                                                |
| **Botón de la ficha**                    | ejecuta la acción (`aria-pressed`, Intro/Espacio); siempre disponible                                                                          |
| `Esc`                                    | cierra la ficha (el estado de las luces/TV se conserva)                                                                                        |

La ficha añade una sección «Acciones» (`role="group"`, etiqueta EN/ES) con botones de ≥ 44 px, un `aria-live` que anuncia el nuevo estado («Televisión encendida. En pantalla: …») y, en la TV, «Siguiente lámina»; el tocadiscos muestra «Plato: girando/parado» y «Sonido». Mockup: `mockups/ui-tv-desktop-*.png`, `ui-tv-mobile-*.png`.

### B.5 Luces (D-407)

**Sin `PointLight` ni `SpotLight` nuevas**: emisivo + **halo aditivo** (patrón de los apliques de la 003) + **charco de luz** aditivo. Coste por fuente: 0 luces en el shader (hoy 6–7, y cada luz extra encarece **todos** los materiales estándar, justo lo que subió el frame de 7,4 a 14,05 ms en la 003), 2 mallas de bajo coste. La lámpara de pie conserva su `PointLight`. _Alternativas_: una `PointLight` compartida que salta a la última lámpara encendida (+1 luz permanente); una por lámpara (+3, descartada).

### B.6 Textos EN/ES

**Reglas**: tuteo neutro (D-304), nombre ≤ 28 caracteres para la lista, descripción 1–2 frases de ≤ 220 caracteres, las acciones son verbos («Encender»/«Turn on»). Los **nombres** de las 35 piezas están en la tabla A.2 (EN / ES). **Textos de las piezas con acción y de las superficies** (los de las demás: una frase descriptiva y, si procede, «Detalles» con fuente y licencia, escritos en T-423):

| Clave                     | EN                                                                                                                                                               | ES                                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tv.description`          | A 55-inch screen in a walnut frame, hung low like a picture. In art mode it cycles through the cyanotypes and salt prints in this room, one every eight seconds. | Una pantalla de 55 pulgadas con marco de nogal, colgada baja como un cuadro. En modo arte repasa los cianotipos y papeles salados de esta sala, uno cada ocho segundos. |
| `tv.details`              | Screen content: public-domain plates from this room. Frame and sideboard: procedural.                                                                            | Contenido de la pantalla: láminas de dominio público de esta sala. Marco y aparador: procedurales.                                                                      |
| `tv.actions`              | Turn on / Turn off · Next picture · Showing: {work}                                                                                                              | Encender / Apagar · Siguiente lámina · En pantalla: {work}                                                                                                              |
| `tv.live`                 | Television on. Showing {work}. · Television off.                                                                                                                 | Televisión encendida. En pantalla: {work}. · Televisión apagada.                                                                                                        |
| `monitor.description`     | A slim monitor on the oak desk. Wake it to see a quiet editor window; it gives off a faint cool glow.                                                            | Un monitor fino sobre el escritorio de roble. Enciéndelo para ver una ventana de editor tranquila; da un leve resplandor frío.                                          |
| `monitor.actions`         | Turn on screen / Turn off screen                                                                                                                                 | Encender pantalla / Apagar pantalla                                                                                                                                     |
| `deskLamp.description`    | A brass desk lamp with an articulated arm. Its shade glows warm when it is on.                                                                                   | Un flexo de latón con brazo articulado. Su pantalla se ilumina en tono cálido al encenderlo.                                                                            |
| `readingLamp.description` | A small table lamp with a linen shade beside the reading chair.                                                                                                  | Una lámpara de mesa con pantalla de lino junto al sillón de lectura.                                                                                                    |
| `floorLamp.description`   | The corner floor lamp with a brass stem. It is on by default; switch it off to see the room without it.                                                          | La lámpara de pie de la esquina, de tallo de latón. Viene encendida; apágala para ver la sala sin ella.                                                                 |
| `lamps.actions`           | Turn on light / Turn off light                                                                                                                                   | Encender luz / Apagar luz                                                                                                                                               |
| `turntable.description`   | A walnut turntable with a brass tonearm on the sideboard. Start the record and the platter spins; sound is optional and off by default.                          | Un tocadiscos de nogal con brazo de latón sobre el aparador. Pon el disco y el plato gira; el sonido es opcional y viene apagado.                                       |
| `turntable.actions`       | Start record / Stop record · Sound: off / Sound: on · Start the record first                                                                                     | Poner disco / Parar disco · Sonido: apagado / Sonido: encendido · Pon antes el disco                                                                                    |
| `turntable.details`       | Sound is generated in your browser: no recordings, no downloads.                                                                                                 | El sonido se genera en tu navegador: sin grabaciones ni descargas.                                                                                                      |
| `wall.green`              | The teal wall: prints, brass sconces, bookshelf and clock around the bookshelf.                                                                                  | La pared verde: láminas, apliques de latón, estantería y reloj en torno a la librería.                                                                                  |
| `wall.window`             | The window wall: sunset window with linen curtains, floor lamp, reading nook and music corner.                                                                   | La pared de la ventana: ventana de atardecer con cortinas de lino, lámpara de pie, rincón de lectura y rincón de música.                                                |
| `wall.tv`                 | The TV wall: television over a walnut sideboard, flanked by botanical prints; door and arched mirror at the sides.                                               | La pared de la tele: televisión sobre aparador de nogal con láminas botánicas a los lados; puerta y espejo de arco en los extremos.                                     |
| `wall.desk`               | The desk wall: oak desk with monitor and lamp, display shelves, armoire and the cyanotype diptych.                                                               | La pared del escritorio: escritorio de roble con monitor y flexo, estantería de cubos, armario y el díptico de cianotipos.                                              |
| `ceiling`                 | The ceiling: soft cornice all around and a glass pendant over the TV lounge.                                                                                     | El techo: cornisa suave en todo el perímetro y una lámpara colgante sobre el salón de la tele.                                                                          |
| `wall.nav`                | Previous section · Next section · Section {n} of {m}                                                                                                             | Tramo anterior · Tramo siguiente · Tramo {n} de {m}                                                                                                                     |

Cadenas de interfaz nuevas (iniciales, en `en.ts`/`es.ts`, ≈ 20): `list.search`, `list.searchEmpty`, `list.viewWall`, `list.groups.*` (6), `panel.actions`, `wall.nav.*`. Todo texto de pieza va en `pieces.en.ts`/`pieces.es.ts` (perezosos, ≈ 11–14 kB cada uno, D-412).

## C. Todo seleccionable

### C.1 Cómo (D-408)

- **Registro de piezas** (`PIECES`, perezoso): por pieza, una o varias **cajas proxy** de raycast (`BoxGeometry` compartida, escala por pieza, material invisible compartido, `visible = false`: no se dibuja, pero el `Raycaster` las prueba), colocadas en las posiciones de A.2. El raycast usa una lista dedicada `pickables` (proxies + muebles + suelo + paredes) en lugar de recorrer toda la escena.
- **La fusión por material no cambia**: los procedurales siguen siendo una malla por material y zona, sin raycast; la identidad vive en los proxies. Los glTF nuevos (sillones, mesas, aparador, armario, estantería, colgante) se registran **directamente** como los muebles de hoy (silueta real); el reloj y el jarrón existentes pasan de `DECOR_CONFIGURATIONS` a seleccionables con proxy.
- **Contorno de selección** de las piezas con proxy: el casco invertido de siempre sobre la caja (rectángulo limpio); las piezas con varias cajas (apliques, láminas de la tele, escritorio+silla+estante) se resaltan **todas** y el encuadre usa la caja unión.
- **Tolerancia táctil** (rayos a 14 px) con la prioridad **pieza > pared > suelo**: una pieza dentro de la tolerancia gana a la pared que haya bajo el dedo.
- Ids: `SelectableId = FurnitureId | PieceId | SurfaceId`; `ObjectInfo` gana `kind: 'furniture' | 'piece' | 'surface'`. Los tipos son solo de compilación (0 B); `PieceId`/`SurfaceId` se definen en el chunk perezoso.

### C.2 Paredes y techo seleccionables (D-409)

- **Distinguir clic en pared de clic en pieza**: el rayo ordena por distancia; las piezas están **delante** de la pared (proxies a ≥ 0,02 m), así que ganan siempre; solo se elige pared cuando el primer impacto registrado es la pared. Hover: cursor `zoom-in` sobre pared, el de siempre sobre piezas; sin contorno en paredes (un plano de 16×4 m no tiene casco útil).
- **Encuadre**: al pulsar (o «Ver pared» en la lista) la cámara va de frente a la pared a una distancia `d = max(d_alto, d_ancho)`, con `d_alto` para 4,4 m de altura y `d_ancho` para el ancho del tramo + 0,8 m; **tope 9 m** para encuadrar (el `maxDistance` global sube de 8 a 12, D-410). Nº de tramos `n = ceil(16·1,04 / (2·9·tan(hFOV/2)))`: **1 tramo** en 16:10, 16:9 y ultraancha; **2 tramos** en 4:3 y retrato (390×844). El tramo elegido es el más cercano al punto pulsado. El objetivo se coloca 0,5 m delante de la pared para que el límite de sala no lo desplace.
- **Techo**: 5.ª superficie con pose fija desde el centro mirando 23° hacia arriba (≤ 30°, límite de `focusOn`), que incluye cornisa y colgante.
- **Ficha de pared**: nombre, descripción (§B.6), «Tramo n de m» con botones anterior/siguiente solo si `m > 1`, y `aria-live` con «Pared verde, tramo 1 de 2». Pulsar el vacío de otra pared pasa a esa pared; `Esc`/«Restablecer vista» vuelve.
- **Cambio de comportamiento**: el clic en una pared ya **no cierra la ficha** (la cierran la ✕, `Esc` o seleccionar otra cosa). La ayuda lo explica.

### C.3 Zoom libre (D-410)

`zoomToCursor = true` (rueda y pellizco hacia el punto señalado), `minDistance` 0,8 m, `maxDistance` 12 m, `zoomSpeed` 1. Cámara y objetivo siguen fijados a ±7,5 m (0,5 m a cada pared) y y ≥ 0,3: no se puede atravesar una pared ni salir de la sala. Alternativa: dolly al centro (sin `zoomToCursor`) si T-433 detecta deriva del objetivo contra `clampToRoom`.

### C.4 Requisitos funcionales

- **FR-410**: `ObjectInteractionService` lanza el rayo contra `pickables`, resuelve prioridad pieza > pared > suelo (también con tolerancia táctil) y devuelve `ObjectInfo` con `kind`.
- **FR-411**: `SceneService.selectObject(id)` acepta `SelectableId`; para piezas calcula el encuadre desde las cajas proxy (unión) y su orientación frontal; para paredes y techo delega en `CameraService.focusSurface`.
- **FR-412**: `CameraService.focusSurface(surface, tramo, aspect)` devuelve/anima la pose según C.2; `maxDistance` 12, `minDistance` 0,8, `zoomToCursor`.
- **FR-413**: ninguna pieza seleccionable queda sin ficha EN/ES: test de paridad entre `PIECES`, `pieces.en.ts` y `pieces.es.ts`.
- **FR-414**: el clic en alfombra o suelo libre sigue teletransportando (test).

## D. Lista de piezas

Escritorio (mockup `ui-list-desktop-en/es.png`): panel de 264 px; cabecera «Pieces»; **búsqueda** (`role="search"`, `type="search"`, insensible a mayúsculas y acentos); **acordeón de 6 grupos** con contador (`<button aria-expanded>`), **un grupo abierto a la vez** (el de la selección o el último abierto); dentro de cada grupo, primera fila «Ver pared» (`kind: surface`) y las piezas con la acción disponible marcada con una etiqueta («Encendida»/«On» cuando procede); «Restablecer vista» fijo abajo; la lista **desplaza dentro** del panel (`max-height: calc(100% − 96px)`), nunca el visor. Foco visible y orden de tabulación natural; `Esc` cierra la ficha.

Móvil ≤ 600 px (mockup `ui-list-mobile-*.png`): dos tiras bajo el borde superior: **pestañas de zona** (6, `role="tablist"`) y debajo la **tira de piezas** de la zona activa con «Ver pared» al principio; sin búsqueda (35 entradas en 6 zonas se recorren con dos toques). Se conserva el icono de restablecer al final; objetivos de ≥ 44 px.

- **FR-420**: `ObjectListComponent` recibe `groups: {id, name, items[]}[]`, `selectedId`, `query`; emite `selectItem(id)`, `viewSurface(id)`, `resetView`. `revealActive` solo mueve el `ul` de la tira móvil (§E).
- **FR-421**: el grupo y la pieza activos se anuncian con `aria-current`/`aria-pressed`; el cambio de idioma conserva foco y grupo abierto.

## E. Fix: el visor no se desplaza solo

**Causa raíz (probable, no reproducida en navegador)**: `.viewer-container { overflow: hidden }` (`viewer.component.scss:11`) sigue siendo desplazable por código y todos sus hijos son `position: absolute`: un scroll programático los mueve a la vez (patrón de `11.png`: lista, selector y «Controls» desplazados arriba-izquierda). Disparadores: `scrollIntoView` en `object-list.component.ts:251` (se ejecuta en cada selección, también en escritorio) y `focus()` sin `preventScroll` en `help-panel.component.ts:247`.
**Arreglo (D-419)**: (1) `overflow: hidden; overflow: clip;` en `.viewer-container` (cubre cualquier causa); (2) `focus({ preventScroll: true })` en el reabrir de la ayuda; (3) `revealActive` solo ajusta `scrollLeft` del `ul` cuando es la tira móvil (`overflow-x: auto`), sin `scrollIntoView`.
**Pruebas**: unitarias (jsdom): `scrollIntoView` **no** se llama al seleccionar en escritorio y `focus` se llama con `preventScroll`; script CDP `scripts/verify-viewer-scroll.mjs` (sin dependencias nuevas, Edge/Chrome headless) a 1813×834, 1280×800 y 125 % que tras cada paso (seleccionar cada pieza, «Got it» → «Controls», Tab a un chip, foco en el canvas, flechas y Home) comprueba `.viewer-container.scrollLeft/scrollTop === 0`, `scrollWidth ≤ clientWidth` y `document.scrollingElement.scrollTop === 0`. El icono oscuro del borde derecho: ver «Estado de partida» (no es nuestro).

- **FR-430**: `overflow: clip` con `hidden` de respaldo; `preventScroll` en el reabrir; sin `scrollIntoView` sobre el árbol; tests y script de arriba.

## F. Presupuestos y criterios

### F.1 Pesos y costes

| Concepto                                  | Cifra                                                                                                                                                                                                      | Método                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Assets nuevos (9 glTF 512 px + 4 láminas) | **≈ 2,10 MiB** (2 199 322 B listados: 1 971 323 B de glTF medidos + 228 000 B de láminas estimados)                                                                                                        | §A.4                                                |
| `src/assets` previsto                     | 4 044 814 + 2 199 322 = **6 244 136 B (5,95 MiB)**                                                                                                                                                         | suma; cota superior sin `meshopt` ni texturas 256   |
| **Nuevo tope propuesto**                  | **6,5 MiB (6 815 744 B)**; objetivo ≤ 6,0 MiB (6 291 456 B). La constitución IV fija ≤ 8 MB en la primera visita: se cumple con holgura (≈ 6,3 MB)                                                         | razonado: hoy 3,86 MiB, tope anterior 5 MiB         |
| Recortes si Paco quiere bajar             | sillón del salón de TV → clon del sillón de lectura (−0,33 MiB); aparador `vintage_wooden_drawer_01` → procedural (−0,30); armario (−0,11); texturas 256 en piezas secundarias (≈ −0,3, a medir)           | medido por pieza                                    |
| Tris nuevos                               | **≈ 49 000** en total; en la vista girada 180° ≈ 30 000 (estimado por frustum)                                                                                                                             | tabla A.2                                           |
| Mallas / draw calls nuevos (estimación)   | ≈ 56 en total (≈ 17 glTF, ≈ 16 procedurales fusionados por zona, ≈ 14 partes animadas, ≈ 9 láminas/cornisa/alfombras); **≈ 2–4 en la vista inicial** (cornisa y láminas fusionadas); ≈ 35 en la vista 180° | cuenta por material y zona                          |
| VRAM de texturas nuevas                   | ≈ 27 MiB (calculado: 3 modelos a 512 y 6 a 256 ≈ 19 MiB + 4 láminas 512×717 ≈ 8 MiB), **no medido**                                                                                                        | dimensiones × 4 B × 1,33                            |
| Bundle inicial                            | **+4–5 kB brutos** de código común nuevo (registro de ids, panel de acciones, lista agrupada, encuadre de pared) compensados por la «dieta» `@defer` (−6…9 kB, estimado) → **≤ 890 kB** (D-413)            | estimación; se mide con `stats.json` en T-400/T-492 |
| Chunks perezosos nuevos                   | `pieces` (config + builders + acciones) ≈ 35–60 kB · `audio` ≈ 2 kB · `pieces.en` ≈ 12 kB · `pieces.es` ≈ 13 kB                                                                                            | estimación                                          |

### F.2 Criterios medibles

- **SC-400 (vista inicial intacta)**: capturas 1280×800, 1813×834 y 390×844 de la vista inicial antes/después con ayuda cerrada: diferencia media de luma ≤ 1,5/255 **fuera** de la banda de 40 px bajo la línea del techo (donde cambia la cornisa); 0 piezas nuevas en los frustums (test con `Frustum.intersectsBox`).
- **SC-401 (inventario)**: `PIECES.length === 35` en 6 grupos; cada id tiene nombre y descripción EN y ES (paridad de claves), nombre ≤ 28 car., descripción ≤ 220 car.
- **SC-402 (acciones)**: tests de máquina de estados de TV (`off→on(0)→next→…→off`, `TICK` solo encendida y sin reducir movimiento), monitor, 3 lámparas (emisivo y halo 0 ↔ máximo) y tocadiscos (`SOUND_ON` sin giro no hace nada; `SPIN_OFF` fuerza `muted`; ningún `AudioContext` antes de «Sonido»); estado inicial: solo la lámpara de pie encendida.
- **SC-403 (accesibilidad)**: Lighthouse accesibilidad **100** en móvil y escritorio, **EN y ES**, con una ficha con acciones abierta; contraste AA medido (botón activo `#f6efe4` sobre `#35544f` = 7,3:1; etiqueta «ON» `#35544f` sobre `#fbf6ec` ≥ 4,5:1); recorrido solo con teclado (lista → Intro → ficha → Espacio) y con `prefers-reduced-motion`; `aria-live` anuncia cada cambio.
- **SC-404 (bundle)**: build de producción: **inicial ≤ 890 kB** (sin aviso, sin subir `angular.json`) y ≤ 220 kB transferidos; chunks perezosos listados aparte; si la medición final supera 890 kB tras la dieta, se justifica con la cifra en el commit y el aviso pasa a 900/error 910 (D-413).
- **SC-405 (assets)**: `du -sb src/assets` ≤ 6 815 744 B (tope), objetivo ≤ 6 291 456 B; cada textura ≤ 512 px (láminas 512×717), sin PNG/JPG en `src/assets`; primera visita ≤ 8 MB transferidos.
- **SC-406 (fluidez)**: mediana de frame **< 16,7 ms con CPU ×4 en 390×844** (método 002/003: 300 frames, `--uncapped --prod`, mediana de 10 pares ABAB) en **dos vistas**: **A** inicial y **B** cámara (0; 1,7; 4,5) con objetivo (0; 1,36; 7,5); ≥ 55 fps en escritorio; `ApplicationRef.tick` en reposo 0. Línea base de ambas vistas **antes** de cambiar nada (T-400).
- **SC-407 (coste de dibujo)**: con `window.__rtad.stats()` (dev): tris nuevos ≤ 60 000 totales y ≤ 35 000 en la vista B; draw calls nuevos ≤ +60 totales, ≤ +5 en la vista A y ≤ +40 en la B; **0 luces nuevas**; casters nuevos ≤ 6; texturas nuevas ≤ 36 y ≤ 30 MiB estimados.
- **SC-408 (cámara)**: para cada pared (y a 1,6:1, 1,33:1 y 0,46:1) las esquinas del tramo con margen de 0,4 m caen dentro del frustum de la pose, la cámara está dentro de la sala (±7,5 m) y `d ≤ 9`; el techo queda con pitch ≤ 30°; con `zoomToCursor` el objetivo nunca sale de la sala y la distancia a cualquier pared es ≥ 0,5 m.
- **SC-409 (selección)**: tests de prioridad pieza > pared > suelo, con ratón y con tolerancia táctil; clic en pared encuadra y no cierra la ficha; clic en suelo y alfombra teletransporta; las 35 piezas son alcanzables por clic (test sobre los proxies).
- **SC-410 (lista)**: 6 grupos con contador; un grupo abierto; búsqueda sin distinguir acentos (EN y ES); en 390 px dos tiras sin tapar «Controls» ni el selector (captura); `lint:check` sin avisos.
- **SC-411 (visor)**: tras cada paso del guion de §E, `scrollLeft = scrollTop = 0` en 1813×834, 1280×800 y 125 %.
- **SC-412 (colocación)**: tests con `Box3`: ninguna pieza interseca otra, un mueble o una pared; pasillos ≥ 0,9 m entre piezas nuevas; láminas/espejo/puerta/TV a 0,02–0,06 m de la pared; centros de láminas y espejo en 1,60 ± 0,02 (TV 1,40); el script de conos da 0 coincidencias.
- **SC-413 (textos)**: paridad EN/ES de todas las claves nuevas; sin cadenas fijas en plantillas; el cambio EN↔ES con una ficha abierta traduce nombre, descripción, acciones y estado sin recargar.
- **SC-414 (capturas)**: EN y ES, 1280×800 y 390×844: vista inicial, vista B, las 4 paredes y el techo encuadrados, TV encendida, escritorio con lámpara y monitor, rincón de lectura con lámpara, tocadiscos girando, lista agrupada y ficha de pared (`docs/baseline/004-*`).
- **SC-415 (repo verde)**: `npm run lint:check && npm run build && npm test` en verde en cada integración; el nº de casos de Vitest no baja.

## Decisiones (todas con recomendación aplicada; alternativa en `plan.md` §7)

D-400 llenar por zonas con alfombras sin acercar paredes · D-401 9 glTF Poly Haven a 512/256 px + procedurales de calidad · D-402 TV en modo arte con las láminas · D-403 escritorio procedural de roble con monitor y flexo como piezas aparte · D-404 tocadiscos con plato y sonido generado, silenciado por defecto · D-405 rincón de lectura con lámpara de lectura y lámpara de pie conmutables · D-406 clic en la pieza activa la acción; lista y teclado solo seleccionan · D-407 luces sin `PointLight` nuevas (emisivo + halo + charco) · D-408 proxies de raycast por pieza · D-409 paredes y techo seleccionables con encuadre por tramos · D-410 zoom hacia el cursor, 0,8–12 m · D-411 lista en acordeón + búsqueda (escritorio) y pestañas (móvil) · D-412 textos de piezas en diccionarios perezosos · D-413 dieta del inicial con `@defer`; presupuestos intactos salvo medición · D-414 tope de assets 6,5 MiB, carga tras la pantalla de carga · D-415 sombras estáticas, merge por material y zona, 0 luces nuevas, gate de frame en dos vistas · D-416 cornisa + 1 colgante fuera de la vista inicial · D-417 ficus procedural con puerta de calidad · D-418 alfombras nuevas no seleccionables · D-419 fix del visor (`overflow: clip`, `preventScroll`, `revealActive` acotado) · D-420 4 láminas nuevas de dominio público · D-421 puerta decorativa.
Preguntas que solo Paco puede responder: `plan.md` §8.
