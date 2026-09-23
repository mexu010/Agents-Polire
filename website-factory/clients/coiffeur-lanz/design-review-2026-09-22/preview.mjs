import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderConcept, renderGallery } from './views.mjs';

const root = dirname(fileURLToPath(import.meta.url));
export const evidenceRoot = resolve(root, '../../../work/lanz-design-2026-09-22/previews');
const assets = new Set(['coiffeur-lanz-logo.png', 'salon-stilllife.webp', 'salon-stilllife-small.webp', 'favicon.svg', 'fonts/satoshi-400.woff2', 'fonts/satoshi-500.woff2', 'fonts/satoshi-700.woff2']);
const styles = new Set(['base.css', 'a.css', 'b.css', 'c.css', 'compare.css']);
const types = { css: 'text/css; charset=utf-8', png: 'image/png', webp: 'image/webp', woff2: 'font/woff2', svg: 'image/svg+xml' };

export function startPreview(port = 4340) {
  const server = createServer(async (request, response) => {
    response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end('Nur lesende Vorschau.'); return; }
    try {
      const path = new URL(request.url, 'http://127.0.0.1').pathname;
      let body, type = 'text/html; charset=utf-8';
      if (path === '/') body = renderGallery();
      else if (/^\/[abc]\/$/.test(path)) body = renderConcept(path[1]);
      else if (path.startsWith('/assets/') && assets.has(path.slice(8))) {
        const file = path.slice(8); body = await readFile(join(root, '../public/assets', file)); type = types[file.split('.').at(-1)];
      } else if (path.startsWith('/review/') && styles.has(path.slice(8))) {
        body = await readFile(join(root, path.slice(8))); type = types.css;
      } else if (/^\/captures\/[abc]-(?:320|390|768|1440)\.png$/.test(path)) {
        body = await readFile(join(evidenceRoot, path.slice(10))); type = types.png;
      } else { response.writeHead(404); response.end('Diese Vorschau gibt es nicht.'); return; }
      response.writeHead(200, { 'Content-Type': type });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(404); response.end('Datei nicht verfügbar.'); }
  });
  return new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => accept({ server, url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise(resolve => server.close(resolve)) }));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const value = process.argv[2] === '--port' ? Number(process.argv[3]) : 4340;
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error('Port muss zwischen 1 und 65535 liegen.');
  const preview = await startPreview(value);
  console.log(`Lanz: drei Mini-Entwürfe auf ${preview.url}\nNur lokale Vorschau. Keine Datenbank und kein Versand. Strg+C beendet den Server.`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await preview.close(); process.exit(0); });
}
