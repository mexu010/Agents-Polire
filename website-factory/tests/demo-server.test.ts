import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { get } from 'node:http';
import { test, expect } from 'vitest';
// @ts-expect-error Local demo server is intentionally plain Node.js.
import { createDemoServer } from '../demos/server.mjs';

test('demo server serves only the public directory and blocks contact submissions', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'polire-demo-server-'));
  await mkdir(path.join(root, 'public'));
  await writeFile(path.join(root, 'private.json'), 'private-marker');
  await writeFile(path.join(root, 'public', 'index.html'), '<h1>Demo</h1>');
  const server = await createDemoServer(path.join(root, 'public'), 0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(base);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Demo');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(response.headers.get('content-security-policy')).toContain("form-action 'none'");
    expect((await fetch(base + '/private.json')).status).toBe(404);
    expect((await fetch(base + '/%2e%2e%2fprivate.json')).status).toBe(404);
    expect((await fetch(base, { method: 'POST', body: 'message' })).status).toBe(405);
    const remoteHostStatus = await new Promise<number | undefined>((resolve, reject) => {
      get(base, { headers: { host: 'outside.example' } }, response => {
        response.resume();
        resolve(response.statusCode);
      }).on('error', reject);
    });
    expect(remoteHostStatus).toBe(403);
  } finally {
    await new Promise<void>(resolve => { server.closeAllConnections(); server.close(resolve); });
    await rm(root, { recursive: true, force: true });
  }
});
