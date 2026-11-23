# Verificación final 002 (T-295)

Medida el **2026-11-23** sobre `orq/11221609-verif-f4` (HEAD `8ca58a5`, F0–F3 integradas) frente a `baseline.md` (commit `7b1c78c`).
Sin cambios de código ni de assets en esta tarea. Mismo equipo y navegador que la línea base: Ryzen 7 5700X, RTX 4060, Chrome 157.0.8103.79
`--headless=new --use-angle=d3d11` (GPU real, `ANGLE (NVIDIA … Direct3D11)`), perfil nuevo por página, 1280×800 DPR 1 y 390×844 móvil emulado (CDP).

Scripts (fuera del repo, `C:\Users\paco_\.config\orquestacion\runs\11221609\scripts-r2\`): `baseline-capture.mjs` (ahora con `--prod`), `static-server.mjs`,
`f4-manual.mjs` (capturas extra, prueba manual, reduced-motion), `contrast-b7.mjs`, `gltf-tris.mjs`. JSON de las medidas en `scripts-r2\f4\`.

## Resumen

| Criterio                                                      | Resultado                                                                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| (1) `lint:check && build && test`, sin avisos nuevos (SC-216) | ✓                                                                                                                      |
| (2) Peso de assets (SC-200)                                   | ✓ 3 720 960 B ≤ 4 MiB                                                                                                  |
| (3) Coste de dibujo (SC-202, reinterpretado)                  | ✓ en sus cifras (+14 006 tris, +19 calls) — **condicionado a SC-204, que falla**                                       |
| (4) Frame time (SC-204)                                       | **✗** sin límite: ×1,29 escritorio, ×1,32 móvil (con vsync: ×1,00)                                                     |
| (5) Transferencia inicial y CLS (SC-206, SC-212)              | ✓                                                                                                                      |
| (6) Lighthouse accesibilidad 100 / rendimiento (SC-211)       | ✓ accesibilidad 100 (con **nota**: 1 auditoría de peso 0 falla en escritorio) · **✗** rendimiento escritorio −9 puntos |
| (7) Contraste B.7 (SC-211)                                    | ✓ 12/12                                                                                                                |
| (8) Capturas (SC-213)                                         | ✓                                                                                                                      |
| (9) `rg` de SC-210                                            | ✓ 0 resultados                                                                                                         |
| (10) `prefers-reduced-motion` (SC-215)                        | ✓                                                                                                                      |
| (11) Prueba manual                                            | ✓ (con 2 observaciones)                                                                                                |
| `npm ci` limpio, `npm audit --omit=dev`, bundle ≤ 900 kB      | ✓                                                                                                                      |

**Devoluciones a la pista dueña** (resumen; detalle en cada punto): ✗-A SC-204 (frame time sin límite, escritorio y móvil); ✗-B rendimiento Lighthouse
escritorio −9 puntos (TBT 700 → 1 100 ms, LCP 3,2 → 4,1 s, correlato de lo mismo); ✗-C `label-content-name-mismatch` en el botón «Reset view» (escritorio).

## 1. Repo verde (SC-216)

| Comando                | Resultado                                                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci` (limpio)      | ✓ `added 754 packages`; sin errores                                                                                                                                                                |
| `npm run lint:check`   | ✓ ESLint, Prettier y «All lint checks passed»                                                                                                                                                      |
| `npm run build`        | ✓ sin avisos de presupuesto ni de otro tipo. `main-F5TAA4U5.js` 870,75 kB bruto / 194,36 kB transferido; `styles-LDAC2FFH.css` 2,05 kB / 819 B; **Initial total 872,80 kB / 195,18 kB** (≤ 900 kB) |
| `npm test`             | ✓ 16 ficheros, **183 tests** pasados                                                                                                                                                               |
| `npm audit --omit=dev` | ✓ `found 0 vulnerabilities`                                                                                                                                                                        |

## 2. Peso de assets (SC-200)

`du -sb src/assets` → **3 720 960 B** (3,55 MiB) ≤ 4 194 304 B (objetivo) y ≤ 5 242 880 B (tope). Base: 2 624 958 B. Delta +1 096 002 B.

| Pieza / carpeta                                           | Bytes                         | Valor de la tabla de spec     | Cumple (≤ +25 %) |
| --------------------------------------------------------- | ----------------------------- | ----------------------------- | ---------------- |
| `models/landscape_painting` (cuadro)                      | 175 970                       | 175 970                       | ✓                |
| `models/wall_clock` (reloj)                               | 124 334                       | 124 334                       | ✓                |
| `models/succulent`                                        | 203 975                       | 203 975                       | ✓                |
| `models/ceramic_vase` (jarrón)                            | 101 040                       | 101 040                       | ✓                |
| `textures/floor` (suelo)                                  | 288 786                       | 288 786                       | ✓                |
| `textures/rug` (alfombra)                                 | 112 076                       | 112 076                       | ✓                |
| `fonts`                                                   | 106 659                       | ≈ 99,6 KB de woff2 + licencia | ✓                |
| `brand` (antes 130 176)                                   | 113 338                       | —                             | ✓ (baja)         |
| `models/sofa` / `poker_table` / `bookshelf` (sin cambios) | 1 525 000 / 837 640 / 132 142 | iguales a la base             | ✓                |

Ninguna textura nueva > 1024 px. Las tres texturas de `poker_table` (2048 px) y `brand/og.png` (1200×630) son anteriores y no son piezas de esta spec.
Transferencia total de la primera visita (Lighthouse, sin compresión): 4 385 KiB ≈ 4,49 MB ≤ 5 MB ✓ (base 3 284 KiB).

## 3. Coste de dibujo (SC-202, criterio reinterpretado y aprobado por el principal)

Comando: build de **desarrollo** servida (`ng build --configuration development`; `window.__rtad` solo existe en dev), `baseline-capture.mjs`, ayuda cerrada, +≈3,7 s de asentamiento.
La base (commit `7b1c78c`, compilada en carpeta temporal) reproduce exactamente la línea base: 149 / 1 118 814.

| Vista               | draw calls base → final | Δ calls | triángulos `renderer.info` base → final | texturas | geometrías |
| ------------------- | ----------------------- | ------- | --------------------------------------- | -------- | ---------- |
| Escritorio 1280×800 | 149 → **168**           | **+19** | 1 118 814 → 1 156 714 (+37 900)         | 20 → 41  | 45 → 53    |
| Móvil 390×844       | 147 → **161**           | **+14** | 1 118 810 → 1 148 866 (+30 056)         | 20 → 37  | 44 → 50    |

**Criterio nuevo**:

- Geometría añadida (suma de las piezas nuevas, `gltf-transform` ya aplicado, `node scripts-r2\gltf-tris.mjs src/assets/models`): cuadro 938 + reloj 3 658 + suculenta 6 578 + jarrón 2 782 = 13 956; zócalo (4 cajas fusionadas × 12) 48; alfombra 2 → **14 006 triángulos ≤ 16 000 ✓**.
- Draw calls de la vista inicial: **+19 ≤ +20 ✓** (escritorio; móvil +14). Con el criterio original (+14) el escritorio sería ✗ por 5 (el criterio ya está reinterpretado).
- Desglose de calls (estimado, no hay instrumentación por pieza): mallas nuevas tras fusionar por material = cuadro 2, reloj 2, suculenta 1, jarrón 1, alfombra 1, zócalo 1 = 8 mallas, cada una contada dos veces en `renderer.info` (igual que en la base) = 16, más 2–3 del pase de sombras de suculenta y jarrón = 18–19 (observado 19).
- El Δ de `renderer.info` en triángulos (+37 900) es mayor que la geometría real porque cuenta cada malla opaca varias veces y la suculenta/jarrón también en el pase de sombras (≈ 2× + 1× las que proyectan sombra ≈ 37 400); por eso el criterio pasa a la geometría añadida.

**Condición de SC-204: no se cumple (punto 4), así que la reinterpretación de SC-202 queda en suspenso hasta resolver el frame time.**
Nota añadida a `spec.md` (SC-202) con fecha 2026-11-23 y «aprobada por el principal».

## 4. Frame time (SC-204) — ✗

Método: 300 fotogramas `requestAnimationFrame` en la vista inicial (ayuda cerrada), móvil con CPU ×4, **5 ejecuciones alternadas** base/final/base/final…, mediana de medianas.
Base = `git archive 7b1c78c` + `npm ci` + `npm run build` en una carpeta temporal (misma salida que la línea base: `main-KTSW3TGH.js` 859,75 kB), servida en 4301; final = `dist/` de este worktree en 4302; **ambas builds de producción** (el script usa `--prod`).
Resolución del temporizador de `performance.now()` en headless: 0,1 ms.

**Sin límite** (`--uncapped`: `--disable-gpu-vsync --disable-frame-rate-limit`):

|                     | Medianas de las 5 ejecuciones (ms)     | Mediana de medianas | final/base                 |
| ------------------- | -------------------------------------- | ------------------- | -------------------------- |
| Escritorio, base    | 0,5 · 0,5 · 0,7 · 0,8 · 0,7            | **0,70**            |                            |
| Escritorio, final   | 0,8 · 1,2 · 1,0 · 0,9 · 0,7            | **0,90**            | **×1,29 ✗** (límite ×1,10) |
| Móvil CPU ×4, base  | 4,4 · 5,3 · 6,1 · 5,9 · 5,9            | **5,90**            |                            |
| Móvil CPU ×4, final | 7,8 · 40,1 (atípica) · 6,0 · 7,1 · 8,0 | **7,80**            | **×1,32 ✗** (límite ×1,10) |

Sin la ejecución atípica (40,1) la mediana final móvil sería 7,45 (×1,26): sigue ✗. En absoluto, +0,2 ms en escritorio y +1,9 ms en móvil.

**Con vsync** (sin `--uncapped`, 5 pares alternados, `scripts-r2\f4\capped\`): escritorio base y final 6,1 ms en las 5 ejecuciones (**×1,00**); móvil 6,1 vs 6,1 (×1,00; p95 12,2 ms en ambos).
Es decir: a la cadencia del monitor (≈165 Hz) no hay pérdida (≥ 55 fps de SC-004/SC-204 de sobra), pero el coste por fotograma sin tope sube un 29–32 %.

Veredicto: **✗** por el criterio literal (mediana ≤ base × 1,10 en escritorio y móvil). No se ha arreglado nada: se devuelve con cifras para que el orquestador aplique el plan aprobado
(quitar sombras de suculenta/jarrón y volver a medir; si aún falla, simplificar la suculenta).
Referencia de contexto: el aumento coincide con +19 draw calls (+13 %) y +21 texturas; la CPU de envío de comandos domina en estas medidas sin límite.

## 5. Transferencia inicial y CLS (SC-206, SC-212) — ✓

|                                                    | Base      | Final         | Límite                                                                                 |
| -------------------------------------------------- | --------- | ------------- | -------------------------------------------------------------------------------------- |
| JS inicial bruto                                   | 860,50 kB | **872,80 kB** | ≤ 900 kB ✓                                                                             |
| JS inicial transferido (estimado de `ng build`)    | 192,80 kB | **195,18 kB** | ≤ 192,8 kB sugerido en `baseline.md` (+2,4 kB, +1,2 %; el límite duro es 900 kB bruto) |
| CLS Lighthouse móvil / escritorio                  | 0 / 0,001 | **0 / 0,002** | ≤ 0,02 ✓                                                                               |
| Peso total de red (primera visita, sin compresión) | 3 284 KiB | 4 385 KiB     | ≤ 5 MB ✓                                                                               |

El progreso monótono hasta 100 % con las texturas incluidas no se ha medido en esta pasada (no figura en T-295); la captura de carga muestra el porcentaje y la barra.

## 6. Lighthouse (SC-211) — accesibilidad ✓ con nota, rendimiento ✗ en escritorio

Comando (build de producción servida por `static-server.mjs`, Lighthouse 12.8.2, mismo Chrome):
`npx -y lighthouse http://127.0.0.1:4302/ [--preset=desktop] --only-categories=performance,accessibility --output=json --chrome-flags="--headless=new --use-angle=d3d11 --enable-unsafe-swiftshader --ignore-gpu-blocklist"` (base en 4301 con las mismas opciones).

|                   | Móvil base → final | Escritorio base → final                            |
| ----------------- | ------------------ | -------------------------------------------------- |
| **Accesibilidad** | 100 → **100** ✓    | 100 → **100** ✓                                    |
| **Rendimiento**   | 32 → **31** (−1 ✓) | 52, 52, 52 → 43, 59, 42 (mediana **43**, **−9** ✗) |
| FCP               | 5,3 s → 5,3 s      | 0,9 s → 0,9 s                                      |
| LCP               | 18,9 s → 8,0 s     | 3,2 s → 4,1 s (1,5 / 4,2 en las otras ejecuciones) |
| TBT               | 3 110 → 4 290 ms   | 700 → 1 100 ms (1 180 / 1 160)                     |
| CLS               | 0 → 0              | 0,001 → 0,002                                      |
| Speed Index       | 5,7 → 6,3 s        | 1,9 → 2,6 s                                        |

(`baseline.md` anotaba 31 / 46 con otra ejecución; aquí la base se re-midió en el mismo momento: 32 / 52.)

- ✗-B Rendimiento escritorio: caída de 9 puntos frente a la base re-medida (3 ejecuciones alternadas; la ejecución 59 es un LCP anómalo de 1,5 s). Causa visible: TBT +400 ms (decodificar 21 texturas más y construir las piezas). Móvil dentro de margen.
- ✗-C **Auditoría que falla en escritorio** aunque la categoría marque 100: `label-content-name-mismatch` («Elements with visible text labels do not have matching accessible names», peso 0 en la puntuación, WCAG 2.5.3 Label in Name).
  Elemento: `<button type="button" class="chip reset" aria-label="Return to the initial view">` cuyo texto visible es «Reset view» (`UI_TEXT.resetViewLabel` vs `UI_TEXT.resetView`, `object-list.component.ts`).
  En móvil el texto está oculto y no se audita. Corrección sugerida a la pista dueña (U/CB): que el `aria-label` empiece por el texto visible (p. ej. «Reset view to the initial position») o quitar el `aria-label` en escritorio.

## 7. Contraste B.7 (SC-211) — ✓ 12/12

Comando: `node C:\Users\paco_\.config\orquestacion\runs\11221609\scripts-r2\contrast-b7.mjs src/styles.scss` (lee los tokens reales y aplica la fórmula WCAG 2.x).

| Primer plano          | Fondo                | Ratio medido | Spec  | Umbral           |     |
| --------------------- | -------------------- | ------------ | ----- | ---------------- | --- |
| ink `#2a2420`         | paper `#f6efe4`      | 13,40        | 13,40 | 4,5              | ✓   |
| ink                   | paper-sunk `#ece2d1` | 11,93        | 11,93 | 4,5              | ✓   |
| ink-muted `#5c5046`   | paper                | 6,83         | 6,83  | 4,5              | ✓   |
| ink-muted             | paper-sunk           | 6,08         | 6,08  | 4,5              | ✓   |
| paper                 | clay `#8a4426`       | 6,26         | 6,26  | 4,5              | ✓   |
| clay                  | paper                | 6,26         | 6,26  | 4,5              | ✓   |
| clay                  | paper-sunk           | 5,58         | 5,58  | 4,5              | ✓   |
| paper                 | clay-hover `#733820` | 7,94         | ≥ 7,5 | 4,5              | ✓   |
| teal `#35544f`        | paper                | 7,26         | 7,26  | 3                | ✓   |
| paper                 | danger `#7a2a1c`     | 8,45         | 8,45  | 4,5              | ✓   |
| rule-strong `#8c7d6e` | paper                | 3,49         | 3,49  | 3                | ✓   |
| rule `#d8cab6`        | paper                | 1,41         | 1,41  | n/a (decorativo) | ✓   |

## 8. Capturas (SC-213) — ✓

En `docs/baseline/002-final-*` (comando: `baseline-capture.mjs --url http://127.0.0.1:4302/ --out docs/baseline --prefix 002-final --prod` y `f4-manual.mjs --mode shots`):

|                                                      | Escritorio 1280×800               | Móvil 390×844                    |
| ---------------------------------------------------- | --------------------------------- | -------------------------------- |
| Carga                                                | `002-final-desktop-loading.png`   | `002-final-mobile-loading.png`   |
| Vista inicial                                        | `002-final-desktop-initial.png`   | `002-final-mobile-initial.png`   |
| Ayuda                                                | `002-final-desktop-help.png`      | `002-final-mobile-help.png`      |
| Ficha del sofá                                       | `002-final-desktop-sofa.png`      | `002-final-mobile-sofa.png`      |
| Ficha del cuadro (enfoque frontal al muro del fondo) | `002-final-desktop-painting.png`  | `002-final-mobile-painting.png`  |
| Ficha de la suculenta                                | `002-final-desktop-succulent.png` | `002-final-mobile-succulent.png` |

El muro del fondo se ve en la vista inicial y, de frente, en la captura del cuadro. Comprobado a ojo: ningún panel solapa el elemento enfocado. Altura de la ficha móvil: cuadro 211 px (**25 %**), suculenta 188 px (22 %), sofá ≈ 190 px (≈ 23 %) ≤ 34 % ✓.
Escritorio: ficha del cuadro 224 px, de la suculenta 201 px.
Peso: varias PNG superan los 300 kB de la base (hasta 746 kB la de la suculenta) por tener ahora texturas y madera; no son parte del bundle.
Observación menor: en `002-final-desktop-painting.png` el marco se ve ligeramente trapezoidal (cámara no exactamente de frente), solo estética.

## 9. `rg` de SC-210 — ✓

| Comando                                                             | Salida       |
| ------------------------------------------------------------------- | ------------ |
| `rg "backdrop-filter\|999px\|linear-gradient\|radial-gradient" src` | 0 resultados |
| `rg "#[0-9a-fA-F]{3,8}\b\|rgb\(" src/app/components`                | 0 resultados |

## 10. `prefers-reduced-motion` (SC-215) — ✓

CDP `Emulation.setEmulatedMedia {prefers-reduced-motion: reduce}` (`matchMedia` = true); recorrido de todos los elementos con `getComputedStyle`: tras la carga y con ayuda y ficha abiertas, **0 elementos** con `transition-duration` o `animation-duration` > 0 (`f4\manual\f4-manual-log.json`).

## 11. Prueba manual (Chrome automatizado, escritorio 1280×800, build de producción) — ✓

| Acción                                              | Resultado                                                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clic en la alfombra (400, 600)                      | La cámara se desplaza (captura `002-final-desktop-manual-click-rug.png`); ninguna ficha, ninguna pieza marcada ✓                                                               |
| Clic en el reloj (841, 352)                         | Sin ficha ni selección; captura byte a byte idéntica a la inicial ✓ (no selecciona)                                                                                            |
| Clic en el jarrón (544, 420)                        | Sin ficha ni selección; captura idéntica a la inicial ✓ (no selecciona)                                                                                                        |
| Clic en el cuadro (438, 354)                        | Ficha «Landscape painting» con línea de crédito CC0; chip `aria-pressed=true` ✓                                                                                                |
| Clic en la suculenta (736, 430)                     | Ficha «Potted succulent» con crédito; chip pulsado ✓                                                                                                                           |
| `Esc` con la ficha del cuadro abierta               | Ficha cerrada y ningún chip pulsado ✓                                                                                                                                          |
| `Home` (foco en el canvas) con el sofá seleccionado | La cámara vuelve a la vista inicial; **la ficha del sofá sigue abierta** (comportamiento heredado de 001: `resetView()` no llama a `clearSelection()`); no es regresión de 002 |
| Tab por la lista                                    | Orden: Bookshelf → Landscape painting → Poker table → Potted succulent → Sectional sofa → «Reset view» → canvas → «Close details»; `nav.list` tiene exactamente **5** piezas ✓ |
| `Enter` sobre el primer chip                        | Selecciona «Bookshelf» (ficha + chip pulsado) ✓                                                                                                                                |

Observación (no es ✗ de esta spec): el `aria-label` del botón de reinicio no contiene el texto visible (ver ✗-C).

## Qué queda por devolver

1. **✗-A (pista E/escena, SC-204)**: frame time sin límite ×1,29 (escritorio) y ×1,32 (móvil). Plan aprobado: quitar sombras de suculenta/jarrón y re-medir; si no basta, simplificar la suculenta. La re-medida usa el mismo método (`scripts-r2\f4\`, 5 pares alternados `--uncapped --prod`).
2. **✗-B (SC-211, rendimiento escritorio)**: −9 puntos de Lighthouse (43 vs 52); probablemente se corrige con lo mismo que ✗-A.
3. **✗-C (pista U/CB)**: `label-content-name-mismatch` en `.chip.reset` de escritorio.

Hasta que ✗-A se resuelva, SC-202 reinterpretado (cifras ✓) queda condicionado y no se debe dar por cerrado.
