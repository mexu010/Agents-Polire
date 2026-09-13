import test from 'node:test';
import assert from 'node:assert/strict';

const route = await import('../app/api/enquiry/route.js').catch(() => ({}));
const valid = { name: 'Testperson', email: 'test@example.com', service: 'redesign', brief: 'Eine Website mit Terminbuchung.', website: 'https://example.com', examples: ['https://example.org', 'https://example.net'], inspiration: 'Farben und Navigation', company: '', budget: '', timing: '', fax: '' };
test('custom fields are validated and included in the delivered email', async t => {
  process.env.CONTACT_FORM_ID='verified-form-id';process.env.CONTACT_FORM_ACTIVE='true';
  t.after(()=>{delete process.env.CONTACT_FORM_ID;delete process.env.CONTACT_FORM_ACTIVE;});
  let payload;
  t.mock.method(globalThis,'fetch',async (_,options)=>{payload=JSON.parse(options.body);return Response.json({success:true});});
  for(const change of [{budget:'custom'},{timingMode:'date',timing:'2026-02-30'},{timingMode:'unknown'},{otherDetails:'x'.repeat(1001)}]) assert.equal((await route.POST(request({...valid,...change}))).status,400);
  assert.equal((await route.POST(request({...valid,service:'other',otherDetails:'Buchungssystem',budget:'custom',budgetDetails:'CHF 1800',timingMode:'asap'}))).status,200);
  assert.equal(payload['Weitere Angaben zur Projektart'],'Buchungssystem');
  assert.equal(payload.Budgetrahmen,'CHF 1800');
  assert.equal(payload['Gewünschter Start'],'So schnell wie möglich');
  await route.POST(request({...valid,timingMode:'date',timing:'2026-12-01'}));
  assert.equal(payload['Gewünschter Start'],'2026-12-01');
});
function request(body = valid, origin = 'https://polireagency.vercel.app') {
  return new Request('https://polireagency.vercel.app/api/enquiry', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
test('an unconfigured sender cannot accept or silently lose an enquiry', async () => {
  assert.equal(typeof route.POST, 'function', 'Enquiry handler must exist');
  const response = await route.POST(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, undefined);
});
test('rejects bad email, unsafe URLs, oversized text and unknown service', async () => {
  for (const changes of [{ email: 'bad' }, { email: 'a@b.com\r\nBcc: c@d.com' }, { website: 'javascript:alert(1)' }, { examples: ['file:///test'] }, { brief: 'x'.repeat(5001) }, { service: 'fake' }, { name: '   ' }, { examples: Array(6).fill('https://example.org') }, { budget: 'fake' }]) {
    const response = await route.POST(request({ ...valid, ...changes }));
    assert.equal(response.status, 400, JSON.stringify(changes).slice(0,100));
  }
});
test('rejects other origins and oversized bodies before contacting the email provider', async () => {
  assert.equal((await route.POST(request(valid, 'https://unrelated.example'))).status, 403);
  assert.equal((await route.POST(request({ ...valid, brief: 'x'.repeat(20001) }))).status, 413);
});
test('the honeypot does not send spam', async () => {
  assert.equal((await route.POST(request({ ...valid, fax: 'spam' }))).status, 400);
});
test('configured delivery sends fixed recipient, all answers and a safe reply address', async t => {
  process.env.CONTACT_FORM_ID = 'verified-form-id';
  process.env.CONTACT_FORM_ACTIVE = 'true';
  t.after(() => { delete process.env.CONTACT_FORM_ID; delete process.env.CONTACT_FORM_ACTIVE; });
  let destination, payload;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    destination = url; payload = JSON.parse(options.body);
    return Response.json({ success: 'true', message: 'The form was submitted successfully.' });
  });
  assert.equal((await route.POST(request({ ...valid, _cc: 'intruder@example.com', _webhook: 'https://unrelated.example' }))).status, 200);
  assert.equal(destination, 'https://formsubmit.co/ajax/verified-form-id');
  assert.equal(payload.email, 'test@example.com');
  assert.equal(payload['Bisherige Website'], 'https://example.com');
  assert.equal(payload['Beispiel-Websites'], 'https://example.org\nhttps://example.net');
  assert.equal(payload['Was daran gefällt'], 'Farben und Navigation');
  assert.equal(payload._cc, undefined);
  assert.equal(payload._webhook, undefined);
});
test('provider rejection, malformed success and network failure are never success', async t => {
  process.env.CONTACT_FORM_ID = 'verified-form-id'; process.env.CONTACT_FORM_ACTIVE = 'true';
  t.after(() => { delete process.env.CONTACT_FORM_ID; delete process.env.CONTACT_FORM_ACTIVE; });
  for (const reply of [() => Response.json({ success: 'false' }), () => Response.json({ message: 'ok' }), () => Response.json({ success: true }, { status: 500 }), () => { throw new Error('network'); }]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => reply());
    assert.equal((await route.POST(request())).status, 502);
    mock.mock.restore();
  }
});

test('a verified recipient email can be configured server-side without entering client code', async t => {
  process.env.CONTACT_FORM_ID = 'owner@example.com'; process.env.CONTACT_FORM_ACTIVE = 'true';
  t.after(() => { delete process.env.CONTACT_FORM_ID; delete process.env.CONTACT_FORM_ACTIVE; });
  let destination;
  t.mock.method(globalThis, 'fetch', async url => { destination = url; return Response.json({ success: 'true' }); });
  assert.equal((await route.POST(request())).status, 200);
  assert.equal(destination, 'https://formsubmit.co/ajax/owner%40example.com');
});

test('provider blocks can use the documented browser transport only with an anonymous form ID', async t => {
  process.env.CONTACT_FORM_ID = 'verified-form-id'; process.env.CONTACT_FORM_ACTIVE = 'true';
  t.after(() => { delete process.env.CONTACT_FORM_ID; delete process.env.CONTACT_FORM_ACTIVE; });
  t.mock.method(globalThis, 'fetch', async () => new Response('Forbidden', { status: 403 }));
  const response = await route.POST(request());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, undefined);
  assert.equal(body.browserDelivery.url, 'https://formsubmit.co/ajax/verified-form-id');
  assert.equal(body.browserDelivery.payload['Bisherige Website'], 'https://example.com');
  process.env.CONTACT_FORM_ID = 'owner@example.com';
  const privateResponse = await route.POST(request());
  assert.equal(privateResponse.status, 502);
  assert.equal((await privateResponse.text()).includes('owner@example.com'), false);
});
