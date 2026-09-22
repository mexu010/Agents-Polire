import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';
import { hashPassword, issueFormToken } from '../security.mjs';
import { Store } from '../store.mjs';
import { restoreBackup } from '../operations.mjs';

const dirs = [];
after(async () => { for (const dir of dirs) await rm(dir, { recursive: true, force: true }); });
const seed = {
  business: { name: 'Coiffeur Lanz', person: 'Vreni Lanz', street: 'Eichi 20', postalCode: '3368', city: 'Bleienbach', phone: '062 922 31 82', mobile: '079 713 62 32', email: 'info@coiffeurlanz.ch' },
  home: { eyebrow: 'Bleienbach', headline: 'Coiffeur Lanz', intro: 'Willkommen.' },
  salon: { headline: 'Vreni Lanz', intro: 'In Bleienbach.' }, visit: { intro: 'Eichi 20.' }, contact: { intro: 'Kontakt.' },
  hours: [{ day: 'Montag', hours: 'Geschlossen' }], notice: '', heroImage: '/assets/salon-stilllife.png', heroAlt: '', articles: [],
};
async function fixture() {
  const dataDir = await mkdtemp(join(tmpdir(), 'lanz-test-')); dirs.push(dataDir);
  const config = { dataDir, passwordHash: await hashPassword('Testpasswort-123456'), sessionSecret: 'a'.repeat(64), stage: 'review', origin: 'http://127.0.0.1', host: '127.0.0.1', port: 0, minFormAge: 0, scheduledTasks: false };
  const app = await createApp({ config, seed, renderPage: (_path, content) => ({ status: 200, html: `<h1>${content.home.headline}</h1>` }), renderAdmin: () => '<h1>Verwaltung</h1>', mailer: async () => { throw new Error('Simulated mail outage: no network'); } });
  await app.listen(); config.origin = `http://127.0.0.1:${app.server.address().port}`;
  let cookie = '', csrf = '';
  const call = (path, method = 'GET', body, extra = {}) => fetch(config.origin + path, { method, headers: { Origin: config.origin, ...(body ? { 'Content-Type': 'application/json' } : {}), Cookie: cookie, 'X-CSRF-Token': csrf, ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const login = async () => { const res = await call('/api/login', 'POST', { password: 'Testpasswort-123456' }); cookie = res.headers.get('set-cookie').split(';')[0]; csrf = (await res.json()).csrfToken; return res; };
  return { app, config, call, login, dataDir };
}

test('unauthenticated APIs are closed, same-origin and CSRF required; logout invalidates session', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call('/api/admin/state')).status, 401);
    assert.equal((await f.call('/api/login', 'POST', { password: 'Testpasswort-123456' }, { Origin: 'https://evil.example' })).status, 403);
    const res = await f.login(); assert.equal(res.status, 200); assert.match(res.headers.get('set-cookie'), /HttpOnly.*SameSite=Strict/);
    assert.equal((await f.call('/api/admin/state')).status, 200);
    assert.equal((await f.call('/api/admin/backup', 'POST', {}, { 'X-CSRF-Token': '' })).status, 403);
    assert.equal((await f.call('/api/logout', 'POST', {})).status, 200);
    assert.equal((await f.call('/api/admin/state')).status, 401);
  } finally { await f.app.close(); }
});

test('edits survive restart, stale writes conflict, malformed content never replaces saved content', async () => {
  const f = await fixture();
  try {
    await f.login();
    const state = await (await f.call('/api/admin/state')).json();
    const content = structuredClone(state.content); content.home.headline = 'Zeit für Sie.';
    assert.equal((await f.call('/api/admin/content', 'PUT', { content, revision: state.revision })).status, 200);
    assert.equal((await f.call('/api/admin/content', 'PUT', { content, revision: state.revision })).status, 409);
    content.heroImage = 'javascript:alert(1)';
    assert.equal((await f.call('/api/admin/content', 'PUT', { content, revision: state.revision + 1 })).status, 400);
  } finally { await f.app.close(); }
  const reopened = new Store(f.dataDir, seed);
  assert.equal(reopened.getContent().content.home.headline, 'Zeit für Sie.'); reopened.close();
});

