// Run the real application with a fresh, isolated review database. Never loads .env.
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createApp } from './server.mjs';
import { initialContent } from './content.mjs';
import { renderPage } from './render.mjs';
import { renderAdmin } from './admin.mjs';
import { hashPassword } from './security.mjs';

const port = process.argv[2] === '--port' ? Number(process.argv[3]) : 4332;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Ungültiger Port.');
const dataDir = await mkdtemp(join(tmpdir(), 'lanz-direction-b-preview-'));
const password = randomBytes(24).toString('base64url');
const config = { dataDir, passwordHash: await hashPassword(password), sessionSecret: randomBytes(48).toString('hex'), stage: 'review', origin: `http://127.0.0.1:${port}`, host: '127.0.0.1', port, minFormAge: 0, scheduledTasks: false };
const app = await createApp({ config, seed: initialContent, renderPage, renderAdmin });
try { await app.listen(); } catch (error) { await app.close(); throw error; }
const accessPath = join(dataDir, '.local-access.txt');
await writeFile(accessPath, `Nur lokale Testverwaltung: ${config.origin}/verwaltung/\nPasswort: ${password}\n`, { mode: 0o600, flag: 'wx' });
console.log(`Lanz – Richtung B: ${config.origin}/\nIsolierter Testdatenbestand: ${dataDir}\nLokaler Verwaltungszugang: ${accessPath}\nKein E-Mail-Versand. Kein Zugriff auf den Kundenbestand. Strg+C beendet die Vorschau.`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
