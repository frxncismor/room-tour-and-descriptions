# Línea base 004 (T-400)

Medida el **2026-11-24** sobre `352056d` (base de la spec 004, `git archive` + `npm ci` + build de producción en una carpeta temporal fuera del repo, ya borrada), **intercalada ABAB con el final `ec4fbac`** (misma sesión, mismo equipo y mismo Chrome) para que la comparación no dependa de la carga de la máquina. Cuando se pidió la línea base «antes de cambiar nada» (F0) no se midió con ABAB; esta es la medida de referencia válida para SC-406/407 y sustituye a cualquier cifra suelta anterior. El detalle del final está en `verification.md`.

Equipo: Ryzen 7 5700X, RTX 4060, Chrome 158 `--headless=new --use-angle=d3d11` (GPU real), perfil nuevo por repetición, escritorio 1280×800 DPR 1 y móvil 390×844 emulado por CDP (touch, CPU ×4). **La máquina estaba compartida y cargada** (CPU media de la máquina durante la medida: base 71–81 %, final 39–56 %): las cifras de frame time son pesimistas y ruidosas.

Scripts (fuera del repo): `C:\Users\paco_\.config\orquestacion\runs\11221609\scripts-r4\` — `measure-f5.mjs` (frames, idle, stats), `abab-f5.mjs` (orquestador ABAB), `agg-f5.mjs` (tabla), `f5-initial-diff.mjs` (capturas y diferencia SC-400), `f5-capture.mjs` (SC-414); datos crudos en `scripts-r4\out\f5\{base,final}.jsonl`.

## Método

- 300 fotogramas `requestAnimationFrame`, `--uncapped` (sin límite de 60 Hz) y build de producción servida estática.
- Vista **A** = inicial (cámara de entrada, ayuda cerrada). Vista **B** = cámara (0; 1,7; 4,5), objetivo (0; 1,36; 7,5) (enganchando `OrbitControls` con un init-script).
- **Render bajo demanda (R8-I1)**: en reposo la escena no dibuja, así que para medir el coste por fotograma se fuerza el dibujo moviendo la cámara ±1e-4 por fotograma (`--force-render`); la base dibuja siempre, el final dibuja solo por esa causa. Los dibujos en reposo (3 s sin forzar) se anotan aparte.
- 1 repetición = un Chrome nuevo; ABAB: base, final, base, final… Las 4 primeras repeticiones de la base y las 3 primeras del final vienen de una tanda anterior interrumpida por un reinicio del equipo (la 4.ª del final quedó a medias y se descartó: `final.partial-rep4.discarded.jsonl`); se completó hasta **10 repeticiones de la base y 9 del final (9 pares)**; la 10.ª de la base no tiene pareja y se excluye de la comparación pareada.

## Frame time (mediana de las 9 medianas por ejecución; mín.–máx. entre paréntesis)

| Móvil ×4 / escritorio | Vista | Base (ms)         | Draws GL por fotograma | Dibujos en reposo (3 s) |
| --------------------- | ----- | ----------------- | ---------------------- | ----------------------- |
| móvil ×4              | A     | 15,90 (12,5–31,4) | 187,9                  | ≈ 31 000 (continuo)     |
| móvil ×4              | B     | 4,00 (2,5–9,5)    | 50,5                   | ≈ 31 000 (continuo)     |
| escritorio ×1         | A     | 2,10 (1,6–3,0)    | 201,0                  | ≈ 341 000 (continuo)    |
| escritorio ×1         | B     | 0,40 (0,4–0,6)    | 51,0                   | ≈ 352 000 (continuo)    |

(Con las 10 repeticiones de la base: móvil A 15,40 ms, móvil B 3,90 ms, escritorio A 2,05 ms, escritorio B 0,40 ms.)

## Coste de dibujo (`window.__rtad.stats()`, build de desarrollo, escritorio 1280×800)

| Vista | Draw calls | Triángulos | Texturas | Geometrías |
| ----- | ---------- | ---------- | -------- | ---------- |
| A     | 199        | 1 156 000  | 49       | 70         |
| B     | 50         | 374 032    | 49       | 70         |

(La base vuelve a dibujar la pasada de sombras en cada fotograma, por eso cuenta también sus triángulos.)

## Bundle y assets

| Medida                  | Base `352056d`         |
| ----------------------- | ---------------------- |
| Initial total (bruto)   | 886,95 kB              |
| Initial transferido     | 202,42 kB              |
| `src/assets` (`du -sb`) | 4 044 814 B (3,86 MiB) |
| Tests (Vitest)          | 374 en 24 ficheros     |

## Capturas de la base (T-400 d)

`docs/baseline/004-base-{1280x800,1813x834,390x844}-{inicial,vistaB}.png` (6 capturas, EN, ayuda cerrada).
