// Renders the static map images in public/map-snapshots/ — the backgrounds of
// the landing's map teaser and the menu's Mappa card (see MapSnapshot): one
// WebP per theme, drawn from the same MapLibre styles as /mappa
// (public/map-styles/, `pnpm map:styles`), so they look like the real map
// without loading it — no MapLibre chunk, no tiles, just an image.
//
// How: a throwaway local server hands a headless Chrome/Edge a page that
// draws each snapshot with MapLibre (from node_modules) and posts the canvas
// back as WebP. No extra dependencies; needs a Chromium-based browser
// installed — set CHROME_PATH if it isn't in the usual place.
//
// Re-run after changing the map styles:
//   pnpm map:snapshots
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public/map-snapshots');
const MAPLIBRE_JS = join(ROOT, 'node_modules/maplibre-gl/dist/maplibre-gl.js');

/** Same view as the old live previews: MILAN_CENTER at MILAN_DEFAULT_ZOOM
 * (core/config/map-pins.ts) — Leaflet zoom 14, i.e. 13 in MapLibre's 512px
 * tiles. [lng, lat], MapLibre's order. */
const CENTER = [9.19, 45.4642];
const ZOOM = 13;

/** CSS size of each image, drawn at 2x for sharp text on retina screens.
 * Both are shown with object-fit: cover, so they only need the right aspect
 * and enough pixels for the largest box they fill: the landing teaser is 4:5
 * on phones and square from sm: up (at most ~30rem wide), the menu card a
 * wide strip (max-w-4xl, 280px tall, taller on phones). */
const VARIANTS = [
  { variant: 'landing', width: 480, height: 600 },
  { variant: 'menu', width: 900, height: 340 },
];
const THEMES = ['dark', 'light'];
const PIXEL_RATIO = 2;
const WEBP_QUALITY = 0.8;
const TIMEOUT_MS = 120_000;

const snapshots = VARIANTS.flatMap((v) => THEMES.map((theme) => ({ ...v, theme, name: `${v.variant}-${theme}` })));

const page = `<!doctype html>
<html><head><meta charset="utf-8"><script src="/maplibre-gl.js"></script></head>
<body style="margin:0">
<script>
  const log = (message) => fetch('/log', { method: 'POST', body: String(message) });
  (async () => {
    for (const s of ${JSON.stringify(snapshots)}) {
      const container = document.createElement('div');
      container.style.cssText = 'position:relative;width:' + s.width + 'px;height:' + s.height + 'px';
      document.body.append(container);
      const map = new maplibregl.Map({
        container,
        style: '/map-styles/' + s.theme + '.json',
        center: ${JSON.stringify(CENTER)},
        zoom: ${ZOOM},
        pixelRatio: ${PIXEL_RATIO},
        interactive: false,
        attributionControl: false,
        // Labels fully drawn at 'idle', not caught mid fade-in.
        fadeDuration: 0,
        // So the canvas can still be read after MapLibre has presented it.
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
      map.on('error', (e) => log('map error (' + s.name + '): ' + (e.error?.message ?? e)));
      await new Promise((done) => map.once('idle', done));
      const blob = await new Promise((done) => map.getCanvas().toBlob(done, 'image/webp', ${WEBP_QUALITY}));
      await fetch('/save/' + s.name, { method: 'POST', body: blob });
      map.remove();
      container.remove();
    }
    await fetch('/done', { method: 'POST' });
  })().catch((err) => fetch('/fail', { method: 'POST', body: String(err?.stack ?? err) }));
</script>
</body></html>`;

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const found = candidates.find((path) => path && existsSync(path));
  if (!found) throw new Error('No Chrome/Edge found — set CHROME_PATH to a Chromium-based browser.');
  return found;
}

function readBody(req) {
  return new Promise((done) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => done(Buffer.concat(chunks)));
  });
}

mkdirSync(OUT_DIR, { recursive: true });
const profileDir = mkdtempSync(join(tmpdir(), 'map-snapshots-'));
let browser;
let timer;

function finish(code) {
  clearTimeout(timer);
  browser?.kill();
  server.close();
  // The browser may hold its profile open a moment after being killed.
  setTimeout(() => {
    try {
      rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // Left in the OS temp dir, which gets cleaned up anyway.
    }
    process.exit(code);
  }, 500);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname;

  if (req.method === 'GET' && route === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(page);
  } else if (req.method === 'GET' && route === '/maplibre-gl.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(readFileSync(MAPLIBRE_JS));
  } else if (req.method === 'GET' && /^\/map-styles\/(light|dark)\.json$/.test(route)) {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(readFileSync(join(ROOT, 'public', route)));
  } else if (req.method === 'POST' && route.startsWith('/save/')) {
    const name = route.slice('/save/'.length);
    if (!snapshots.some((s) => s.name === name)) return res.writeHead(400).end();
    const image = await readBody(req);
    writeFileSync(join(OUT_DIR, `${name}.webp`), image);
    console.log(`  ${name}.webp — ${(image.length / 1024).toFixed(0)} KB`);
    res.writeHead(204).end();
  } else if (req.method === 'POST' && route === '/log') {
    console.warn(`  ${await readBody(req)}`);
    res.writeHead(204).end();
  } else if (req.method === 'POST' && route === '/done') {
    res.writeHead(204).end();
    console.log(`Done: public/map-snapshots/`);
    finish(0);
  } else if (req.method === 'POST' && route === '/fail') {
    console.error(`Rendering failed:\n${await readBody(req)}`);
    res.writeHead(204).end();
    finish(1);
  } else {
    res.writeHead(404).end();
  }
});

server.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  console.log(`Rendering ${snapshots.length} map snapshots…`);
  browser = spawn(
    findBrowser(),
    [
      '--headless=new',
      // WebGL in headless mode, on the CPU: no GPU needed.
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profileDir}`,
      `http://127.0.0.1:${port}/`,
    ],
    { stdio: 'ignore' },
  );
  browser.on('error', (err) => {
    console.error(err);
    finish(1);
  });
  timer = setTimeout(() => {
    console.error(`Timed out after ${TIMEOUT_MS / 1000}s.`);
    finish(1);
  }, TIMEOUT_MS);
});
