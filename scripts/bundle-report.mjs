// Desglose del bundle inicial a partir del metafile de esbuild (`ng build --stats-json`).
// Uso: node scripts/bundle-report.mjs [carpeta-de-salida] [--top 20] [--json]
//   carpeta-de-salida: la que contiene stats.json y browser/ (por defecto dist/interior-viewer).
// Sin dependencias. Lo inicial = ficheros que index.html carga + sus imports estáticos
// (los imports dinámicos son perezosos). La suma se contrasta con los ficheros reales de browser/.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const TOP = Number(flag('top', 20));
const AS_JSON = flag('json', false) === true;
const positional = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--'));
const dir = resolve(positional[0] ?? 'dist/interior-viewer');

const statsPath = join(dir, 'stats.json');
if (!existsSync(statsPath)) {
  console.error(`No existe ${statsPath}. Genera el metafile con: npx ng build --stats-json`);
  process.exit(2);
}
const meta = JSON.parse(readFileSync(statsPath, 'utf8'));
const outputs = meta.outputs;

// 1) Ficheros que referencia index.html (script, modulepreload y hojas de estilo).
const html = readFileSync(join(dir, 'browser', 'index.html'), 'utf8');
const roots = new Set();
for (const m of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) roots.add(m[1].replace(/^\.?\//, ''));

// 2) Cierre por imports estáticos (los `dynamic-import` quedan fuera).
const initial = new Set();
const visit = (name) => {
  if (initial.has(name) || !outputs[name]) return;
  initial.add(name);
  for (const imp of outputs[name].imports ?? []) if (imp.kind === 'import-statement') visit(imp.path);
};
roots.forEach(visit);

const kB = (b) => (b / 1000).toFixed(2);
const files = [...initial].map((name) => {
  const real = join(dir, 'browser', name);
  return { name, metaBytes: outputs[name].bytes, realBytes: existsSync(real) ? statSync(real).size : null };
});
const sumMeta = files.reduce((s, f) => s + f.metaBytes, 0);
const sumReal = files.reduce((s, f) => s + (f.realBytes ?? 0), 0);

// 3) Bytes por módulo de entrada en los ficheros iniciales (agregado por paquete o carpeta de la app).
const modules = new Map();
for (const name of initial) {
  for (const [path, info] of Object.entries(outputs[name].inputs ?? {})) {
    modules.set(path, (modules.get(path) ?? 0) + info.bytesInOutput);
  }
}
const group = (path) => {
  const m = path.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  return m ? m[1] : path.startsWith('src/') ? path.split('/').slice(0, 3).join('/') : path;
};
const groups = new Map();
for (const [path, bytes] of modules) groups.set(group(path), (groups.get(group(path)) ?? 0) + bytes);
const sortedModules = [...modules].sort((a, b) => b[1] - a[1]);
const sortedGroups = [...groups].sort((a, b) => b[1] - a[1]);
const attributed = [...modules.values()].reduce((s, b) => s + b, 0);

const lazy = Object.entries(outputs)
  .filter(([n]) => !initial.has(n) && /\.(js)$/.test(n))
  .map(([n, o]) => ({ name: n, entry: o.entryPoint ?? '', bytes: o.bytes }));

if (AS_JSON) {
  console.log(
    JSON.stringify({ dir, initialFiles: files, initialBytesMeta: sumMeta, initialBytesReal: sumReal, groups: sortedGroups.slice(0, TOP), modules: sortedModules.slice(0, TOP), lazy }, null, 2),
  );
} else {
  console.log(`Bundle inicial de ${dir}\n`);
  console.log('Ficheros iniciales (metafile vs. disco):');
  for (const f of files.sort((a, b) => b.metaBytes - a.metaBytes)) {
    console.log(`  ${f.name.padEnd(34)} ${kB(f.metaBytes).padStart(8)} kB  ${f.realBytes === null ? '   (no está en disco)' : `${kB(f.realBytes).padStart(8)} kB`}`);
  }
  console.log(`  ${'SUMA'.padEnd(34)} ${kB(sumMeta).padStart(8)} kB  ${kB(sumReal).padStart(8)} kB   Δ = ${((sumMeta - sumReal) / 1000).toFixed(3)} kB`);
  console.log(`\nTop ${TOP} módulos por bytes en el inicial (${kB(attributed)} kB atribuidos de ${kB(sumMeta)} kB; el resto es código del bundler/sin origen):`);
  sortedModules.slice(0, TOP).forEach(([p, b], i) => console.log(`  ${String(i + 1).padStart(2)}. ${kB(b).padStart(8)} kB  ${p}`));
  console.log(`\nTop ${Math.min(TOP, 10)} paquetes/carpetas:`);
  sortedGroups.slice(0, Math.min(TOP, 10)).forEach(([p, b]) => console.log(`  ${kB(b).padStart(8)} kB  ${p}`));
  console.log('\nChunks perezosos (fuera del inicial):');
  lazy.sort((a, b) => b.bytes - a.bytes).forEach((l) => console.log(`  ${l.name.padEnd(24)} ${kB(l.bytes).padStart(8)} kB  ${l.entry}`));
}
if (Math.abs(sumMeta - sumReal) > 1000) {
  console.error(`AVISO: la suma del metafile (${kB(sumMeta)} kB) difiere de dist (${kB(sumReal)} kB) en más de 1 kB.`);
  process.exit(1);
}
