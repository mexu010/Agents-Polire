// Run on a separate host for meaningful external monitoring. No messages leave this process.
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from './config.mjs';
const config = loadConfig();
const target = new URL('/healthz', config.origin);
await mkdir(config.dataDir, { recursive: true });
let previous = null;
async function check() {
  const began = Date.now(); let state;
  try {
    const r = await fetch(target, { signal: AbortSignal.timeout(10000), redirect: 'error' });
    state = r.ok ? 'ok' : 'failed';
  } catch { state = 'failed'; }
  if (state !== previous) {
    const event = { at: new Date().toISOString(), state, latencyMs: Date.now() - began, target: target.origin };
    await appendFile(join(config.dataDir, 'monitor-events.jsonl'), JSON.stringify(event) + '\n');
    process[state === 'ok' ? 'stdout' : 'stderr'].write(`Lanz ${state === 'ok' ? 'erreichbar' : 'nicht gesund / nicht erreichbar'} (${event.at})\n`);
    previous = state;
  }
  return state;
}
if (process.argv.includes('--once')) process.exitCode = await check() === 'ok' ? 0 : 1;
else { await check(); setInterval(() => { void check().catch(() => process.stderr.write('Überwachungsprotokoll konnte nicht geschrieben werden.\n')); }, 60000); }
