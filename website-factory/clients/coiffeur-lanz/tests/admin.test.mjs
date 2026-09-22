import assert from 'node:assert/strict';
import test from 'node:test';
import { renderAdmin } from '../admin.mjs';

test('admin shell exposes accessible login and five distinct editor areas', () => {
  const html = renderAdmin();
  assert.match(html, /<html lang="de">/);
  assert.match(html, /id="login-form"/);
  assert.match(html, /type="password"/);
  for (const area of ['overview', 'content', 'journal', 'inquiries', 'operations']) {
    assert.match(html, new RegExp(`id="panel-${area}"`));
  }
  for (const field of ['legal.hostingProvider', 'legal.hostingCountry', 'legal.privacyContact', 'legal.additionalPrivacy']) {
    assert.match(html, new RegExp(`name="${field.replace('.', '\\.')}"`));
  }
  assert.match(html, /<script type="module" src="\/assets\/admin.js"><\/script>/);
  assert.doesNotMatch(html, /<script[^>]*>[^<]+<\/script>/);
});
