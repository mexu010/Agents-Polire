# Expressive Motion – POLIRE

## Reference analysis
Official sites inspected: https://obys.agency/ and https://noomoagency.com/ (September 2026).
Obys centres work in a strong graphic composition with alternative viewing modes. Noomo combines oversized typography and dimensional objects. The useful principles are scale, spatial continuity and a visible central interaction, not copying their graphics or content.

## Changes
- Replaced the static glass-card hero with a seven-plane POLIRE sculpture. Pointer changes perspective; a keyboard-operable button unfolds/reassembles the planes. Ambient rotation/float is explicitly pausable, pauses offscreen and is disabled for reduced motion.
- Hero words unfold individually; hero departure moves and rotates the sculpture and scales typography more visibly.
- Added a sticky kinetic composition within the work section. Three oversized lines align from opposing directions; a cobalt panel reveals navy, a seal rotates into place and a rule tracks progress. Mobile has its own shorter stage; reduced motion is a static panel.
- Project surfaces reveal with perspective, scale and independent engineering frames. The second monogram rotates as the project comes into view.
- Services receive a five-plane geometric response to the active selection; process rules draw across the active row; the oversized footer wordmark assembles letter by letter on scroll.
- Existing DE/EN, anchors, comparison, legal routes and content architecture preserved. New labels live in app/content.js.

## Files
app/content.js, app/page.js, app/hero-sculpture.js, app/kinetic-story.js, app/motion.css, app/motion/use-choreography.js, app/motion/use-pointer-response.js, tests/expressive.spec.js, docs/expressive-motion.md.

## Tuning and performance
Motion CSS lives in app/motion.css; scroll thresholds in app/motion/use-choreography.js. Sculpture states and offscreen pausing live in app/hero-sculpture.js. There are no additional production dependencies or downloaded media. CSS transforms run the only ambient loop; scroll updates remain event-driven. Layer compositing, masks and shadows can cost more GPU time on low-end devices; no cross-device 60 FPS guarantee is claimed.

## Verification
Production build succeeds. Regression tests cover all six requested viewport sizes, languages, history, legal links, keyboard controls, reduced motion and no-JavaScript readability. New test verifies sculpture open/close including the actual closed transform, pause state and changing scroll-story progress. Independent review found a hover/toggle conflict; fixed by making the explicit toggle authoritative. Desktop hero, expanded sculpture, kinetic panel and mobile hero visually inspected.
