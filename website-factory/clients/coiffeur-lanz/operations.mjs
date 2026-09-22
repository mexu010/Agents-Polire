import { existsSync } from 'node:fs';
import { readFile, cp, rename, unlink, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { validateContent } from './security.mjs';
import { Store } from './store.mjs';

export async function restoreBackup(dataDir, name, seed) {
  if (!/^lanz-\d+-[a-f0-9]{8}\.sqlite$/.test(name || '')) throw new Error('Ungültiger Backup-Dateiname.');
  const lock = join(dataDir, 'server.lock');
  if (existsSync(lock)) {
    const pid = Number(await readFile(lock, 'utf8')); let running = false;
    if (Number.isSafeInteger(pid) && pid > 0) { try { process.kill(pid, 0); running = true; } catch { /* stale lock */ } }
    if (running) throw new Error('Server zuerst stoppen.');
  }
  const dir = resolve(dataDir), source = resolve(dir, 'backups', name), target = resolve(dir, 'site.sqlite');
  if (!source.startsWith(dir + sep) || !target.startsWith(dir + sep)) throw new Error('Ungültiger Wiederherstellungspfad.');
  const candidate = new DatabaseSync(source, { readOnly: true });
  try {
    if (Object.values(candidate.prepare('PRAGMA integrity_check').get())[0] !== 'ok') throw new Error('Backup beschädigt.');
    validateContent(JSON.parse(candidate.prepare('SELECT json FROM content WHERE id=1').get().json));
  } finally { candidate.close(); }
  // Copy the selected snapshot before retention maintenance can remove an old source.
  await cp(source, `${target}.restore`);
  const savedUploads = source + '.uploads';
  const stagingUploads = join(dir, `restore-uploads-${Date.now()}`);
  if (existsSync(savedUploads)) await cp(savedUploads, stagingUploads, { recursive: true });
  const store = new Store(dir, seed);
  try { await store.backup(); } finally { store.close(); }
  if (existsSync(stagingUploads)) await cp(stagingUploads, join(dir, 'uploads'), { recursive: true });
  // All paths above were resolved inside the explicitly supplied data directory.
  const previous = `${target}.before-restore-${Date.now()}`;
  await rename(target, previous);
  await rename(`${target}.restore`, target);
  for (const suffix of ['-wal', '-shm']) await unlink(target + suffix).catch(() => {});
  const restored = new Store(dir, seed);
  try { restored.db.exec('DELETE FROM sessions'); } finally { restored.close(); }
  // The completed pre-restore backup remains in the normal seven-day retention set.
  if (!resolve(previous).startsWith(dir + sep) || !resolve(stagingUploads).startsWith(dir + sep)) throw new Error('Ungültiger temporärer Sicherungspfad.');
  await unlink(previous);
  if (existsSync(stagingUploads)) await rm(stagingUploads, { recursive: true, force: true });
  return name;
}
