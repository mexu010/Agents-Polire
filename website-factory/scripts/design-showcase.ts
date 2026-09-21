/** Local, synthetic renderer comparison. No model, research, email or deployment calls. */
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import {
  fixtureInput,
  fixtureOutput,
  buildAgentInput,
} from "../src/fixtures.js";
import { processAgentOutput } from "../src/agents.js";
import { renderSite } from "../src/renderer.js";
import { startPreview } from "../src/preview.js";
import { runBrowserTests } from "../src/browser-tests.js";
import { COMPOSITIONS } from "../src/design-policy.js";
import type { JsonObject } from "../src/contracts.js";

const root = resolve(
  "work/design-showcase",
  new Date().toISOString().replaceAll(":", "-"),
);
await mkdir(root, { recursive: true });
const context: JsonObject = fixtureInput();
for (const agent of [
  "scout",
  "audit",
  "qualifier",
  "strategist",
  "builder",
] as const) {
  const input = buildAgentInput(agent, context);
  const key = {
    scout: "profile",
    audit: "audit",
    qualifier: "qualification",
    strategist: "brief",
    builder: "siteSpec",
  }[agent];
  context[key] = processAgentOutput(agent, fixtureOutput(agent, input), input);
}
// Synthetic fixture text only; never modify a real company record or an existing artifact.
const salon = JSON.parse(
  JSON.stringify(context)
    .replaceAll("Alpina Sanitär GmbH", "Studio Schnitt · Testbetrieb")
    .replaceAll("Sanitärinstallationen", "Haarschnitte")
    .replaceAll("Badumbauten", "Farbberatung")
    .replaceAll("Reparaturen", "Styling")
    .replaceAll("alpina-sanitaer.example", "studio-schnitt.example")
    .replaceAll(
      "fixture.alpina-service.example",
      "fixture.studio-schnitt.example",
    ),
);
const descriptions = {
  atelier: "Versetzte Textspalten und ruhige Serifentitel.",
  editorial: "Redaktioneller Auftakt und nummerierte Kapitel.",
  bold: "Plakative Typografie und kräftige Flächen.",
  minimal: "Kompakter Einstieg und reduzierte Leistungslisten.",
};
const variants: JsonObject[] = [];
const closers: Array<() => Promise<void>> = [];
try {
  for (const composition of COMPOSITIONS) {
    const site = structuredClone(salon.siteSpec);
    site.theme = {
      ...site.theme,
      composition,
      font_pair: ["atelier", "editorial"].includes(composition)
        ? "editorial"
        : "sans",
      accent_hex:
        composition === "bold"
          ? "#d94f28"
          : composition === "atelier"
            ? "#773c49"
            : "#285c52",
    };
    const rendered = await renderSite({
      leadId: `showcase-${composition}`,
      siteSpec: site,
      profile: salon.profile,
      assets: [],
      outputDir: root,
      mode: "fixture",
    });
    let checks: JsonObject | null = null;
    if (
      process.argv.includes("--check") ||
      process.argv.includes("--check-only")
    ) {
      checks = await runBrowserTests({
        artifactDir: rendered.artifactDir,
        siteSpec: site,
        profile: salon.profile,
        outputDir: join(root, "checks", composition),
      });
      const failed = checks.results.filter(
        (result: JsonObject) => result.result === "fail",
      );
      if (failed.length)
        throw new Error(`${composition}: ${JSON.stringify(failed)}`);
      await writeFile(
        join(root, `${composition}-checks.json`),
        JSON.stringify(checks, null, 2),
      );
    }
    let url: string | null = null;
    if (!process.argv.includes("--check-only")) {
      const preview = await startPreview({
        artifactDir: rendered.artifactDir,
        token: randomUUID(),
      });
      closers.push(preview.close);
      url = preview.url;
    }
    variants.push({
      composition,
      description: descriptions[composition],
      url,
      artifactDir: rendered.artifactDir,
      screenshots: checks?.images ?? [],
    });
  }
  await writeFile(
    join(root, "showcase.json"),
    JSON.stringify(variants, null, 2),
  );
  if (process.argv.includes("--check-only")) {
    console.log(JSON.stringify({ outputDir: root, variants }, null, 2));
  } else {
    const html = `<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>POLIRE — vier Designrichtungen</title><style>body{margin:0;background:#f0eee7;color:#222;font:17px/1.6 system-ui}main{max-width:1000px;margin:8vh auto;padding:24px}h1{font-size:clamp(36px,6vw,68px);line-height:1.05;letter-spacing:-.05em}p{max-width:720px;color:#555}a{color:inherit}article{border-top:1px solid #bdbbb5;padding:24px 0;display:grid;grid-template-columns:180px 1fr auto;gap:24px;align-items:center}h2{margin:0;text-transform:capitalize}article p{margin:0}article a{padding:10px 18px;border:1px solid;border-radius:4px;text-decoration:none}small{display:block;margin-top:32px;color:#555}@media(max-width:650px){article{grid-template-columns:1fr;gap:12px}article a{justify-self:start}}</style></head><body><main><p>POLIRE / BUILDER-VERGLEICH</p><h1>Eine Firma.<br>Vier eigene Richtungen.</h1><p>Identische synthetische Salon-Inhalte, vier unterschiedliche Seitenaufbauten aus dem neuen Factory-Renderer. Die Modelle und die Inspirationsrecherche sind in diesem Vergleich simuliert. Die Beispiele zeigen die Gestaltungsoptionen, keine fertigen Kundenentwürfe.</p>${variants.map((item) => `<article><h2>${item.composition}</h2><p>${item.description}</p><a target="_blank" rel="noopener" href="${item.url}">Ansehen ↗</a></article>`).join("")}<small>Ohne fremde Bilder. Lokal und zeitlich begrenzt. Es wird nichts versendet.</small></main></body></html>`;
    const server = createServer((request, response) => {
      if (request.method !== "GET" || request.url !== "/") {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      });
      response.end(html);
    });
    await new Promise<void>((ready, reject) => {
      server.once("error", reject);
      server.listen(4321, "127.0.0.1", ready);
    });
    closers.push(() => new Promise<void>((done) => server.close(() => done())));
    console.log(
      JSON.stringify(
        { gallery: "http://127.0.0.1:4321/", outputDir: root, variants },
        null,
        2,
      ),
    );
    const close = async () => {
      await Promise.all(closers.map((fn) => fn()));
      process.exit(0);
    };
    process.once("SIGINT", () => void close());
    process.once("SIGTERM", () => void close());
  }
} catch (error) {
  await Promise.all(closers.map((fn) => fn()));
  throw error;
}
