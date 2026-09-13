# Verification — 2026-09-11

## Baseline

- `a75ef0c` failed its production build with `Cannot read properties of undefined (reading 'map')` at `t.pillars.map`.
- GitHub reported the Vercel status for that commit as failure. Production was still serving older content.
- The history regression test initially failed: Back restored the German URL while the document stayed English. It passes after subscribing to popstate.
- Initial console check found a 404 for /favicon.ico. Adding app/icon.svg removes the missing-icon request on fresh page loads.

## Final local result

- Production build successful; /, /impressum, /datenschutz and /icon.svg prerendered successfully.
- 9 Playwright tests passed in 38 seconds against the production server.
- Widths: 1440, 1280, 1024, 768, 390, 375.
- Native section links land at the shared navigation clearance with correct active navigation.
- DE/EN/DE cycles retain the viewed section position, preserve all sections and have no horizontal or heading/button overflow.
- Browser Back/Forward restores the matching language.
- Mobile menu closes on Escape and returns keyboard focus. Service disclosure works with Enter and stays open through language change.
- Both legal pages open from English footer links and return to English home. Missing legal identity is explicit.
- Contact link has the intended mailto destination. No test sends an email.
- Reduced-motion disables animation. Main sections and headline remain readable without JavaScript.
- Browser tests capture no page exceptions or console errors.
- Visual inspection in Chrome: desktop hero/project composition, mobile hero, projects and services. No grid background or old orb, no clipped text or overlapping navigation observed.
- Independent code review completed; its history finding was reproduced and fixed.

## Limits

These checks are not a legal certification or a measured Lighthouse score. Actual operator name and address remain missing in legalIdentity. Final production deployment is checked separately against the pushed commit and live site.
