import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, sep, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store, zurichDate } from './store.mjs';
import { root, assertConfig, launchChecks } from './config.mjs';
import { digest, randomToken, verifyPassword, safeEqual, issueFormToken, validFormToken, httpError, validateContent, validateContact } from './security.mjs';

const types = { '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const publicRoutes = ['/', '/salon/', '/besuch/', '/kontakt/', '/journal/', '/impressum/', '/datenschutz/'];
const xml = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
async function readJson(req, max = 180000) {
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw httpError(415, 'Bitte JSON-Daten verwenden.');
  if (Number(req.headers['content-length'] || 0) > max) throw httpError(413, 'Die Daten sind zu gross.');
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > max) throw httpError(413, 'Die Daten sind zu gross.'); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
  catch { throw httpError(400, 'Ungültige Anfrage. Bitte neu laden.'); }
}
function cookieId(req, config) { const value = String(req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('lanz_session='))?.slice(13); return value ? digest(config.sessionSecret, value) : ''; }
function imageExtension(data, mime) {
  if (mime === 'image/png' && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (mime === 'image/jpeg' && data[0] === 255 && data[1] === 216 && data[2] === 255) return 'jpg';
  if (mime === 'image/webp' && data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') return 'webp';
  throw httpError(400, 'Bitte ein echtes PNG-, JPEG- oder WebP-Bild auswählen.');
}
async function deliverMail(config, data, id) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${config.mailKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': id },
    body: JSON.stringify({ from: config.mailFrom, to: [config.mailTo], reply_to: data.email, subject: 'Neue Website-Anfrage – Coiffeur Lanz', text: `Name: ${data.name}\nE-Mail: ${data.email}\nTelefon: ${data.phone || 'Nicht angegeben'}\n\n${data.message}\n\nReferenz: ${id}` }),
  });
  if (!response.ok) throw new Error('mail_failed');
}

