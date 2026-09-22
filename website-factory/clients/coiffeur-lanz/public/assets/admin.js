const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = { csrf: '', content: null, revision: null, inquiries: [], analytics: {}, operations: {}, tab: 'overview', filter: 'all', dirty: false, articleDirty: false, selectedArticle: null };
const titles = { overview: 'Übersicht', content: 'Inhalte', journal: 'Journal', inquiries: 'Anfragen', operations: 'Betrieb' };

function announce(message, kind = 'info') {
  const target = $('#global-message');
  target.textContent = message;
  target.className = `message ${kind}`;
  target.hidden = !message;
  $('#live-status').textContent = message;
}
function errorText(error) {
  if (error?.status === 409) return 'Die Website wurde zwischenzeitlich geändert. Laden Sie die Seite neu und prüfen Sie Ihre Änderungen.';
  if (error?.status === 401) return 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.';
  return error?.message || 'Das hat nicht funktioniert. Bitte versuchen Sie es erneut.';
}
async function request(path, { method = 'GET', body, download = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && state.csrf) headers['X-CSRF-Token'] = state.csrf;
  const response = await fetch(path, { method, credentials: 'same-origin', headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  if (!response.ok) {
    let detail = {};
    try { detail = await response.json(); } catch { /* A server error can return no JSON. */ }
    const error = new Error(detail.error || `Anfrage fehlgeschlagen (${response.status}).`);
    error.status = response.status;
    error.fields = detail.fields;
    if (response.status === 401 && path !== '/api/login' && path !== '/api/session') {
      state.csrf = '';
      state.content = null;
      state.dirty = false;
      state.articleDirty = false;
      showLogin();
      $('#login-error').textContent = 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.';
      $('#login-error').hidden = false;
    }
    throw error;
  }
  return download ? response : response.status === 204 ? null : response.json();
}
function setBusy(button, busy, label = 'Bitte warten …') {
  if (!button) return;
  if (busy) { button.dataset.previousLabel = button.textContent; button.textContent = label; button.disabled = true; }
  else { button.textContent = button.dataset.previousLabel || button.textContent; button.disabled = false; }
}
function node(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = String(value);
  return element;
}
function clear(element) { element.replaceChildren(); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '–' : new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: 'long', year: 'numeric' }).format(date); }
function count(value) { return new Intl.NumberFormat('de-CH').format(Number(value) || 0); }
function articleId() { return globalThis.crypto?.randomUUID?.() || `artikel-${Date.now()}`; }
function slugify(value) { return value.toLocaleLowerCase('de-CH').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80); }
function canLeave() { return !(state.dirty || state.articleDirty) || confirm('Es gibt ungespeicherte Änderungen. Möchten Sie sie verwerfen?'); }
function markDirty(article = false) {
  if (article) state.articleDirty = true;
  else { state.dirty = true; $('#content-save-state').textContent = 'Ungespeicherte Änderungen'; }
}
function showLogin() { $('#login-view').hidden = false; $('#app-view').hidden = true; $('#password').focus(); }
function showApp() { $('#login-view').hidden = true; $('#app-view').hidden = false; }