test('contact validates, requires signed token, saves once, never claims sent mail in review mode', async () => {
  const f = await fixture();
  try {
    const formStartedAt = Date.now() - 5000;
    const valid = { name: 'Testperson', email: 'test@example.test', phone: '', message: 'Bitte einen Termin besprechen.', consent: true, website: '', formStartedAt, formToken: issueFormToken(f.config.sessionSecret, formStartedAt) };
    assert.equal((await f.call('/api/contact', 'POST', { ...valid, consent: false })).status, 400);
    assert.equal((await f.call('/api/contact', 'POST', { ...valid, formToken: 'forged' })).status, 400);
    assert.equal((await f.call('/api/contact', 'POST', { ...valid, website: 'spam' })).status, 400);
    const result = await f.call('/api/contact', 'POST', valid); assert.equal(result.status, 201);
    assert.equal((await result.json()).delivery, 'review');
    const retry = await f.call('/api/contact', 'POST', valid); assert.equal(retry.status, 200);
    await f.login(); const state = await (await f.call('/api/admin/state')).json();
    assert.equal(state.inquiries.length, 1); assert.equal(state.inquiries[0].message, valid.message);
    assert.equal((await f.call(`/api/admin/inquiries/${state.inquiries[0].id}`, 'PATCH', { status: 'done' })).status, 200);
    assert.equal((await f.call(`/api/admin/inquiries/${state.inquiries[0].id}`, 'DELETE')).status, 200);
    assert.equal((await (await f.call('/api/admin/state')).json()).inquiries.length, 0);
    const second = await f.call('/api/contact', 'POST', { ...valid, message: 'Eine zweite, andere Nachricht.' });
    assert.equal(second.status, 201);
  } finally { await f.app.close(); }
});

test('distinct messages sharing a token are not lost, while identical retries remain idempotent', async () => {
  const f = await fixture();
  try {
    const formStartedAt = Date.now() - 5000, formToken = issueFormToken(f.config.sessionSecret, formStartedAt);
    const payload = { name: 'Testperson', email: 'test@example.test', phone: '', message: 'Erste unterschiedliche Nachricht.', consent: true, website: '', formStartedAt, formToken };
    assert.equal((await f.call('/api/contact', 'POST', payload)).status, 201);
    assert.equal((await f.call('/api/contact', 'POST', { ...payload, message: 'Zweite unterschiedliche Nachricht.' })).status, 201);
    assert.equal((await f.call('/api/contact', 'POST', payload)).status, 200);
    await f.login(); assert.equal((await (await f.call('/api/admin/state')).json()).inquiries.length, 2);
  } finally { await f.app.close(); }
});

test('mail outage remains visible in health and operations and does not lose inquiries', async () => {
  const f = await fixture();
  try {
    // Exercise the post-launch delivery path with an injected mailer that cannot perform network I/O.
    f.config.stage = 'production';
    const formStartedAt = Date.now() - 5000;
    const response = await f.call('/api/contact', 'POST', { name: 'Testperson', email: 'test@example.test', phone: '', message: 'Bitte prüfen Sie meine Anfrage.', consent: true, website: '', formStartedAt, formToken: issueFormToken(f.config.sessionSecret, formStartedAt) });
    assert.equal((await response.json()).delivery, 'inbox'); assert.equal((await f.call('/healthz')).status, 503);
    await f.login(); const state = await (await f.call('/api/admin/state')).json();
    assert.equal(state.operations.pendingDeliveries, 1); assert.equal(state.inquiries.length, 1);
  } finally { await f.app.close(); }
});

