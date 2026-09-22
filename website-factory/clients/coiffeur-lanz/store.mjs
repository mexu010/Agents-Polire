import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { mkdir, readdir, rename, rm, stat, cp, writeFile } from 'node:fs/promises';
import { join, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { httpError } from './security.mjs';
const sourceRoot = dirname(fileURLToPath(import.meta.url));
export const zurichDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export class Store {
  constructor(dataDir, seed, { copy = cp } = {}) {
    this.copy = copy;
    this.dir = resolve(dataDir); mkdirSync(this.dir, { recursive: true });
    this.db = new DatabaseSync(join(this.dir, 'site.sqlite'), { timeout: 5000 });
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL, revision INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS inquiries (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, message TEXT, createdAt TEXT, status TEXT, delivery TEXT, dedupe TEXT UNIQUE);
      CREATE TABLE IF NOT EXISTS counters (date TEXT, path TEXT, host TEXT, views INTEGER NOT NULL, PRIMARY KEY(date,path,host));
      CREATE TABLE IF NOT EXISTS visitors (date TEXT, hash TEXT, PRIMARY KEY(date,hash));
      CREATE TABLE IF NOT EXISTS visitor_totals (date TEXT PRIMARY KEY, visitors INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS limits (id TEXT PRIMARY KEY, count INTEGER, expires INTEGER);
      CREATE TABLE IF NOT EXISTS reports (month TEXT PRIMARY KEY, json TEXT);
      CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, date TEXT, kind TEXT, detail TEXT);
    `);
    this.db.prepare('INSERT OR IGNORE INTO content VALUES (1,?,1)').run(JSON.stringify(seed));
  }
  getContent() { const row = this.db.prepare('SELECT json,revision FROM content WHERE id=1').get(); return { content: JSON.parse(row.json), revision: row.revision }; }
  saveContent(content, revision) {
    const result = this.db.prepare('UPDATE content SET json=?,revision=revision+1 WHERE id=1 AND revision=?').run(JSON.stringify(content), revision);
    if (!result.changes) throw httpError(409, 'Die Inhalte wurden inzwischen geändert. Bitte neu laden und Ihre Änderung erneut eintragen.');
    this.event('content', 'Inhalte aktualisiert'); return revision + 1;
  }
  event(kind, detail) { this.db.prepare('INSERT INTO events(date,kind,detail) VALUES(?,?,?)').run(new Date().toISOString(), kind, detail); }
  session(id) { return this.db.prepare('SELECT csrf,expires FROM sessions WHERE id=? AND expires>?').get(id, Date.now()); }
  addSession(id, csrf) { this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(id, csrf, Date.now() + 8 * 60 * 60 * 1000); }
  deleteSession(id) { this.db.prepare('DELETE FROM sessions WHERE id=?').run(id); }
  limit(id, maximum, windowMs) {
    const row = this.db.prepare('SELECT count,expires FROM limits WHERE id=?').get(id), now = Date.now();
    if (row && row.expires > now && row.count >= maximum) return false;
    if (!row || row.expires <= now) this.db.prepare('INSERT OR REPLACE INTO limits VALUES(?,1,?)').run(id, now + windowMs);
    else this.db.prepare('UPDATE limits SET count=count+1 WHERE id=?').run(id);
    return true;
  }
  inquiries() { return this.db.prepare('SELECT id,name,email,phone,message,createdAt,status,delivery FROM inquiries ORDER BY createdAt DESC LIMIT 500').all(); }
  addInquiry(data, dedupe, delivery) {
    const existing = this.db.prepare('SELECT id,delivery FROM inquiries WHERE dedupe=?').get(dedupe);
    if (existing) return { ...existing, duplicate: true };
    const id = randomUUID();
    this.db.prepare('INSERT INTO inquiries VALUES(?,?,?,?,?,?,?,?,?)').run(id, data.name, data.email, data.phone, data.message, new Date().toISOString(), 'new', delivery, dedupe);
    return { id, delivery, duplicate: false };
  }
  updateInquiry(id, status) { const r = this.db.prepare('UPDATE inquiries SET status=? WHERE id=?').run(status, id); if (!r.changes) throw httpError(404, 'Anfrage nicht gefunden.'); }
  deleteInquiry(id) { const r = this.db.prepare('DELETE FROM inquiries WHERE id=?').run(id); if (!r.changes) throw httpError(404, 'Anfrage nicht gefunden.'); }
  setDelivery(id, delivery) { this.db.prepare('UPDATE inquiries SET delivery=? WHERE id=?').run(delivery, id); }
  pendingDeliveries() { return this.db.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE delivery='inbox' AND status='new'").get().n; }
  view(path, host, visitor) {
    const date = zurichDate();
    this.db.prepare('INSERT INTO counters VALUES(?,?,?,1) ON CONFLICT(date,path,host) DO UPDATE SET views=views+1').run(date, path, host);
    const result = this.db.prepare('INSERT OR IGNORE INTO visitors VALUES(?,?)').run(date, visitor);
    if (result.changes) this.db.prepare('INSERT INTO visitor_totals VALUES(?,1) ON CONFLICT(date) DO UPDATE SET visitors=visitors+1').run(date);
  }
  analytics(month = zurichDate().slice(0, 7)) {
    const prefix = `${month}-%`;
    return {
      month,
      pageviews: this.db.prepare('SELECT COALESCE(SUM(views),0) AS n FROM counters WHERE date LIKE ?').get(prefix).n,
      visitors: this.db.prepare('SELECT COALESCE(SUM(visitors),0) AS n FROM visitor_totals WHERE date LIKE ?').get(prefix).n,
      pages: this.db.prepare('SELECT path,SUM(views) AS views FROM counters WHERE date LIKE ? GROUP BY path ORDER BY views DESC').all(prefix),
      days: this.db.prepare('SELECT c.date,SUM(c.views) AS views,COALESCE(v.visitors,0) AS visitors FROM counters c LEFT JOIN visitor_totals v ON c.date=v.date WHERE c.date LIKE ? GROUP BY c.date ORDER BY c.date').all(prefix),
      referrers: this.db.prepare('SELECT host,SUM(views) AS views FROM counters WHERE date LIKE ? GROUP BY host ORDER BY views DESC').all(prefix),
      visitorMethod: 'Summe täglich geschätzter Besucher; ohne Cookies. Mehrere Geräte oder Tage können mehrfach zählen.',
    };
  }
  report(month = zurichDate().slice(0, 7)) {
    if (month < zurichDate().slice(0, 7)) {
      const archived = this.db.prepare('SELECT json FROM reports WHERE month=?').get(month);
      if (archived) return JSON.parse(archived.json);
    }
    const metrics = this.analytics(month);
    return { month, createdAt: new Date().toISOString(), analytics: metrics, inquiries: this.db.prepare('SELECT COUNT(*) AS n FROM inquiries WHERE createdAt LIKE ?').get(`${month}-%`).n, maintenance: this.db.prepare('SELECT date,kind,detail FROM events WHERE date LIKE ? ORDER BY date').all(`${month}-%`), performance: { available: false, note: 'Keine externen Felddaten vorhanden. Keine erfundenen Leistungswerte.' }, note: 'Anfragen zählen den aktuellen Bestand. Entwürfe und lokale Testaufrufe sind vor dem Produktivstart getrennt zu prüfen.' };
  }
  archiveReport(month) { const report = this.report(month); this.db.prepare('INSERT OR IGNORE INTO reports VALUES(?,?)').run(month, JSON.stringify(report)); return report; }
  cleanup() {
    const now = Date.now();
    this.db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
    this.db.prepare('DELETE FROM limits WHERE expires<?').run(now);
    this.db.prepare('DELETE FROM visitors WHERE date<?').run(zurichDate());
    this.db.prepare("DELETE FROM inquiries WHERE status='done' AND createdAt<?").run(new Date(now - 90 * 86400000).toISOString());
    this.db.prepare('DELETE FROM events WHERE date<?').run(new Date(now - 400 * 86400000).toISOString());
    this.db.prepare('DELETE FROM counters WHERE date<?').run(zurichDate(new Date(now - 400 * 86400000)));
    this.db.prepare('DELETE FROM visitor_totals WHERE date<?').run(zurichDate(new Date(now - 400 * 86400000)));
  }
  async backup() {
    if (this.backupPromise) return this.backupPromise;
    this.backupPromise = this._backup().finally(() => { this.backupPromise = null; });
    return this.backupPromise;
  }
  async _backup() {
    const dir = join(this.dir, 'backups'); await mkdir(dir, { recursive: true });
    const name = `lanz-${Date.now()}-${randomUUID().slice(0, 8)}.sqlite`, target = join(dir, name);
    await backup(this.db, `${target}.partial`);
    const hasUploads = existsSync(join(this.dir, 'uploads'));
    if (hasUploads) await this.copy(join(this.dir, 'uploads'), `${target}.uploads.partial`, { recursive: true });
    const weekly = join(dir, `weekly-${zurichDate()}`);
    const entries = await readdir(dir); const weekEntries = entries.filter(n => /^weekly-\d{4}-\d{2}-\d{2}$/.test(n)).sort();
    const newest = weekEntries.at(-1);
    if (!newest || Date.parse(zurichDate()) - Date.parse(newest.slice(7)) >= 7 * 86400000) {
      const weeklyPending = `${weekly}.partial`;
      await mkdir(weeklyPending, { recursive: true });
      for (const file of await readdir(sourceRoot)) if (/\.(?:mjs|json)$/.test(file) || file === 'Dockerfile') await this.copy(join(sourceRoot, file), join(weeklyPending, file));
      await this.copy(join(sourceRoot, 'public'), join(weeklyPending, 'public'), { recursive: true });
      await writeFile(join(weeklyPending, 'content.json'), JSON.stringify(this.getContent().content, null, 2));
      await rename(weeklyPending, weekly);
    }
    if (hasUploads) await rename(`${target}.uploads.partial`, `${target}.uploads`);
    // A final database filename denotes a complete backup set, never a partial copy.
    await rename(`${target}.partial`, target);
    for (const entry of await readdir(dir)) {
      if (!/^(?:lanz-\d+-[a-f0-9]{8}\.sqlite(?:\.uploads)?|weekly-\d{4}-\d{2}-\d{2})$/.test(entry)) continue;
      const path = resolve(dir, entry), info = await stat(path);
      if (!path.startsWith(resolve(dir) + sep)) throw new Error('Ungültiger Backup-Pfad');
      if (Date.now() - info.mtimeMs > (entry.startsWith('weekly-') ? 28 : 7) * 86400000) await rm(path, { recursive: true, force: true });
    }
    this.event('backup', 'Datenbank, hochgeladene Bilder und wöchentlicher Quellstand gesichert');
    return name;
  }
  async backups() {
    const dir = join(this.dir, 'backups'); if (!existsSync(dir)) return [];
    const names = (await readdir(dir)).filter(n => /^lanz-\d+-[a-f0-9]{8}\.sqlite$/.test(n)).sort().reverse();
    return Promise.all(names.map(async name => ({ name, createdAt: (await stat(join(dir, name))).mtime.toISOString() })));
  }
  close() { this.db.close(); }
}
