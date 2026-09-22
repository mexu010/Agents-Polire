# Coiffeur Lanz Business – Implementation Plan

> Execute with subagent-driven-development. User selected Lanz fully; proceed without another scope approval.

**Goal:** Complete working Business CHF 279/month customer website, beyond the existing single-page demonstration.
**Architecture:** Isolated `clients/coiffeur-lanz/` application within Factory; server-rendered semantic HTML, progressive JS, Node 24 and built-in SQLite. Persistent local data and portable Docker deployment with persistent volume. No paid APIs or new infrastructure accounts. Existing POLIRE website and public demo gallery remain intact.
**Spec:** This document contains the approved scope and implementation contract.

## Scope and constraints
- Six content page types: home, salon, visit, contact, journal overview and journal article; legal pages extra.
- Individual cool blue/slate salon design using existing logo and local licensed fonts. No fake salon photos, staff, testimonials, services, prices or awards. Decorative imagery identified in asset provenance.
- Verified identity: Coiffeur Lanz, Vreni Lanz, Eichi 20, 3368 Bleienbach, 062 922 31 82, 079 713 62 32, info@coiffeurlanz.ch.
- Hours from https://www.coiffeurlanz.ch/html/offnungszeiten.html on 2026-09-22: Mon closed, Tue13:30–18:30, Wed closed, Thu/Fri13:30–18:30, Sat08:15–12:00. Sunday omitted/confirm. Expired vacation notice not included.
- Contact corroboration https://www.bleienbach.ch/leben/gewerbe. No actual salon contact or email dispatch in this task.
- Authenticated single-editor CMS, durable contact inbox, aggregate visitor statistics, journal draft/publish, daily database backups with retention, operational checks and monthly reporting.
- Review mode by default: noindex, clear form-only test notice, no real email delivery. Production requires explicit owner approval, domain, verified recipient/mail credentials and legal operator facts. This is an operational prerequisite, not a reason to leave implementation unfinished.
- No invented published journal entries. Provide three unpublished editorial draft prompts for customer content.
- German ss and äöü. Keep secret/data/runtime files excluded from Git. Existing feature branch is suitable; client directory isolates source changes.

## Shared contracts
`content.mjs` exports `initialContent` object, containing `business` (name,person,street,postalCode,city,phone,mobile,email), `home` (eyebrow,headline,intro), `salon` (headline,intro), `visit` (intro), `contact` (intro), `hours` array of {day,hours}, `notice` string, `heroImage` asset path, `heroAlt` string, `articles` array of {id,slug,title,excerpt,body,status,date}. Body is plain text, escaped on render; articles status draft|published. May add documented fields consistently.
`render.mjs` exports `renderPage(pathname, content, {origin,stage,nonce,formToken,formStartedAt})` returning `{status,html}`. Routes `/`, `/salon/`, `/besuch/`, `/kontakt/`, `/journal/`, `/journal/:slug/`, `/impressum/`, `/datenschutz/`, unmatched404. All asset URLs `/assets/...`. Server injects settings including form token and stage; renderer owns meta/JSON-LD.
`admin.mjs` exports `renderAdmin()` returning complete HTML shell using `/assets/admin.css` and `/assets/admin.js`.
JSON API uses same-origin POST/PATCH (reject missing/wrong Origin) and authenticated double-submit `X-CSRF-Token` for admin mutations. Session cookie HttpOnly SameSite=Strict. Login endpoint excepted from session CSRF but requires Origin.
- `GET /api/session` => `{authenticated,csrfToken?}`
- `POST /api/login` `{password}` => `{authenticated:true,csrfToken}`
- `POST /api/logout` => `{ok:true}`
- `GET /api/admin/state` => `{content,revision,inquiries,analytics,operations}`
- `PUT /api/admin/content` `{content,revision}` => `{ok:true,revision}`;409 conflict. All content validated, no raw HTML.
- `PATCH /api/admin/inquiries/:id` `{status:'new'|'done'}` => `{ok:true}`
- `DELETE /api/admin/inquiries/:id` => `{ok:true}`
- `POST /api/admin/backup` => `{ok:true,name}`
- `GET /api/admin/report?month=YYYY-MM` => downloadable JSON real monthly report.
- `GET /api/admin/export` => downloadable JSON current content (no passwords, no inquiries).
- `POST /api/admin/media` JSON `{name,type,data}` base64 raster PNG/JPEG/WebP <=2MB; returns `{url}`. Validate magic bytes, serve with nosniff.
- `POST /api/contact` `{name,email,phone,message,consent,website,formToken,formStartedAt}` =>201 `{ok:true,reference,delivery:'review'|'inbox'|'sent'}`. website honeypot; max limits; rate limiting; signed time token; no false sent states.
- `POST /api/view` `{path,referrer}` =>204, honour DNT/GPC, no raw IP or UA stored; only allow public route page counters, short-lived daily hash for approximate visitors; no external scripts.
- `GET /healthz` => minimal status without internal paths.
All errors `{error,fields?}`. `analytics` => `{pageviews,visitors,pages:[{path,views}],days:[{date,views,visitors}],referrers:[{host,views}]}` for current calendar month; `operations` => `{stage,mailConfigured,lastBackup,uptimeSeconds,monthlyReport,launchChecks:[{label,ready}],backups:[{name,createdAt}]}`. Inquiry objects id,name,email,phone,message,createdAt,status,delivery.

## Tasks
- [x] 1. Public site: research visual references, original design, content, all page templates, mobile menu and validated form UX. Owner frontend subagent. Files content.mjs/render.mjs/public/assets/site.css/site.js and copied fonts/logo. Test structure and interaction.
- [x] 2. Protected editor: login, editable content/notice/hours/media, journal authoring, inquiry inbox/status/delete, actual analytics, reports/backups. Owner admin subagent. Files admin.mjs/public/assets/admin.*. Test via integration once backend ready.
- [x] 3. Durable backend: config, store, auth/CSRF/rate-limits, API, media, SSR, operational schedule/backup/report/restore, CLI, Docker. Owner root. Write meaningful failing tests before implementation.
- [x] 4. Integrate and review: tests for persistence/auth/input validation/concurrent edits/backup/form; responsive browser checks including real submit and edit round trip; production gate behaviour; Factory build/lint/regressions. Independent review then fixes. Open working result and save relevant source to GitHub using verified allowlist.

## Completion limits
Code must run and save data now. Owner-approved price list/salon photos/articles, domain transfer, email delivery test, Search Console registration and legal approval cannot be invented or performed without access; surface these clearly in private launch checks and handover. Keep public draft UI free of developer jargon.

## Verified result
2026-09-22: Node24.19; 19 client unit/integration tests, public browser tests at375/768/1440 and repeatable admin round trip passed. Factory build/lint and251 existing tests passed. Independent review findings corrected; uploads restore merges existing files, documented. Live local review on4330; no actual salon emails or customer-domain deployment.
