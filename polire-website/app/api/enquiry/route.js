import { createHash } from 'node:crypto';

export const runtime = 'nodejs';
export const maxDuration = 30;
const MAX_BODY = 20000;
const attempts = new Map();
const limits = { name: 100, company: 150, email: 254, service: 30, otherDetails: 1000, brief: 5000, website: 1000, inspiration: 2000, budget: 40, budgetDetails: 200, timingMode: 10, timing: 200, fax: 200, lang: 2 };
const services = { new: 'Neue Website', redesign: 'Website überarbeiten', other: 'Etwas anderes / noch offen' };
const budgets = { '': 'Noch offen', 'under-3000': 'Unter CHF 3’000', '3000-5000': 'CHF 3’000–5’000', '5000-10000': 'CHF 5’000–10’000', 'over-10000': 'Über CHF 10’000' };
const reply = (error, status) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

function webUrl(value) {
  if (!value) return true;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password; } catch { return false; }
}

function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const data = {};
  for (const [key, max] of Object.entries(limits)) {
    const value = body[key] ?? '';
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return null;
    data[key] = value.trim();
  }
  if (!data.name || !data.brief || !Object.hasOwn(services, data.service) || !(Object.hasOwn(budgets, data.budget) || data.budget === 'custom')) return null;
  if (data.budget === 'custom' && !data.budgetDetails) return null;
  if (!['', 'asap', 'date'].includes(data.timingMode)) return null;
  if (data.timingMode === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(data.timing) || !Number.isFinite(Date.parse(data.timing)) || new Date(data.timing).toISOString().slice(0,10) !== data.timing)) return null;
  if (data.service !== 'other') data.otherDetails = '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || /[\r\n]/.test(body.email)) return null;
  if (data.fax || !webUrl(data.website)) return null;
  if (!Array.isArray(body.examples) || body.examples.length > 5) return null;
  if (body.examples.some(value => typeof value !== 'string' || value.length > 1000 || !webUrl(value.trim()))) return null;
  data.examples = body.examples.map(value => value.trim()).filter(Boolean);
  return data;
}

// Best-effort instance-local protection; enable a Vercel Firewall rate limit before public launch.
function rateLimited(request) {
  const ip = request.headers.get('x-vercel-forwarded-for');
  if (!ip) return false;
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const key = createHash('sha256').update(ip).digest('hex');
  const record = attempts.get(key) ?? { count: 0, until: now + 600000 };
  if (record.count >= 5 || (!attempts.has(key) && attempts.size >= 10000)) return true;
  record.count++;
  attempts.set(key, record);
  return false;
}

export async function POST(request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') || new URL(request.url).host;
  try {
    const source = new URL(origin);
    if (!['https:', 'http:'].includes(source.protocol) || source.host !== host) return reply('forbidden', 403);
  } catch { return reply('forbidden', 403); }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return reply('unsupported_media_type', 415);
  if (Number(request.headers.get('content-length')) > MAX_BODY) return reply('too_large', 413);
  let body;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply('invalid', 400);
    const chunks = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY) { await reader.cancel(); return reply('too_large', 413); }
      chunks.push(value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { return reply('invalid', 400); }
  const data = validate(body);
  if (!data) return reply('invalid', 400);
  const formId = process.env.CONTACT_FORM_ID;
  // This flag is set only after the owner confirms their mailbox and a real delivery test.
  const validDestination = /^[a-zA-Z0-9-]{8,100}$/.test(formId ?? '') || /^[a-zA-Z0-9.!#$%&'*+=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formId ?? '');
  if (process.env.CONTACT_FORM_ACTIVE !== 'true' || !validDestination || formId.length > 254) return reply('unavailable', 503);
  if (rateLimited(request)) return reply('rate_limited', 429);
  const payload = {
    name: data.name,
    email: data.email,
    Firma: data.company || 'Nicht angegeben',
    Projektart: services[data.service],
    'Weitere Angaben zur Projektart': data.otherDetails || 'Nicht angegeben',
    Wünsche: data.brief,
    'Bisherige Website': data.website || 'Nicht angegeben',
    'Beispiel-Websites': data.examples.join('\n') || 'Nicht angegeben',
    'Was daran gefällt': data.inspiration || 'Nicht angegeben',
    Budgetrahmen: data.budget === 'custom' ? data.budgetDetails : budgets[data.budget],
    'Gewünschter Start': data.timingMode === 'asap' ? 'So schnell wie möglich' : data.timing || 'Noch offen',
    Sprache: data.lang === 'en' ? 'English' : 'Deutsch',
    _subject: 'POLIRE — Neue Projektanfrage',
    _template: 'table',
    _url: 'https://polireagency.vercel.app/',
    _captcha: 'false',
  };
  try {
    const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(formId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Referer: 'https://polireagency.vercel.app/' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      console.warn('enquiry_provider_http_error', response.status, response.headers.get('content-type'));
      // FormSubmit documents direct AJAX delivery. Never disclose a private recipient address.
      if (response.status === 403 && /^[a-zA-Z0-9-]{8,100}$/.test(formId)) {
        return Response.json({ browserDelivery: { url: `https://formsubmit.co/ajax/${formId}`, payload } }, { headers: { 'Cache-Control': 'no-store' } });
      }
      return reply('delivery_failed', 502);
    }
    const result = await response.json();
    if (![true, 'true'].includes(result.success)) {
      console.warn('enquiry_provider_rejected', /activat/i.test(result.message ?? '') ? 'activation_required' : 'other');
      return reply('delivery_failed', 502);
    }
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { console.warn('enquiry_provider_exception', error.name); return reply('delivery_failed', 502); }
}
