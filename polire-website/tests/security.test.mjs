import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../next.config.mjs';

test('all routes send browser security headers without breaking form delivery', async () => {
  assert.equal(config.poweredByHeader, false);
  assert.equal(typeof config.headers, 'function');
  const rules = await config.headers();
  const all = rules.find(rule => rule.source === '/:path*');
  const headers = Object.fromEntries(all.headers.map(({key,value}) => [key.toLowerCase(),value]));
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.equal(headers['referrer-policy'], 'strict-origin-when-cross-origin');
  const csp = headers['content-security-policy'];
  for (const directive of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "connect-src 'self' https://formsubmit.co", "form-action 'self'"]) assert.ok(csp.includes(directive), directive);
  assert.ok(!csp.includes('unsafe-eval'));
  assert.ok(headers['permissions-policy'].includes('camera=()'));
});