test('archived reports survive retention, while unresolved inquiries are retained', async () => {
  const f = await fixture();
  try {
    const store = f.app.store, old = new Date(Date.now() - 100 * 86400000).toISOString(), month = old.slice(0,7);
    const unresolved = store.addInquiry({ name: 'Offen', email: 'test@example.test', phone: '', message: 'Offene Nachricht' }, 'open', 'inbox');
    const resolved = store.addInquiry({ name: 'Erledigt', email: 'test@example.test', phone: '', message: 'Erledigte Nachricht' }, 'done', 'sent');
    store.updateInquiry(resolved.id, 'done'); store.db.prepare('UPDATE inquiries SET createdAt=?').run(old);
    store.archiveReport(month); store.cleanup();
    assert.equal(store.inquiries().length, 1); assert.equal(store.inquiries()[0].id, unresolved.id);
    assert.equal(store.report(month).inquiries, 2);
  } finally { await f.app.close(); }
});

test('backup produces valid restorable SQLite; private files and media cannot be abused', async () => {
  const f = await fixture();
  try {
    await f.login();
    const r = await f.call('/api/admin/backup', 'POST', {}); assert.equal(r.status, 200);
    const { name } = await r.json();
    const bytes = await readFile(join(f.dataDir, 'backups', name)); assert.equal(bytes.subarray(0, 15).toString(), 'SQLite format 3');
    assert.equal((await f.call('/.env')).status, 404);
    assert.equal((await f.call('/data/site.sqlite')).status, 404);
    assert.equal((await f.call('/api/admin/media', 'POST', { name: 'x.png', type: 'image/png', data: Buffer.from('<script>alert(1)</script>').toString('base64') })).status, 400);
    assert.ok((await readdir(join(f.dataDir, 'backups'))).length);
  } finally { await f.app.close(); }
});

test('analytics counts real allowed pages, honours privacy signals and strips referrer identifiers', async () => {
  const f = await fixture();
  try {
    await f.call('/api/view', 'POST', { path: '/', referrer: 'https://search.example/path?secret=abc' });
    await f.call('/api/view', 'POST', { path: '/', referrer: '' }, { DNT: '1' });
    await f.call('/api/view', 'POST', { path: '/kontakt/', referrer: '' }, { 'Sec-GPC': '1' });
    assert.equal((await f.call('/api/view', 'POST', { path: '/verwaltung/', referrer: '' })).status, 400);
    await f.login(); const state = await (await f.call('/api/admin/state')).json();
    assert.equal(state.analytics.pageviews, 1); assert.equal(state.analytics.visitors, 1);
    assert.equal(state.analytics.referrers[0].host, 'search.example');
    assert.doesNotMatch(JSON.stringify(state.analytics), /secret|127\.0\.0\.1/);
  } finally { await f.app.close(); }
});

test('production cannot start without real launch prerequisites', async () => {
  const f = await fixture(); await f.app.close();
  await assert.rejects(createApp({ config: { ...f.config, stage: 'production' }, seed, renderPage: () => '', renderAdmin: () => '' }), /Freigabe|Produktiv|HTTPS/);
});

test('real restore returns content to saved state and revokes backed-up sessions', async () => {
  const f = await fixture(); let name;
  try {
    const saved = f.app.store.getContent(); saved.content.home.headline = 'Gesicherter Stand';
    f.app.store.saveContent(saved.content, saved.revision); f.app.store.addSession('saved-session', 'secret-csrf');
    name = await f.app.store.backup();
    const changed = f.app.store.getContent(); changed.content.home.headline = 'Neuer Stand'; f.app.store.saveContent(changed.content, changed.revision);
  } finally { await f.app.close(); }
  await assert.rejects(restoreBackup(f.dataDir, '../site.sqlite', seed), /Backup-Dateiname/);
  await restoreBackup(f.dataDir, name, seed);
  const restored = new Store(f.dataDir, seed);
  try { assert.equal(restored.getContent().content.home.headline, 'Gesicherter Stand'); assert.equal(restored.session('saved-session'), undefined); }
  finally { restored.close(); }
});

test('failed source or media copying never exposes a partial backup as complete', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lanz-test-')); dirs.push(dir);
  const store = new Store(dir, seed, { copy: async () => { throw new Error('Simulated copy failure'); } });
  try { await assert.rejects(store.backup(), /Simulated copy failure/); assert.deepEqual(await store.backups(), []); }
  finally { store.close(); }
});
