# POLIRE refinement — 2026-09-11

The uploaded markdown(4).md is the approved brief. Work in the existing Next.js repository and retain the central bilingual content model, brand geometry, real legal routes and Vercel Git deployment.

## Baseline evidence
- Commit a75ef0c does not build: app/page.js:216 reads t.pillars.map, but content now exports principles. Projects and service tuple shapes also disagree.
- layout.js imports globals.css, polire-v3.css and polire-fixes.css. The newer polire-v4.css is unused. Several historical CSS copies remain.
- Home and SiteFixes both handle scroll and write the nav indicator, using different section order and offsets.
- Translated titles are React keys; reveal nodes are replaced, but the original observer runs only once. A global MutationObserver forces visibility after the fact.
- Live production still shows the earlier content; a successful source commit is not deployment proof.

## Implementation
1. Align page rendering with content.js, stable section/project/service IDs and DE/EN parity.
2. Use one navigation owner: native hash links, one offset, actual DOM order for scroll spy, ResizeObserver for the indicator. Preserve the viewed section through language changes.
3. Consolidate active styles in globals.css, adapting the existing V4 direction. Remove obsolete layered fixes. Warm paper, ink, cobalt; a compact sculptural brand object; asymmetrical editorial project studies; service disclosures; a short ordered process.
4. Keep content visible without observers. Motion enhances artwork and rules, never gates whole sections. Respect reduced motion and coarse pointers. Remove global pointer tracking and permanent animation loops.
5. Keep /impressum and /datenschutz, centralise their copy and translate both. Explicit missing owner/address, no fabricated data.
6. Verify production build, navigation and language cycles at 1440/1280/1024/768/390/375, keyboard/menu/links, overflow and console. Commit and push only tested changes; verify the resulting deployment and production page.

## Boundaries
app/content.js owns all editable copy; app/page.js composes sections; navigation owns scroll/locale state; shared mark owns SVG geometry; legal component owns shared route rendering. No new animation library or analytics.
