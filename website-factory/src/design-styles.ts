import type { JsonObject } from "./contracts.js";

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function accentCss(theme: JsonObject): string {
  const accent =
    theme.palette === "brand" && typeof theme.accent_hex === "string"
      ? theme.accent_hex
      : theme.palette === "dark"
        ? "#e6b566"
        : "#176b5b";
  const luminance = relativeLuminance(accent);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  const ink = whiteContrast >= blackContrast ? "#ffffff" : "#000000";
  return `html[class*="composition-"]{--accent:${accent};--accent-ink:${ink}}`;
}

export const compositionCss = `
html[class*="composition-"]{--accent-ink:#ffffff;--section-space:clamp(4rem,9vw,8rem);--display-font:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
html.font-editorial[class*="composition-"]{--display-font:Georgia,"Times New Roman",serif}
html.spacing-compact[class*="composition-"]{--section-space:clamp(3rem,7vw,6rem)}
html.spacing-generous[class*="composition-"]{--section-space:clamp(5rem,11vw,10rem)}
html.composition-atelier{--paper:#f3eee5;--surface:#fbf8f2;--ink:#282821;--muted:#65655b;--line:#d9d2c7}
html.composition-editorial{--paper:#f8f7f2;--surface:#fffefa;--ink:#20251f;--muted:#5e675f;--line:#c8cec5}
html.composition-bold{--paper:#e8e8de;--surface:#f8f8ee;--ink:#17231d;--muted:#45564b;--line:#bcc6bc}
html.composition-minimal{--paper:#f9f9f7;--surface:#fff;--ink:#242a28;--muted:#5f6864;--line:#d7ddda}
html.theme-dark.composition-atelier{--paper:#191b19;--surface:#252923;--ink:#f4f1e9;--muted:#c0c7ba;--line:#4a5148}
html.theme-dark.composition-editorial{--paper:#171d1b;--surface:#202825;--ink:#f5f6f0;--muted:#bbc8bf;--line:#425048}
html.theme-dark.composition-bold{--paper:#101a16;--surface:#1c2b23;--ink:#f5f7ed;--muted:#c3d0c5;--line:#4b5e50}
html.theme-dark.composition-minimal{--paper:#171b1a;--surface:#202624;--ink:#f2f5f2;--muted:#b7c0ba;--line:#414b45}
html[class*="composition-"] body{overflow-wrap:anywhere}
html[class*="composition-"] h1,html[class*="composition-"] h2,html[class*="composition-"] h3{font-family:var(--display-font)}
html[class*="composition-"] h1,html[class*="composition-"] h2,html[class*="composition-"] h3,html[class*="composition-"] .brand{overflow-wrap:anywhere;hyphens:auto;min-width:0}
html[class*="composition-"] .button{background:var(--accent);color:var(--accent-ink);border-radius:0;transition:transform .25s ease,filter .25s ease}
html[class*="composition-"] .button:hover:not(:disabled){transform:translateY(-3px);filter:brightness(.95)}
html[class*="composition-"] .button:disabled{opacity:1}
html[class*="composition-"] .preview-banner{background:var(--ink);color:var(--paper)}
html[class*="composition-"] .site-header{background:var(--paper);border-color:var(--line);padding:1.2rem clamp(1.25rem,6vw,7rem)}
html[class*="composition-"] .site-header nav a{text-decoration:none}
html[class*="composition-"] .site-header nav a:hover{text-decoration:underline}
html[class*="composition-"] .page-title{padding:clamp(4rem,9vw,9rem) clamp(1.25rem,7vw,8rem) clamp(2rem,5vw,4rem)}
html[class*="composition-"] .page-title h1{font-size:clamp(2.8rem,8vw,7rem)}
.designed-section{padding:var(--section-space) clamp(1.25rem,7vw,8rem);border-top:1px solid var(--line)}
.designed-section h1,.designed-section h2,.designed-section h3{overflow-wrap:anywhere;hyphens:auto}
.designed-section h1{font-size:clamp(3.5rem,9vw,9rem);line-height:.91;letter-spacing:-.065em;margin:0}
.designed-section h2{font-size:clamp(2.5rem,6vw,6rem);line-height:.99;letter-spacing:-.055em;margin:0}
.designed-section h3{font-size:clamp(1.35rem,2.4vw,2rem);line-height:1.13;margin:0 0 .5rem}
.designed-section .section-body{font-size:clamp(1.05rem,1.5vw,1.3rem);line-height:1.65}
.designed-section .section-image{display:block;width:100%;height:100%;max-height:none;border-radius:0;object-fit:cover}
.designed-section .contacts{max-width:700px}.designed-section .contact{border-radius:0;background:transparent;border-width:0 0 1px;padding:1.1rem 0}
.designed-section .contact span{flex:none;white-space:nowrap;overflow-wrap:normal}
.designed-section .contact strong{min-width:0;overflow-wrap:anywhere;text-align:right}
.designed-section .demo-note{margin:1rem 0 0}.designed-section .button{margin-top:1.5rem}
.atelier-header{min-height:104px}.atelier-brand-frame{padding:0 0 .6rem;border-bottom:2px solid var(--accent)}
.composition-atelier .brand{font-family:var(--display-font);font-weight:500;font-size:1.55rem}
.composition-atelier.designed-section:nth-of-type(even){background:var(--surface)}
.atelier-frame{max-width:1500px;margin:auto;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.7fr);gap:clamp(3rem,8vw,10rem);align-items:start}
.atelier-heading h1,.atelier-heading h2{font-family:var(--display-font);font-weight:400;letter-spacing:-.055em}
.atelier-heading .section-image{margin-top:clamp(3rem,7vw,7rem);aspect-ratio:5/4}
.atelier-detail{padding-top:clamp(1rem,8vw,8rem);max-width:570px}.atelier-detail .section-body:first-child p:first-child{font-size:clamp(1.35rem,2vw,1.9rem);line-height:1.4}
.atelier-items{margin:3rem 0;display:grid;gap:0}.atelier-item{padding:1.5rem 0;border-top:1px solid var(--line)}.atelier-item:last-child{border-bottom:1px solid var(--line)}
.editorial-header{display:block;text-align:center;padding-bottom:0!important}.editorial-masthead{padding:1.4rem 0 2rem}.composition-editorial .brand{font-family:var(--display-font);font-size:clamp(1.6rem,3vw,2.5rem);font-weight:400;letter-spacing:-.04em}.editorial-navigation{border-top:1px solid var(--line);padding:1rem 0}.editorial-navigation nav{justify-content:center}
.composition-editorial.designed-section{padding-top:var(--section-space);padding-bottom:var(--section-space)}
.editorial-frame{max-width:1450px;margin:auto;display:grid;grid-template-columns:4rem minmax(0,1fr);column-gap:clamp(1rem,4vw,5rem)}
.editorial-index{font:700 .9rem ui-sans-serif,system-ui,sans-serif;color:var(--accent);padding-top:.7rem;border-top:2px solid var(--accent)}
.editorial-content{max-width:980px}.editorial-content h1,.editorial-content h2{font-family:var(--display-font);font-weight:400;letter-spacing:-.052em}.editorial-content .section-body{max-width:630px;margin:2.4rem 0 0}.editorial-figure{grid-column:2;margin:3rem 0 0;aspect-ratio:16/8;overflow:hidden}
.editorial-items{list-style:decimal-leading-zero;margin:3rem 0 0;padding:0 0 0 3rem}.editorial-items li{padding:1.5rem 0 1.5rem 1rem;border-top:1px solid var(--line)}.editorial-items li::marker{color:var(--accent);font-size:.8rem;font-weight:800}.editorial-items li p{margin:.5rem 0 0}
.bold-header{background:var(--ink)!important;color:var(--surface);min-height:96px}.composition-bold .brand{font-size:clamp(1.35rem,2.3vw,2rem);text-transform:uppercase;letter-spacing:-.045em}.bold-nav-frame{border:1px solid currentColor;padding:.65rem 1rem}.bold-header nav{gap:1.7rem}
.composition-bold.designed-section{background:var(--surface)}.composition-bold.designed-section.is-hero{background:var(--accent);color:var(--accent-ink);border:0;min-height:clamp(540px,76vh,900px);display:flex;align-items:center}.composition-bold.designed-section:nth-of-type(even):not(.is-hero){background:var(--paper)}
.bold-frame{max-width:1500px;width:100%;margin:auto;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:clamp(2rem,6vw,7rem);align-items:end}.bold-title{container-type:inline-size;min-width:0}.bold-title h1{text-transform:uppercase;font-weight:900;font-size:clamp(2.2rem,11cqw,8rem);letter-spacing:-.055em}.bold-title h2{text-transform:uppercase;font-weight:900;letter-spacing:-.075em}.bold-detail{max-width:650px}.bold-detail .section-body{font-size:clamp(1.15rem,1.8vw,1.6rem);font-weight:500}.bold-image{grid-column:1/-1;max-height:540px;overflow:hidden}.bold-image img{aspect-ratio:20/7}.bold-items{display:grid;gap:0;margin-top:3rem}.bold-items article{border-top:2px solid currentColor;padding:1.3rem 0;display:grid;grid-template-columns:3rem 1fr;column-gap:1rem}.bold-items article span{grid-row:1/3;font-weight:800;font-size:.8rem}.bold-items article p{margin:.2rem 0}.composition-bold.is-hero .button{background:var(--accent-ink);color:var(--accent)}
.minimal-header{min-height:72px}.minimal-brand-line{width:100%;display:flex;justify-content:space-between;align-items:center;gap:2rem}.composition-minimal .brand{font-size:1rem;letter-spacing:0;font-weight:650}.minimal-header nav{gap:1.3rem;font-size:.9rem}
.composition-minimal.designed-section{padding-top:calc(var(--section-space)*.75);padding-bottom:calc(var(--section-space)*.75)}.composition-minimal.designed-section.is-hero{padding-top:calc(var(--section-space)*1.25);padding-bottom:calc(var(--section-space)*1.25)}
.minimal-frame{max-width:1000px;margin:auto}.minimal-intro{max-width:760px}.minimal-intro h1{font-size:clamp(3.2rem,7vw,6.5rem);font-weight:500}.minimal-intro h2{font-size:clamp(2rem,4vw,3.8rem);font-weight:500}.minimal-intro .section-body{max-width:570px;margin-top:2rem;font-size:1.08rem}.minimal-image{max-width:760px;aspect-ratio:16/9;margin-top:3rem;overflow:hidden}.minimal-items{margin:3rem 0 0}.minimal-items>div{display:grid;grid-template-columns:minmax(120px,1fr) minmax(0,2fr);gap:2rem;border-top:1px solid var(--line);padding:1.2rem 0}.minimal-items>div:last-child{border-bottom:1px solid var(--line)}.minimal-items dt{font-weight:700}.minimal-items dd{margin:0;color:var(--muted)}
.motion-subtle .designed-section.is-hero h1{animation:quiet-enter .85s cubic-bezier(.2,.7,.2,1) both}.motion-subtle .designed-section.is-hero .section-body{animation:quiet-enter .9s .12s cubic-bezier(.2,.7,.2,1) both}
@keyframes quiet-enter{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:900px){.atelier-frame{grid-template-columns:1fr;gap:1rem}.atelier-detail{padding-top:0}.bold-frame{grid-template-columns:1fr}.bold-image{grid-column:1}.editorial-frame{grid-template-columns:2.5rem minmax(0,1fr)}}
@media(max-width:700px){html[class*="composition-"] .site-header{padding:1rem 1.25rem;gap:1rem}html[class*="composition-"] .site-header nav{gap:.75rem 1.1rem}.atelier-header,.bold-header{align-items:flex-start;flex-direction:column}.minimal-brand-line{align-items:flex-start;flex-direction:column;gap:.75rem}.editorial-masthead{padding:.5rem 0 1rem}.editorial-navigation{padding:.65rem 0}.designed-section h1{font-size:clamp(3.2rem,13vw,5.5rem)}.editorial-frame{grid-template-columns:1fr}.editorial-index{width:3rem;margin-bottom:1.5rem}.editorial-figure{grid-column:1}.bold-title h1{font-size:clamp(2.2rem,11cqw,8rem)}.bold-nav-frame{padding:.5rem}.minimal-items>div{grid-template-columns:1fr;gap:.35rem}.contact{align-items:flex-start;flex-direction:column}.designed-section .contact strong{text-align:left}}
@media(prefers-reduced-motion:reduce){.motion-subtle .designed-section.is-hero h1,.motion-subtle .designed-section.is-hero .section-body{animation:none!important}html[class*="composition-"] .button{transition:none!important}}
`.trim();