export async function createApp({ config, seed, renderPage, renderAdmin, mailer = deliverMail }) {
  assertConfig(config);
  const store = new Store(config.dataDir, seed), started = Date.now();
  if (config.stage === 'production') {
    const legal = store.getContent().content.legal;
    if (!legal?.hostingProvider?.trim() || !legal?.hostingCountry?.trim() || !legal?.privacyContact?.trim()) { store.close(); throw new Error('Produktivstart benötigt vollständige Hosting- und Datenschutzangaben im Inhaltseditor.'); }
  }
  let timer, lastMaintenanceError = null;
  const send = (res, status, body, type = 'application/json; charset=utf-8') => { res.statusCode = status; res.setHeader('Content-Type', type); res.end(type.startsWith('application/json') ? JSON.stringify(body) : body); };
  const ipFor = (req) => config.trustProxy ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim() : String(req.socket.remoteAddress);
  const sameOrigin = (req) => { if (req.headers.origin !== config.origin) throw httpError(403, 'Diese Anfrage kommt nicht von dieser Website. Bitte die Website neu öffnen.'); };
  async function operations() {
    const backups = await store.backups();
    return { stage: config.stage, mailConfigured: Boolean(config.mailKey && config.mailFrom && config.mailTo), lastBackup: backups[0]?.createdAt || null, backups, uptimeSeconds: Math.round((Date.now() - started) / 1000), monthlyReport: zurichDate().slice(0, 7), launchChecks: launchChecks(config), maintenanceError: lastMaintenanceError, pendingDeliveries: store.pendingDeliveries() };
  }
  function isPage(path, content) { return publicRoutes.includes(path) || content.articles.some(a => a.status === 'published' && path === `/journal/${a.slug}/`); }
  const server = createServer(async (req, res) => {
    const nonce = randomToken();
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', `default-src 'none'; style-src 'self'; script-src 'self' 'nonce-${nonce}'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
    if (config.stage !== 'production') res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (config.origin.startsWith('https:')) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    try {
      const url = new URL(req.url, config.origin), path = decodeURIComponent(url.pathname);
      if (path.includes('\\') || path.includes('\0')) throw httpError(400, 'Ungültige Adresse.');
      const method = req.method || 'GET', client = digest(config.sessionSecret, ipFor(req));
      if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) throw httpError(405, 'Methode nicht erlaubt.');
      if (!['GET', 'HEAD'].includes(method)) sameOrigin(req);
      if (path === '/healthz' && method === 'GET') { store.db.prepare('SELECT 1').get(); const degraded = lastMaintenanceError || store.pendingDeliveries() > 0; return send(res, degraded ? 503 : 200, { status: degraded ? 'degraded' : 'ok' }); }
      if (path.startsWith('/assets/') && ['GET', 'HEAD'].includes(method)) {
        const uploaded = path.startsWith('/assets/uploads/');
        const base = uploaded ? resolve(config.dataDir, 'uploads') : resolve(root, 'public', 'assets');
        const relative = path.slice(uploaded ? '/assets/uploads/'.length : '/assets/'.length), file = resolve(base, relative);
        if (!file.startsWith(base + sep) || !types[extname(file)] || relative.split('/').some(p => p.startsWith('.'))) throw httpError(404, 'Datei nicht gefunden.');
        let data; try { data = await readFile(file); } catch { throw httpError(404, 'Datei nicht gefunden.'); }
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return send(res, 200, method === 'HEAD' ? '' : data, types[extname(file)]);
      }
      if (path === '/api/session' && method === 'GET') {
        const session = store.session(cookieId(req, config)); return send(res, 200, session ? { authenticated: true, csrfToken: session.csrf } : { authenticated: false });
      }
      if (path === '/api/login' && method === 'POST') {
        if (!store.limit(`login:${client}`, 8, 15 * 60000)) throw httpError(429, 'Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.');
        const body = await readJson(req, 2000);
        if (!await verifyPassword(body.password, config.passwordHash)) throw httpError(401, 'Das Passwort stimmt nicht.');
        const id = randomToken(), csrf = randomToken(); store.addSession(digest(config.sessionSecret, id), csrf);
        res.setHeader('Set-Cookie', `lanz_session=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${config.origin.startsWith('https:') ? '; Secure' : ''}`);
        return send(res, 200, { authenticated: true, csrfToken: csrf });
      }
      if (path.startsWith('/api/admin/') || path === '/api/logout') {
        const id = cookieId(req, config), session = store.session(id);
        if (!session) throw httpError(401, 'Bitte anmelden.');
        if (!['GET', 'HEAD'].includes(method) && !safeEqual(req.headers['x-csrf-token'], session.csrf)) throw httpError(403, 'Sitzung bitte neu laden.');
        if (path === '/api/logout' && method === 'POST') { store.deleteSession(id); res.setHeader('Set-Cookie', `lanz_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${config.origin.startsWith('https:') ? '; Secure' : ''}`); return send(res, 200, { ok: true }); }
        if (path === '/api/admin/state' && method === 'GET') return send(res, 200, { ...store.getContent(), inquiries: store.inquiries(), analytics: store.analytics(), operations: await operations() });
        if (path === '/api/admin/content' && method === 'PUT') {
          const body = await readJson(req); if (!Number.isSafeInteger(body.revision)) throw httpError(400, 'Bitte die aktuellen Inhalte neu laden.');
          const content = validateContent(body.content);
          if (config.stage === 'production' && (!content.legal?.hostingProvider?.trim() || !content.legal?.hostingCountry?.trim() || !content.legal?.privacyContact?.trim())) throw httpError(400, 'Im Produktivbetrieb dürfen Hosting- und Datenschutzangaben nicht leer sein.');
          const revision = store.saveContent(content, body.revision); return send(res, 200, { ok: true, revision });
        }
        if (path.startsWith('/api/admin/inquiries/')) {
          const inquiryId = path.slice('/api/admin/inquiries/'.length);
          if (method === 'PATCH') { const { status } = await readJson(req, 1000); if (!['new', 'done'].includes(status)) throw httpError(400, 'Ungültiger Status.'); store.updateInquiry(inquiryId, status); return send(res, 200, { ok: true }); }
          if (method === 'DELETE') { store.deleteInquiry(inquiryId); return send(res, 200, { ok: true }); }
        }
        if (path === '/api/admin/backup' && method === 'POST') { if (!store.limit('backup', 6, 3600000)) throw httpError(429, 'Bitte mit der nächsten Sicherung warten.'); return send(res, 200, { ok: true, name: await store.backup() }); }
        if (path === '/api/admin/report' && method === 'GET') {
          const month = url.searchParams.get('month') || zurichDate().slice(0, 7);
          if (!/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(month)) throw httpError(400, 'Bitte einen gültigen Monat auswählen.');
          res.setHeader('Content-Disposition', `attachment; filename="lanz-monatsbericht-${month}.json"`); return send(res, 200, store.report(month));
        }
        if (path === '/api/admin/export' && method === 'GET') { res.setHeader('Content-Disposition', 'attachment; filename="lanz-inhalte.json"'); return send(res, 200, store.getContent().content); }
        if (path === '/api/admin/media' && method === 'POST') {
          if (!store.limit('uploads', 30, 3600000)) throw httpError(429, 'Bitte mit weiteren Bildern warten.');
          const body = await readJson(req, 2900000);
          if (typeof body.data !== 'string' || !/^[a-zA-Z0-9+/]*={0,2}$/.test(body.data)) throw httpError(400, 'Bild konnte nicht gelesen werden.');
          const bytes = Buffer.from(body.data, 'base64'); if (bytes.length < 32 || bytes.length > 2 * 1024 * 1024) throw httpError(400, 'Bilder dürfen höchstens 2 MB gross sein.');
          const ext = imageExtension(bytes, body.type), name = `${randomUUID()}.${ext}`;
          await mkdir(join(config.dataDir, 'uploads'), { recursive: true }); await writeFile(join(config.dataDir, 'uploads', name), bytes, { flag: 'wx' });
          return send(res, 201, { url: `/assets/uploads/${name}` });
        }
        throw httpError(404, 'Funktion nicht gefunden.');
      }
      if (path === '/api/contact' && method === 'POST') {
        if (!store.limit(`contact:${client}`, 8, 15 * 60000)) throw httpError(429, 'Zu viele Anfragen. Bitte später erneut versuchen oder anrufen.');
        const body = await readJson(req, 16000);
        if (body.website || !validFormToken(config.sessionSecret, body.formToken, body.formStartedAt, config.minFormAge ?? 2000)) throw httpError(400, 'Bitte das Formular neu laden und nochmals ausfüllen.');
        const data = validateContact(body), dedupe = digest(config.sessionSecret, body.formToken + JSON.stringify(data));
        const inquiry = store.addInquiry(data, dedupe, config.stage === 'review' ? 'review' : 'inbox');
        if (!inquiry.duplicate && config.stage === 'production') {
          try { await mailer(config, data, inquiry.id); store.setDelivery(inquiry.id, 'sent'); inquiry.delivery = 'sent'; }
          catch { store.event('mail', `Anfrage ${inquiry.id}: Zustellung fehlgeschlagen; im Postfach gespeichert`); }
        }
        const formStartedAt = Date.now();
        return send(res, inquiry.duplicate ? 200 : 201, { ok: true, reference: inquiry.id, delivery: inquiry.delivery, formStartedAt, nextFormToken: issueFormToken(config.sessionSecret, formStartedAt) });
      }
      if (path === '/api/view' && method === 'POST') {
        if (!store.limit(`view:${client}`, 120, 60000)) throw httpError(429, 'Bitte später erneut versuchen.');
        const body = await readJson(req, 4000), content = store.getContent().content;
        if (typeof body.path !== 'string' || !isPage(body.path, content)) throw httpError(400, 'Ungültige Seite.');
        if (req.headers.dnt !== '1' && req.headers['sec-gpc'] !== '1' && !/bot|crawler|spider|headless/i.test(req.headers['user-agent'] || '')) {
          let host = 'Direkt'; try { const ref = new URL(body.referrer); if (['http:', 'https:'].includes(ref.protocol) && ref.origin !== config.origin) host = ref.hostname; } catch { /* No external referrer. */ }
          store.view(body.path, host, digest(config.sessionSecret, `${zurichDate()}:${ipFor(req)}`));
        }
        res.statusCode = 204; return res.end();
      }
      if (!['GET', 'HEAD'].includes(method)) throw httpError(404, 'Seite nicht gefunden.');
      if (path === '/verwaltung' || path === '/verwaltung/') { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); return send(res, 200, renderAdmin(), 'text/html; charset=utf-8'); }
      const { content } = store.getContent();
      if (path === '/robots.txt') return send(res, 200, config.stage === 'production' ? `User-agent: *\nDisallow: /verwaltung\nDisallow: /api/\nSitemap: ${config.origin}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n', 'text/plain; charset=utf-8');
      if (path === '/sitemap.xml') { const routes = [...publicRoutes, ...content.articles.filter(a => a.status === 'published').map(a => `/journal/${a.slug}/`)]; return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(p => `<url><loc>${xml(config.origin + p)}</loc></url>`).join('')}</urlset>`, 'application/xml; charset=utf-8'); }
      if (!isPage(path, content) && !path.endsWith('/') && isPage(path + '/', content)) { res.statusCode = 308; res.setHeader('Location', path + '/'); return res.end(); }
      if (path.startsWith('/api/') || path.startsWith('/data/') || path.startsWith('/.') || /\.(?:env|sqlite|mjs|json)$/.test(path)) throw httpError(404, 'Seite nicht gefunden.');
      const formStartedAt = Date.now();
      const page = renderPage(path, content, { origin: config.origin, stage: config.stage, nonce, formStartedAt, formToken: issueFormToken(config.sessionSecret, formStartedAt) });
      return send(res, isPage(path, content) ? page.status : 404, method === 'HEAD' ? '' : page.html, 'text/html; charset=utf-8');
    } catch (err) {
      if (res.headersSent) { res.end(); return; }
      send(res, err.status || 500, { error: err.status ? err.message : 'Das hat leider nicht geklappt. Bitte später erneut versuchen.', ...(err.fields ? { fields: err.fields } : {}) });
      if (!err.status) { store.event('error', 'Interner Fehler – Prüfung erforderlich'); process.stderr.write(`Lanz: ${err.code || err.name || 'Error'}\n`); }
    }
  });
  server.headersTimeout = 15000; server.requestTimeout = 20000;
  async function maintenance() {
    try {
      store.cleanup(); const backups = await store.backups();
      if (!backups.length || Date.now() - Date.parse(backups[0].createdAt) > 86400000) await store.backup();
      const date = new Date(); date.setUTCDate(0); store.archiveReport(zurichDate(date).slice(0, 7));
      lastMaintenanceError = null;
    } catch { lastMaintenanceError = 'Automatische Wartung fehlgeschlagen. Bitte prüfen.'; store.event('error', lastMaintenanceError); }
  }
  return { server, store, maintenance,
    listen: async () => { await new Promise((ok, no) => { server.once('error', no); server.listen(config.port, config.host, ok); }); if (config.scheduledTasks) { await maintenance(); timer = setInterval(maintenance, 3600000); timer.unref(); } },
    close: async () => { if (timer) clearInterval(timer); await new Promise((ok) => server.close(ok)); if (store.backupPromise) await store.backupPromise; store.close(); },
  };
}
