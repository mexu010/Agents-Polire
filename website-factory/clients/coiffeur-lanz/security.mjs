import { randomBytes, createHmac, timingSafeEqual, scrypt as derive } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(derive);
export const randomToken = () => randomBytes(32).toString('base64url');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const [, salt, hash] = encoded.split(':');
  const derived = await scrypt(password, salt, 64);
  return safeEqual(derived.toString('hex'), hash);
}
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export const digest = (secret, input) => createHmac('sha256', secret).update(input).digest('hex');
export function issueFormToken(secret, time) { const token = randomToken(); return `${token}.${digest(secret, `${time}:${token}`)}`; }
export function validFormToken(secret, token, time, minAge = 2000) {
  if (typeof token !== 'string' || !/^[-_a-zA-Z0-9]{43}\.[a-f0-9]{64}$/.test(token)) return false;
  const age = Date.now() - Number(time);
  return Number.isSafeInteger(Number(time)) && age >= minAge && age < 2 * 60 * 60 * 1000 && safeEqual(token.split('.')[1], digest(secret, `${time}:${token.split('.')[0]}`));
}
export function httpError(status, message, fields) { const err = new Error(message); err.status = status; err.fields = fields; return err; }

const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
export function validateContent(c) {
  const text = (value, max, required = true) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0) && ![...value].some(char => char.charCodeAt(0) < 32 && !'\t\n\r'.includes(char));
  const fail = () => { throw httpError(400, 'Bitte die Inhalte und Feldlängen prüfen.'); };
  if (!object(c) || JSON.stringify(c).length > 140000 || !object(c.business)) fail();
  for (const key of ['name', 'person', 'street', 'postalCode', 'city', 'phone', 'mobile', 'email']) if (!text(c.business[key], 160, key !== 'mobile')) fail();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c.business.email)) fail();
  for (const key of ['phone', 'mobile']) if (c.business[key] && !/^[+()\d /-]{6,30}$/.test(c.business[key])) fail();
  for (const [key, fields] of [['home', ['eyebrow', 'headline', 'intro']], ['salon', ['headline', 'intro']], ['visit', ['intro']], ['contact', ['intro']]]) {
    if (!object(c[key])) fail();
    for (const field of fields) if (!text(c[key][field], field === 'intro' ? 2000 : 160)) fail();
  }
  if (!text(c.notice, 600, false) || !text(c.heroAlt, 300, false)) fail();
  if (!/^\/assets\/(?:uploads\/)?[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|svg)$/.test(c.heroImage)) fail();
  if (!Array.isArray(c.hours) || c.hours.length < 1 || c.hours.length > 7 || c.hours.some(h => !object(h) || !text(h.day, 20) || !text(h.hours, 100))) fail();
  if (!Array.isArray(c.articles) || c.articles.length > 100) fail();
  const slugs = new Set(), ids = new Set();
  for (const a of c.articles) {
    if (!object(a) || !text(a.id, 80) || !/^[a-z0-9-]{1,100}$/.test(a.slug) || !text(a.title, 160) || !text(a.excerpt, 500, false) || !text(a.body, 20000, false) || !['draft', 'published'].includes(a.status)) fail();
    if (!(a.status === 'draft' && a.date === '') && (!/^\d{4}-\d{2}-\d{2}$/.test(a.date) || !Number.isFinite(Date.parse(a.date)) || new Date(a.date).toISOString().slice(0,10) !== a.date)) fail();
    if (a.status === 'published' && a.body.trim().length < 20) throw httpError(400, 'Veröffentlichte Beiträge benötigen einen vollständigen Text.');
    if (slugs.has(a.slug) || ids.has(a.id)) throw httpError(400, 'Beitragsadressen und IDs müssen eindeutig sein.');
    slugs.add(a.slug); ids.add(a.id);
  }
  if (c.legal !== undefined) {
    if (!object(c.legal)) fail();
    for (const key of ['hostingProvider', 'hostingCountry', 'privacyContact', 'additionalPrivacy']) if (!text(c.legal[key], key === 'additionalPrivacy' ? 4000 : 250, false)) fail();
  }
  return structuredClone(c);
}

export function validateContact(body) {
  const b = body ?? {}, fields = {};
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  const phone = typeof b.phone === 'string' ? b.phone.trim() : '';
  const message = typeof b.message === 'string' ? b.message.trim() : '';
  if (name.length < 2 || name.length > 100 || /[\r\n]/.test(name)) fields.name = 'Bitte Ihren Namen eintragen (2–100 Zeichen).';
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 254) fields.email = 'Bitte eine gültige E-Mail-Adresse eintragen.';
  if (phone && !/^[+()\d /-]{6,30}$/.test(phone)) fields.phone = 'Bitte die Telefonnummer prüfen.';
  if (message.length < 10 || message.length > 3000) fields.message = 'Bitte 10–3000 Zeichen schreiben.';
  if (b.consent !== true) fields.consent = 'Bitte den Datenschutzhinweis bestätigen.';
  if (Object.keys(fields).length) throw httpError(400, 'Bitte die markierten Felder prüfen.', fields);
  return { name, email, phone, message };
}