async function refreshState() {
  const data = await request('/api/admin/state');
  state.content = data.content || {};
  state.revision = data.revision;
  state.inquiries = data.inquiries || [];
  state.analytics = data.analytics || {};
  state.operations = data.operations || {};
  state.dirty = false;
  state.articleDirty = false;
  state.selectedArticle = null;
  renderAll();
}
function switchTab(tab) {
  if (!titles[tab] || (tab !== state.tab && !canLeave())) return;
  if (tab !== state.tab && state.dirty) { fillContent(); state.dirty = false; }
  if (tab !== state.tab && state.articleDirty) { state.articleDirty = false; state.selectedArticle = null; renderJournal(); }
  state.tab = tab;
  $$('.panel').forEach((panel) => { panel.hidden = panel.id !== `panel-${tab}`; });
  $$('[data-tab]').forEach((button) => {
    if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('#topbar-label').textContent = titles[tab];
  $('#mobile-nav').hidden = true;
  $('#menu-toggle').setAttribute('aria-expanded', 'false');
  announce('');
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function renderAll() { fillContent(); renderOverview(); renderJournal(); renderInquiries(); renderOperations(); }

function fillContent() {
  const content = state.content || {};
  for (const control of $$('#content-form [name]')) {
    const parts = control.name.split('.');
    control.value = String(parts.length === 2 ? content[parts[0]]?.[parts[1]] ?? '' : content[control.name] ?? '');
  }
  const hours = $('#hours-fields'); clear(hours);
  for (const [index, row] of (content.hours || []).entries()) {
    const label = node('label', '', row.day || `Tag ${index + 1}`);
    const input = node('input'); input.type = 'text'; input.maxLength = 100; input.value = row.hours || ''; input.dataset.hourIndex = index;
    input.addEventListener('input', () => markDirty()); label.append(input); hours.append(label);
  }
  const preview = $('#hero-preview');
  if (content.heroImage) { preview.src = content.heroImage; preview.hidden = false; }
  else { preview.removeAttribute('src'); preview.hidden = true; }
  $('#hero-file').value = '';
  $('#hero-file-name').textContent = 'Kein neues Bild ausgewählt';
  $('#content-save-state').textContent = 'Alle Änderungen gespeichert';
}
function readContent() {
  const next = structuredClone(state.content);
  for (const control of $$('#content-form [name]')) {
    const parts = control.name.split('.');
    if (parts.length === 2) { next[parts[0]] ||= {}; next[parts[0]][parts[1]] = control.value.trim(); }
    else next[control.name] = control.value.trim();
  }
  next.hours = (next.hours || []).map((row, index) => ({ ...row, hours: $(`[data-hour-index="${index}"]`)?.value.trim() ?? row.hours }));
  return next;
}
async function persistContent(content) {
  const result = await request('/api/admin/content', { method: 'PUT', body: { content, revision: state.revision } });
  state.content = content;
  state.revision = result.revision;
  state.dirty = false;
  state.articleDirty = false;
  return result;
}
async function saveContent(button) {
  if (!$('#content-form').reportValidity()) return;
  setBusy(button, true, 'Speichern …');
  try {
    await persistContent(readContent());
    $('#content-save-state').textContent = 'Alle Änderungen gespeichert';
    announce('Ihre Änderungen wurden gespeichert.', 'success');
  } catch (error) { announce(errorText(error), 'error'); }
  finally { setBusy(button, false); }
}
async function uploadHero(file) {
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { announce('Bitte wählen Sie ein PNG-, JPG- oder WebP-Bild bis 2 MB.', 'error'); $('#hero-file').value = ''; return; }
  $('#hero-file-name').textContent = `Bild wird hochgeladen: ${file.name}`;
  try {
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    const result = await request('/api/admin/media', { method: 'POST', body: { name: file.name, type: file.type, data } });
    state.content.heroImage = result.url;
    $('#hero-preview').src = result.url;
    $('#hero-preview').hidden = false;
    $('#hero-file-name').textContent = `${file.name} hochgeladen. Bitte Änderungen speichern.`;
    markDirty();
  } catch (error) { $('#hero-file-name').textContent = 'Upload fehlgeschlagen'; announce(errorText(error), 'error'); }
}
function renderOverview() {
  const analytics = state.analytics;
  $('#stat-views').textContent = count(analytics.pageviews);
  $('#stat-visitors').textContent = count(analytics.visitors);
  const fresh = state.inquiries.filter((item) => item.status === 'new');
  $('#stat-inquiries').textContent = count(fresh.length);
  const pages = $('#top-pages'); clear(pages);
  if (!analytics.pages?.length) pages.append(node('p', 'empty', 'Noch keine Seitenaufrufe in diesem Monat.'));
  else analytics.pages.slice(0, 5).forEach((page) => { const line = node('div', 'data-row'); line.append(node('span', '', page.path), node('strong', '', count(page.views))); pages.append(line); });
  const recent = $('#recent-inquiries'); clear(recent);
  if (!state.inquiries.length) recent.append(node('p', 'empty', 'Noch keine Anfragen eingegangen.'));
  else state.inquiries.slice(0, 4).forEach((item) => { const line = node('div', 'data-row'); const meta = node('span'); meta.append(node('strong', '', item.name), node('small', '', formatDate(item.createdAt))); line.append(meta, node('span', 'small', item.status === 'new' ? 'Neu' : 'Erledigt')); recent.append(line); });
  const review = state.operations.stage !== 'production';
  $('#review-note').hidden = !review;
  $('#review-note').textContent = review ? 'Ihre Website befindet sich im Prüfmodus. Kontaktanfragen werden im Kundenbereich gesammelt; es werden noch keine E-Mails versendet.' : '';
  $('#stage-chip').textContent = review ? 'Prüfmodus' : 'Online';
}
function renderJournal() {
  const list = $('#article-list'); clear(list);
  const articles = state.content.articles || [];
  if (!articles.length) list.append(node('p', 'empty', 'Noch keine Beiträge. Starten Sie mit einem Entwurf aus Ihrem Salon.'));
  for (const article of articles) {
    const button = node('button', 'article-row'); button.type = 'button';
    button.append(node('strong', '', article.title || 'Ohne Titel'), node('small', '', `${article.status === 'published' ? 'Veröffentlicht' : 'Entwurf'} · ${article.date ? formatDate(article.date) : 'Ohne Datum'}`));
    button.addEventListener('click', () => editArticle(article.id)); list.append(button);
  }
  if (state.selectedArticle && !articles.some((article) => article.id === state.selectedArticle)) state.selectedArticle = null;
  if (!state.selectedArticle) $('#article-editor-card').hidden = true;
}
function editArticle(id) {
  if (!canLeave()) return;
  state.articleDirty = false;
  state.selectedArticle = id;
  const article = (state.content.articles || []).find((item) => item.id === id);
  const form = $('#article-form');
  for (const control of form.elements) if (control.name) control.value = article?.[control.name] || '';
  $('#article-editor-title').textContent = article ? 'Beitrag bearbeiten' : 'Neuer Beitrag';
  $('#delete-draft').hidden = !article || article.status !== 'draft';
  $('#article-editor-card').hidden = false;
  form.elements.title.focus();
}
async function saveArticle(status, button) {
  const form = $('#article-form');
  if (!form.reportValidity()) return;
  if (status === 'published' && form.elements.body.value.trim().length < 20) { announce('Zum Veröffentlichen braucht der Beitrag einen vollständigen Text mit mindestens 20 Zeichen.', 'error'); form.elements.body.focus(); return; }
  const current = (state.content.articles || []).find((item) => item.id === state.selectedArticle);
  const title = form.elements.title.value.trim();
  const existingSlugs = new Set((state.content.articles || []).map((item) => item.slug));
  const baseSlug = slugify(title) || 'beitrag';
  let slug = current?.slug || baseSlug;
  if (!current) for (let suffix = 2; existingSlugs.has(slug); suffix += 1) slug = `${baseSlug}-${suffix}`;
  const article = { ...current, id: current?.id || articleId(), slug, title, excerpt: form.elements.excerpt.value.trim(), body: form.elements.body.value.trim(), status, date: form.elements.date.value || new Date().toISOString().slice(0, 10) };
  const content = structuredClone(state.content);
  content.articles ||= [];
  const index = content.articles.findIndex((item) => item.id === article.id);
  if (index < 0) content.articles.push(article); else content.articles[index] = article;
  setBusy(button, true, 'Speichern …');
  try { await persistContent(content); state.selectedArticle = article.id; renderJournal(); announce(status === 'published' ? 'Der Beitrag ist veröffentlicht.' : 'Der Entwurf ist gespeichert.', 'success'); }
  catch (error) { announce(errorText(error), 'error'); }
  finally { setBusy(button, false); }
}
async function deleteDraft() {
  const article = (state.content.articles || []).find((item) => item.id === state.selectedArticle);
  if (!article || article.status !== 'draft' || !confirm('Diesen Entwurf endgültig entfernen?')) return;
  const content = structuredClone(state.content);
  content.articles = content.articles.filter((item) => item.id !== article.id);
  const button = $('#delete-draft'); setBusy(button, true);
  try { await persistContent(content); state.selectedArticle = null; renderJournal(); announce('Der Entwurf wurde entfernt.', 'success'); }
  catch (error) { announce(errorText(error), 'error'); }
  finally { setBusy(button, false); }
}
function renderInquiries() {
  const list = $('#inquiry-list'); clear(list);
  const fresh = state.inquiries.filter((item) => item.status === 'new').length;
  $('#inquiry-badge').hidden = !fresh; $('#inquiry-badge').textContent = String(fresh);
  const visible = state.inquiries.filter((item) => state.filter === 'all' || item.status === state.filter);
  if (!visible.length) { list.append(node('p', 'card empty', state.filter === 'all' ? 'Noch keine Anfragen. Neue Nachrichten erscheinen hier.' : 'Keine Anfragen in dieser Ansicht.')); return; }
  for (const item of visible) {
    const card = node('article', `card inquiry ${item.status === 'new' ? 'unread' : ''}`);
    const heading = node('div', 'inquiry-heading'); const title = node('div');
    title.append(node('h2', '', item.name), node('small', '', `${formatDate(item.createdAt)} · ${item.status === 'new' ? 'Neu' : 'Erledigt'}`)); heading.append(title); card.append(heading);
    card.append(node('p', 'inquiry-message', item.message));
    const details = node('div', 'inquiry-details');
    if (item.email) { const email = node('a', '', item.email); email.href = `mailto:${encodeURIComponent(item.email)}`; details.append(email); }
    if (item.phone) { const phone = node('a', '', item.phone); phone.href = `tel:${item.phone.replace(/[^+\d]/g, '')}`; details.append(phone); }
    card.append(details);
    const actions = node('div', 'button-row');
    const status = node('button', 'button secondary', item.status === 'new' ? 'Als erledigt markieren' : 'Wieder öffnen'); status.type = 'button'; status.addEventListener('click', () => updateInquiry(item.id, item.status === 'new' ? 'done' : 'new', status));
    const remove = node('button', 'button danger', 'Löschen'); remove.type = 'button'; remove.addEventListener('click', () => deleteInquiry(item.id, remove)); actions.append(status, remove); card.append(actions); list.append(card);
  }
}
async function updateInquiry(id, status, button) {
  setBusy(button, true);
  try { await request(`/api/admin/inquiries/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } }); const item = state.inquiries.find((entry) => String(entry.id) === String(id)); if (item) item.status = status; renderInquiries(); renderOverview(); announce('Anfrage aktualisiert.', 'success'); }
  catch (error) { announce(errorText(error), 'error'); setBusy(button, false); }
}
async function deleteInquiry(id, button) {
  if (!confirm('Diese Anfrage endgültig löschen?')) return;
  setBusy(button, true);
  try { await request(`/api/admin/inquiries/${encodeURIComponent(id)}`, { method: 'DELETE' }); state.inquiries = state.inquiries.filter((item) => String(item.id) !== String(id)); renderInquiries(); renderOverview(); announce('Anfrage gelöscht.', 'success'); }
  catch (error) { announce(errorText(error), 'error'); setBusy(button, false); }
}
function renderOperations() {
  const operations = state.operations;
  const warnings = [];
  if (Number(operations.pendingDeliveries) > 0) warnings.push(`${count(operations.pendingDeliveries)} Anfrage${Number(operations.pendingDeliveries) === 1 ? '' : 'n'} konnte${Number(operations.pendingDeliveries) === 1 ? '' : 'n'} nicht per E-Mail zugestellt werden. Die Nachricht${Number(operations.pendingDeliveries) === 1 ? ' ist' : 'en sind'} im Bereich Anfragen gespeichert.`);
  if (operations.maintenanceError) warnings.push('Die automatische Wartung meldet ein Problem. Bitte den Website-Betreiber informieren.');
  $('#operations-warning').textContent = warnings.join(' ');
  $('#operations-warning').hidden = !warnings.length;
  $('#backup-summary').textContent = operations.lastBackup ? `Letzte Sicherung: ${formatDate(operations.lastBackup)}` : 'Noch keine Sicherung vorhanden.';
  const backups = $('#backup-list'); clear(backups);
  if (!operations.backups?.length) backups.append(node('p', 'empty', 'Sicherungen werden hier angezeigt.'));
  else operations.backups.slice(0, 8).forEach((backup) => { const row = node('div', 'data-row'); row.append(node('span', '', backup.name), node('small', '', formatDate(backup.createdAt))); backups.append(row); });
  const checks = $('#launch-checks'); clear(checks);
  if (!operations.launchChecks?.length) checks.append(node('p', 'empty', 'Keine Prüfpunkte verfügbar.'));
  else operations.launchChecks.forEach((check) => { const row = node('div', 'check-row'); row.append(node('span', check.ready ? 'check ready' : 'check pending', check.ready ? '✓' : '○'), node('span', '', check.label)); checks.append(row); });
  $('#report-month').value ||= new Date().toISOString().slice(0, 7);
}
async function download(path, fallback) {
  const response = await request(path, { download: true });
  const blob = await response.blob(); const objectURL = URL.createObjectURL(blob);
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
  const link = node('a'); link.href = objectURL; link.download = match ? decodeURIComponent(match[1].replace(/"/g, '')) : fallback;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(objectURL), 60000);
}
async function createBackup(button) {
  setBusy(button, true, 'Sichern …');
  try { const result = await request('/api/admin/backup', { method: 'POST', body: {} }); await refreshState(); announce(`Sicherung ${result.name} erstellt.`, 'success'); }
  catch (error) { announce(errorText(error), 'error'); }
  finally { setBusy(button, false); }
}
async function boot() {
  try { const session = await request('/api/session'); if (!session.authenticated) { showLogin(); return; } state.csrf = session.csrfToken; showApp(); await refreshState(); switchTab('overview'); }
  catch (error) { showLogin(); $('#login-error').textContent = errorText(error); $('#login-error').hidden = false; }
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const button = event.currentTarget.querySelector('button'); setBusy(button, true, 'Anmelden …'); $('#login-error').hidden = true;
  try { const result = await request('/api/login', { method: 'POST', body: { password: $('#password').value } }); state.csrf = result.csrfToken; $('#password').value = ''; showApp(); await refreshState(); switchTab('overview'); }
  catch (error) { $('#login-error').textContent = errorText(error); $('#login-error').hidden = false; }
  finally { setBusy(button, false); }
});
$('#logout').addEventListener('click', async () => { if (!canLeave()) return; try { await request('/api/logout', { method: 'POST', body: {} }); } catch { /* End the local session even if the server is unreachable. */ } state.csrf = ''; state.content = null; state.dirty = false; state.articleDirty = false; showLogin(); });
$$('[data-tab]').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));
$('#menu-toggle').addEventListener('click', () => { const nav = $('#mobile-nav'); nav.hidden = !nav.hidden; $('#menu-toggle').setAttribute('aria-expanded', String(!nav.hidden)); });
$('#content-form').addEventListener('input', () => markDirty());
$('#content-form').addEventListener('submit', (event) => { event.preventDefault(); saveContent(event.submitter); });
$$('.save-content').filter((button) => !button.closest('form')).forEach((button) => button.addEventListener('click', () => saveContent(button)));
$('#hero-file').addEventListener('change', (event) => uploadHero(event.target.files?.[0]));
$('.file-label').addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $('#hero-file').click(); } });
$('#new-article').addEventListener('click', () => editArticle(null));
$('#article-form').addEventListener('input', () => markDirty(true));
$('#article-form').addEventListener('submit', (event) => { event.preventDefault(); saveArticle(event.submitter?.dataset.status || 'draft', event.submitter); });
$('#delete-draft').addEventListener('click', deleteDraft);
$$('[data-filter]').forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.filter; $$('[data-filter]').forEach((item) => item.classList.toggle('active', item === button)); renderInquiries(); }));
$('#refresh-inquiries').addEventListener('click', async () => { if (!canLeave()) return; try { await refreshState(); announce('Daten aktualisiert.', 'success'); } catch (error) { announce(errorText(error), 'error'); } });
$('#create-backup').addEventListener('click', (event) => createBackup(event.currentTarget));
$('#download-content').addEventListener('click', async () => { try { await download('/api/admin/export', 'coiffeur-lanz-inhalte.json'); } catch (error) { announce(errorText(error), 'error'); } });
$('#download-report').addEventListener('click', async () => { const month = $('#report-month').value; if (!month) { announce('Bitte wählen Sie einen Monat.', 'error'); return; } try { await download(`/api/admin/report?month=${encodeURIComponent(month)}`, `coiffeur-lanz-bericht-${month}.json`); } catch (error) { announce(errorText(error), 'error'); } });
window.addEventListener('beforeunload', (event) => { if (state.dirty || state.articleDirty) { event.preventDefault(); event.returnValue = ''; } });
boot();
