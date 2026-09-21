import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { escapeHtml as e } from './lib.mjs';
import { designs } from './designs.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'public');
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
mkdirSync(output, { recursive: true });
for (const file of ['fonts.css','shared.css','shared.js','gallery.css','gallery.js','vercel.json','robots.txt']) copyFileSync(path.join(root,file), path.join(output,file));
mkdirSync(path.join(output,'fonts'),{recursive:true});
for (const file of readdirSync(path.join(root,'fonts')).filter(file=>/\.(woff2|txt|md)$/.test(file))) copyFileSync(path.join(root,'fonts',file),path.join(output,'fonts',file));
const leads = [];
function head(title, prefix = '') { return `<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="color-scheme" content="light dark"><meta name="description" content="POLIRE Designentwurf zur Abstimmung. Keine offizielle Firmenwebsite."><title>${e(title)} | POLIRE Entwurf</title><link rel="icon" href="data:,"><link rel="stylesheet" href="${prefix}fonts.css"><link rel="stylesheet" href="${prefix}shared.css">`; }
for (const item of manifest.leads) {
  const lead = JSON.parse(readFileSync(path.join(root,'inputs',item.slug+'.json'),'utf8'));
  const { render } = await import(`./renderers/${item.family}.mjs`);
  const page = render(lead);
  if (!page.html || !page.css) throw new Error(`Empty demo: ${item.slug}`);
  if (/<(?:html|head|body)\b/i.test(page.html)) throw new Error(`Renderer must return fragment: ${item.slug}`);
  const folder = path.join(output,'sites',item.slug); mkdirSync(folder,{recursive:true});
  const document = `${head(lead.name,'../../')}<link rel="stylesheet" href="site.css"><script src="../../shared.js" defer></script></head><body data-slug="${e(lead.slug)}"><aside class="polire-preview" aria-label="Demo-Hinweis"><a href="../../">← Alle 15 Demos</a><span>POLIRE Designentwurf</span><a href="${e(lead.website)}" target="_blank" rel="noopener noreferrer">Original ansehen ↗</a></aside>${page.html}<div class="polire-demo-note">Designentwurf von POLIRE. Keine offizielle Website. Kontaktaktionen sind in dieser Vorschau deaktiviert.</div><dialog class="polire-dialog" aria-labelledby="demo-dialog-title"><h2 id="demo-dialog-title">So könnte die Kontaktaufnahme aussehen.</h2><p>Dies ist eine Designvorschau für ${e(lead.name)}. Es wird keine Anfrage versendet und kein Anruf gestartet.</p><p class="phone">${e(lead.phone)}</p><small>Kontaktangabe aus der Original-Website. Aktuelle Erreichbarkeit bitte separat bestätigen.</small><button type="button" data-close-demo>Zurück zur Demo</button></dialog></body></html>`;
  writeFileSync(path.join(folder,'index.html'),document.replace('loading="lazy"','loading="eager" fetchpriority="high"').replace(/[\t ]+$/gm,'').replaceAll('ß','ss').replaceAll('—','-').replaceAll('–','-'));
  writeFileSync(path.join(folder,'site.css'),page.css);
  for (const asset of lead.assets) { const target=path.join(output,asset.path);mkdirSync(path.dirname(target),{recursive:true});copyFileSync(path.join(root,asset.path),target); }
  leads.push(lead);
}
const labels = { wood:'Holz & Schreinerei', places:'Garten & Handwerk', 'salon-dining':'Salons & Restaurants' };
const holidayNotes = { seiler:'Betriebsferien bis 5. Oktober 2026', wacker:'Betriebsferien bis 12. Oktober 2026', 'hairstudio-f':'Ferienhinweis: 24. bis 26. September 2026', holiday:'Ferienhinweis: 24. September bis 12. Oktober 2026' };
const cards = leads.map(lead => {
  const design = designs[lead.slug];
  if (!design) throw new Error(`Missing design description: ${lead.slug}`);
  const uncertain = !lead.activity || ['uncertain','unverified','unknown'].includes(lead.activity.status ?? lead.activity.activityAssessment);
  const quality = typeof lead.quality === 'number' && Number.isFinite(lead.quality) && lead.quality >= 0 && lead.quality <= 100 ? Math.round(lead.quality) + ' von 100' : 'Noch nicht bewertbar';
  const thumb = `thumbnails/${lead.slug}.png`;
  const holidayNote = holidayNotes[lead.slug];
  const image = existsSync(path.join(output,thumb)) ? thumb : lead.assets.find(a=>a.width>300 && a.height>180)?.path;
  return `<article class="demo-card" data-family="${e(lead.family)}">
    <a class="thumb-link" href="sites/${e(lead.slug)}/" aria-label="Demo ${e(lead.name)} öffnen">${image ? `<img src="${e(image)}" alt="Neuer Entwurf für ${e(lead.name)}" loading="lazy" width="1440" height="960">` : `<span>${e(lead.name)}</span>`}</a>
    <p class="card-meta">${e(lead.locality)} · ${e(labels[lead.family])}</p>
    <h2><a href="sites/${e(lead.slug)}/">${e(lead.name)}</a></h2>
    <p class="card-concept">${e(design.title)}</p><p class="card-description">${e(design.description)}</p>
    <div class="card-actions"><a class="open-demo" href="sites/${e(lead.slug)}/">Neuen Entwurf öffnen ↗</a><a href="${e(lead.website)}" target="_blank" rel="noopener noreferrer">Original vergleichen</a></div>
    <div class="card-review"><p class="card-score"><span>Qualität der bisherigen Website</span><strong>${e(quality)}</strong></p>
    ${lead.issues[0] ? `<p class="card-finding">${e(lead.issues[0].observation)}</p>` : ''}
    <p class="card-next">${uncertain ? 'Nächster Schritt: aktuellen Betrieb klären.' : 'Nächster Schritt: Betrieb, Bedarf und Interesse persönlich klären.'}</p></div>
    ${uncertain ? '<p class="activity-warning">Betriebsstatus noch offen</p>' : ''}${holidayNote ? `<p class="activity-warning">${e(holidayNote)}</p>` : ''}
    <details><summary>Review und Quellen</summary><ul>${lead.issues.slice(0,3).map(issue=>`<li>${e(issue.observation)}</li>`).join('')}</ul><p>${e(lead.activity?.finding ?? lead.activity?.limitation ?? 'Heutige Erreichbarkeit nicht bestätigt.')}</p>${lead.activity?.sourceUrl ? `<a href="${e(lead.activity.sourceUrl)}" target="_blank" rel="noopener noreferrer">Aktivitätsquelle öffnen</a>` : ''}<p>Telefon: ${e(lead.phone)}</p><p>Die Demo zeigt eine Gestaltungsrichtung. Inhalte und Bildrechte müssen vor einer Veröffentlichung mit der Firma abgestimmt werden.</p></details>
  </article>`;
}).join('');
writeFileSync(path.join(output,'index.html'),`${head('15 neue Firmenauftritte')}
<link rel="stylesheet" href="gallery.css"><script src="gallery.js" defer></script></head><body><div class="gallery">
<header class="gallery-header"><a class="brand" href="./">POLIRE</a><span>15 überarbeitete Entwürfe<br>21. September 2026</span></header>
<main><section class="gallery-intro"><h1>Eigene Firma.<br><em>Eigener Auftritt.</em></h1><div class="intro-copy"><p>15 Firmen, neu gedacht. Unterschiedliche Konzepte, eigene Seitenaufbauten und ein klarer Blick auf das jeweilige Geschäft.</p><a href="#entwuerfe">Alle Entwürfe ansehen ↓</a></div></section>
<section class="score-guide" aria-label="Bewertung verstehen"><h2>Die Zahl gehört zur bisherigen Website.</h2><p><strong>0 = sehr schwach. 100 = sehr gut.</strong> Die gerundeten Werte stammen aus den gespeicherten Reviews. Sie bewerten weder die neue Demo noch Kaufinteresse oder Budget. Nicht geprüfte Bereiche bleiben offen.</p></section>
<div class="filter-row" id="entwuerfe"><div class="filters" aria-label="Demos filtern"><button type="button" data-filter="all" aria-pressed="true">Alle 15</button>${Object.entries(labels).map(([key,label])=>`<button type="button" data-filter="${key}" aria-pressed="false">${e(label)}</button>`).join('')}</div><p data-count aria-live="polite">15 Entwürfe sichtbar</p></div>
<section class="demo-grid" aria-label="Website-Entwürfe">${cards}</section></main>
<footer class="gallery-footer"><p>POLIRE Designentwürfe zur Abstimmung. Keine offiziellen Firmenwebsites. Die Kontaktschaltflächen zeigen nur eine Vorschau; es werden keine Anfragen versendet.</p><p>Die Auswahl umfasst 15 bereits vorgestellte Websites mit konkreten Schwächen. Inhalte, aktueller Betrieb und Bildrechte müssen vor einem Kundenprojekt abgestimmt werden. Offene Betriebsprüfungen bleiben gekennzeichnet.</p></footer>
</div></body></html>`.replace(/[\t ]+$/gm,'').replaceAll('ß','ss').replaceAll('—','-').replaceAll('–','-'));
process.stdout.write(`Built ${leads.length} demos and gallery.\n`);
