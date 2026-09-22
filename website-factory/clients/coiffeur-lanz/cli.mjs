import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { loadConfig, root, launchChecks } from './config.mjs';
import { hashPassword, randomToken, validateContent } from './security.mjs';
import { Store, zurichDate } from './store.mjs';
import { initialContent } from './content.mjs';
import { renderPage } from './render.mjs';
import { renderAdmin } from './admin.mjs';
import { createApp } from './server.mjs';
import { restoreBackup } from './operations.mjs';

const action = process.argv[2] || 'start';
async function run() {
  if (action === 'setup') {
    const env = join(root, '.env');
    if (existsSync(env)) throw new Error('Die lokale .env existiert bereits und wird nicht überschrieben.');
    const password = randomBytes(18).toString('base64url');
    const template = await readFile(join(root, '.env.example'), 'utf8');
    await writeFile(env, template.replace('ADMIN_PASSWORD_HASH=', `ADMIN_PASSWORD_HASH=${await hashPassword(password)}`).replace('SESSION_SECRET=', `SESSION_SECRET=${randomToken()}`), { flag: 'wx', mode: 0o600 });
    await writeFile(join(root, '.local-access.txt'), `Coiffeur Lanz – lokaler Zugang\n\nWebsite: http://127.0.0.1:4330/\nVerwaltung: http://127.0.0.1:4330/verwaltung/\nPasswort: ${password}\n\nNur lokal aufbewahren. Diese Datei und .env werden nicht in Git gespeichert.\n`, { flag: 'wx', mode: 0o600 });
    process.stdout.write('Zugang eingerichtet. Passwort steht ausschliesslich in .local-access.txt.\n'); return;
  }
  if (action === 'check') {
    validateContent(initialContent);
    for (const path of ['/', '/salon/', '/besuch/', '/kontakt/', '/journal/', '/impressum/', '/datenschutz/']) {
      const page = renderPage(path, initialContent, { origin: 'http://localhost:4330', stage: 'review' });
      if (page.status !== 200 || !/<h1[ >]/.test(page.html)) throw new Error(`Ungültige Seite: ${path}`);
      for (const asset of page.html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)) if (!existsSync(join(root, 'public', asset[1]))) throw new Error(`Datei fehlt: ${asset[1]}`);
    }
    process.stdout.write('Inhalte, Seiten und lokale Assets geprüft. Keine Build-Abhängigkeiten erforderlich.\n'); return;
  }
  const config = loadConfig();
  await mkdir(config.dataDir, { recursive: true });
  if (action === 'start') {
    const lock = join(config.dataDir, 'server.lock');
    if (existsSync(lock)) {
      const pid = Number(await readFile(lock, 'utf8')); let running = false;
      try { process.kill(pid, 0); running = true; } catch { /* stale process lock */ }
      if (running) throw new Error('Diese Datenbank wird bereits von einem Server verwendet.');
    }
    const app = await createApp({ config, seed: initialContent, renderPage, renderAdmin });
    await app.listen(); await writeFile(lock, String(process.pid));
    process.stdout.write(`Lanz läuft: ${config.origin}/\nVerwaltung: ${config.origin}/verwaltung/\nBetrieb: ${config.stage}\n`);
    let stopping = false;
    const stop = async () => { if (stopping) return; stopping = true; await app.close(); await unlink(lock).catch(() => {}); process.exit(0); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop); return;
  }
  if (action === 'restore') {
    const name = process.argv[3];
    if (!/^lanz-\d+-[a-f0-9]{8}\.sqlite$/.test(name || '') || !process.argv.includes('--confirm')) throw new Error('Aufruf: node cli.mjs restore <Backup-Dateiname> --confirm (Server vorher stoppen).');
    await restoreBackup(config.dataDir, name, initialContent);
    process.stdout.write('Backup wiederhergestellt. Der bisherige Stand wurde zusätzlich gesichert.\n'); return;
  }
  const store = new Store(config.dataDir, initialContent);
  try {
    if (action === 'backup') process.stdout.write(`Sicherung erstellt: ${await store.backup()}\n`);
    else if (action === 'report') {
      const month = process.argv[3] || zurichDate().slice(0, 7);
      if (!/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(month)) throw new Error('Monat als YYYY-MM angeben.');
      const file = join(config.dataDir, `monatsbericht-${month}.json`); await writeFile(file, JSON.stringify(store.report(month), null, 2)); process.stdout.write(`Bericht erstellt: ${file}\n`);
    } else if (action === 'launch-check') {
      for (const check of launchChecks(config)) process.stdout.write(`${check.ready ? 'OK' : 'OFFEN'}: ${check.label}\n`);
    } else throw new Error('Befehle: setup, start, check, backup, restore, report, launch-check.');
  } finally { store.close(); }
}
run().catch(err => { process.stderr.write(`${err.message}\n`); process.exitCode = 1; });
