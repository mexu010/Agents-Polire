# POLIRE refinement choreography

Baseline: independent button magnetism, simple headline clip reveal, nav pill interpolation, project hover scale and service disclosure. These are individually tidy but lack a connected sequence. Hero exit, project transformation, services and process had little narrative motion.

Headline options considered: Mit Haltung. Bis ins Detail. / Klarer gedacht. Präziser gemacht. / Gute Ideen. Geschärft. / Substanz sichtbar machen. / Eine klare Handschrift.
Selected the existing first option: short, ownable, confident, and two complementary typographic voices.

Direction: align, reveal, refine. Five moments: first-session in-place signature, hero departure, concept comparison reveal, service selection, process progress. No blocking loader, additional dependencies, WebGL, sound or custom cursor replacement. All essential content is statically present. Intro is optional and cancellable. Comparisons explicitly depict fictional design studies.

Architecture: globals.css owns static layout; motion.css owns choreographic states and interaction surfaces; motion/use-choreography.js owns event-driven animation lifecycle. Content remains in content.js. Native anchors retain shared clearance and locale position correction.

Verification: npm run build succeeded. 13 Playwright checks passed against the final production build, including exact six requested viewports, DE/EN/DE, navigation clearance, browser history, legal routes, email destination, comparison keyboard controls, first-session/reduced intro, focus containment and landscape menu. Independent review identified desktop toggle and landscape overflow; both corrected and regression-covered. Desktop hero/project and mobile full page/menu visually inspected.

Tuning: motion.css contains keyframes, timings, perspective/departure styling and reduced-motion fallbacks. motion/use-choreography.js contains the 1600ms intro and scroll thresholds. motion/use-pointer-response.js contains pointer amplitudes. project-showcase.js owns the comparison position. All labels remain in content.js.

Performance: no new production packages/assets, no continuously scheduled RAF. Scroll-driven geometry is read before style writes. Pointer bounds are cached until leaving/scrolling. Clip-path and existing glass/shadows can require repaint on weaker GPUs; 60 FPS is a target, not a measured cross-device guarantee. Reduced motion disables movement. Deployment status is verified after push.
