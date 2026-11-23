# Quickstart: levantar y verificar en local

Requisitos: Node ≥ 22.12, npm ≥ 10.

```bash
npm ci
npm run lint:check   # eslint + prettier (debe pasar en Windows y Linux)
npm run build        # producción, sin errores TS
npm test             # runner headless
npm start            # http://localhost:4200
```

Verificación manual rápida (SC-007): la sala carga con barra de progreso; clic en el suelo mueve la cámara;
clic en un mueble muestra contorno + panel; `Esc` lo cierra; flechas giran; `Home` vuelve al inicio;
en emulación 390×844 la ayuda no tapa más del 40 % y el toque corto selecciona.
Comparar capturas con `docs/baseline/`.
