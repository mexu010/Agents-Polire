import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2' };
export async function createDemoServer(directory, port = 4320) {
  const root = await realpath(directory);
  const server = createServer(async (request, response) => {
    response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'");
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(request.headers.host ?? '')) { response.writeHead(403).end(); return; }
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    try {
      let route = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      if (route.includes('\\') || route.includes('\0')) throw new Error('Invalid path');
      if (route.endsWith('/')) route += 'index.html';
      const requested = path.resolve(root, '.' + route);
      if (!requested.startsWith(root + path.sep)) throw new Error('Outside root');
      const resolved = await realpath(requested);
      if (!resolved.startsWith(root + path.sep)) throw new Error('Outside root');
      const type = mime[path.extname(resolved)];
      if (!type || !(await stat(resolved)).isFile()) throw new Error('Unavailable');
      const body = await readFile(resolved);
      response.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(404).end('Nicht gefunden'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), '2026-09-21', 'public');
  const server = await createDemoServer(folder, Number(process.env.POLIRE_DEMO_PORT ?? 4320));
  process.stdout.write(`POLIRE Demo-Galerie: http://127.0.0.1:${server.address().port}/\n`);
}
