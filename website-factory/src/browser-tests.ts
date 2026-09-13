import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { hash, id, now, validate, type JsonObject } from "./contracts.js";
import { startPreview } from "./preview.js";
import { verifyArtifact } from "./renderer.js";

type BrowserTestArgs = {
  artifactDir: string;
  siteSpec: JsonObject;
  profile: JsonObject;
  outputDir: string;
};
type Viewport = { width: number; height: number };
const VIEWPORTS: Viewport[] = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
];

function checkId(
  category: string,
  route: string | null,
  viewport: Viewport | null,
): string {
  return `check-${hash({ category, route, viewport }).slice(0, 24)}`;
}

function required(
  category: string,
  executor: "runtime" | "qa_model",
  route: string | null,
  viewport: Viewport | null,
): JsonObject {
  return validate("RequiredCheck", {
    check_id: checkId(category, route, viewport),
    category,
    executor,
    page_ref: route,
    viewport,
  });
}

function result(
  check: JsonObject,
  passed: boolean,
  evidenceIds: string[],
  detail: string,
): JsonObject {
  return validate("TestResult", {
    check_id: check.check_id,
    result: passed ? "pass" : "fail",
    evidence_ids: evidenceIds,
    detail,
  });
}

function evidence(
  kind: "screenshot" | "browser_test",
  artifactHash: string,
  sourceUrl: string | null,
  locator: string,
  excerpt: string | null,
  numericValue: number | null = null,
  unit: string | null = null,
): JsonObject {
  return validate("Evidence", {
    evidence_id: id(),
    kind,
    source_url: sourceUrl,
    observed_at: now(),
    artifact_hash: artifactHash,
    locator,
    excerpt,
    numeric_value: numericValue,
    unit,
  });
}

async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    try {
      return await chromium.launch({ headless: true, channel: "chrome" });
    } catch (chromeError) {
      throw new Error(
        'No usable Chromium browser. Install it with "pnpm exec playwright install chromium" or install Chrome.',
        { cause: chromeError },
      );
    }
  }
}

function routeName(route: string): string {
  return route === "/" ? "root" : route.slice(1).replaceAll("/", "-");
}

function pngDimensions(png: Buffer): { width: number; height: number } {
  if (png.length < 24 || png.toString("ascii", 1, 4) !== "PNG")
    throw new Error("Screenshot is not a valid PNG");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

async function admit(
  context: BrowserContext,
  previewUrl: string,
): Promise<void> {
  const page = await context.newPage();
  try {
    const response = await page.goto(previewUrl, { waitUntil: "networkidle" });
    if (!response || response.status() !== 200)
      throw new Error(
        `Preview admission failed with ${response?.status() ?? "no response"}`,
      );
  } finally {
    await page.close();
  }
}

async function pageChecks(
  page: Page,
  siteSpec: JsonObject,
  profile: JsonObject,
  route: string,
  viewport: Viewport,
  artifactHash: string,
  outputDir: string,
) {
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  const response = await page.goto(new URL(route, page.url()).toString(), {
    waitUntil: "networkidle",
  });
  if (!response) throw new Error(`No browser response for ${route}`);

  const screenshotPath = path.join(
    outputDir,
    `${routeName(route)}-${viewport.width}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const screenshotBytes = await readFile(screenshotPath);
  const screenshotHash = createHash("sha256")
    .update(screenshotBytes)
    .digest("hex");
  const screenshotSize = pngDimensions(screenshotBytes);
  const screenshotEvidence = evidence(
    "screenshot",
    artifactHash,
    response.url(),
    JSON.stringify({ route, viewport, full_page: true }),
    screenshotHash,
  );
  const browserEvidence: JsonObject[] = [];
  const results: JsonObject[] = [];
  const requiredChecks: JsonObject[] = [];

  const add = (
    category: string,
    passed: boolean,
    detail: string,
    numericValue: number | null = null,
    unit: string | null = null,
  ) => {
    const check = required(category, "runtime", route, viewport);
    const observed = evidence(
      "browser_test",
      artifactHash,
      response.url(),
      JSON.stringify({ route, viewport, category }),
      detail,
      numericValue,
      unit,
    );
    requiredChecks.push(check);
    browserEvidence.push(observed);
    results.push(
      result(
        check,
        passed,
        [observed.evidence_id, screenshotEvidence.evidence_id],
        detail,
      ),
    );
  };

  const knownRoutes = new Set(
    siteSpec.pages.map((candidate: JsonObject) => candidate.route),
  );
  const links = await page
    .locator("a[href]")
    .evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href") ?? ""),
    );
  const linksSafe = links.every((href) => {
    const parsed = new URL(href, response.url());
    const normalizedRoute =
      parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/$/, "");
    return (
      parsed.origin === new URL(response.url()).origin &&
      knownRoutes.has(normalizedRoute)
    );
  });
  add(
    "links",
    linksSafe,
    linksSafe
      ? `${links.length} internal links resolve to declared routes`
      : "An external or undeclared link was rendered",
  );

  const assetStatus = await page
    .locator("img")
    .evaluateAll((images) =>
      images.map((image) => ({
        complete: (image as HTMLImageElement).complete,
        width: (image as HTMLImageElement).naturalWidth,
      })),
    );
  const assetsPass = assetStatus.every(
    (asset) => asset.complete && asset.width > 0,
  );
  add(
    "assets",
    assetsPass,
    assetsPass
      ? `${assetStatus.length} rendered assets loaded`
      : "At least one rendered asset failed to load",
  );

  add(
    "runtime",
    runtimeErrors.length === 0,
    runtimeErrors.length === 0
      ? "No console or page errors observed"
      : runtimeErrors.join("; ").slice(0, 1900),
  );

  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => {
    const element = document.activeElement;
    return (
      !!element &&
      element !== document.body &&
      ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(element.tagName)
    );
  });
  add(
    "keyboard",
    focused,
    focused
      ? "Tab reached an interactive element"
      : "Tab did not reach an interactive element",
  );

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  add(
    "overflow",
    overflow.scrollWidth <= overflow.clientWidth,
    `Document width ${overflow.scrollWidth}px; viewport content width ${overflow.clientWidth}px`,
    overflow.scrollWidth - overflow.clientWidth,
    "px",
  );

  const sitePage = siteSpec.pages.find(
    (candidate: JsonObject) => candidate.route === route,
  );
  const factualCopies: JsonObject[] = [
    sitePage.title,
    sitePage.meta_description,
  ];
  for (const section of sitePage.sections) {
    factualCopies.push(section.heading, ...section.body);
    for (const item of section.items) factualCopies.push(item.title, item.text);
    if (section.cta) factualCopies.push(section.cta.label);
  }
  const factual = factualCopies.filter(
    (candidate) => candidate.kind === "factual",
  );
  const knownFacts = new Map<string, JsonObject>(
    profile.facts.map((fact: JsonObject) => [fact.fact_id, fact]),
  );
  const visibleText = await page.locator("body").innerText();
  const metaDescription =
    (await page.locator('meta[name="description"]').getAttribute("content")) ??
    "";
  const factsPass = factual.every(
    (candidate) =>
      candidate.fact_ids.length > 0 &&
      candidate.fact_ids.every((factId: string) => {
        const fact = knownFacts.get(factId);
        return (
          fact &&
          fact.value !== null &&
          !["unknown", "conflicting"].includes(fact.verification)
        );
      }) &&
      (visibleText.includes(candidate.text) ||
        metaDescription === candidate.text),
  );
  add(
    "facts",
    factsPass,
    factsPass
      ? `${factual.length} factual copy nodes retain valid fact references`
      : "Factual copy or its accepted reference is missing",
  );

  const safety = await page.evaluate(() => ({
    robots:
      document.querySelector('meta[name="robots"]')?.getAttribute("content") ??
      "",
    banner:
      document.body.textContent?.includes(
        "Unverbindlicher Gestaltungsvorschlag",
      ) ?? false,
    forms: document.forms.length,
    enabledActionButtons: Array.from(
      document.querySelectorAll("button"),
    ).filter((button) => !(button as HTMLButtonElement).disabled).length,
  }));
  const csp = response.headers()["content-security-policy"] ?? "";
  const safe =
    safety.robots.includes("noindex") &&
    safety.banner &&
    safety.forms === 0 &&
    safety.enabledActionButtons === 0 &&
    csp.includes("form-action 'none'") &&
    csp.includes("connect-src 'none'");
  add(
    "preview_safety",
    safe,
    safe
      ? "Noindex, preview label, CSP and disabled actions observed"
      : `Preview safety mismatch: ${JSON.stringify(safety)}`,
  );

  const visualCheck = required("visual", "qa_model", route, viewport);
  requiredChecks.push(visualCheck);
  if (
    sitePage.sections.some(
      (section: JsonObject) => section.addressed_issue_ids.length > 0,
    )
  ) {
    requiredChecks.push(
      required("audit_resolution", "qa_model", route, viewport),
    );
  }
  return {
    results,
    requiredChecks,
    evidence: [screenshotEvidence, ...browserEvidence],
    image: {
      path: screenshotPath,
      evidence_id: screenshotEvidence.evidence_id,
      width: screenshotSize.width,
      height: screenshotSize.height,
      sha256: screenshotHash,
    },
  };
}

export async function runBrowserTests({
  artifactDir,
  siteSpec,
  profile,
  outputDir,
}: BrowserTestArgs): Promise<{
  results: JsonObject[];
  requiredChecks: JsonObject[];
  evidence: JsonObject[];
  images: Array<{
    path: string;
    evidence_id: string;
    width: number;
    height: number;
    sha256: string;
  }>;
  build: JsonObject;
}> {
  validate("SiteSpec", siteSpec);
  validate("Profile", profile);
  await mkdir(outputDir, { recursive: true });
  const verifiedArtifact = verifyArtifact({ artifactDir });
  const build = verifiedArtifact.build;
  const manifest = verifiedArtifact.manifest;
  if (build.result !== "pass" || !build.artifact_hash)
    throw new Error("Browser checks require a successful current render");
  if (build.artifact_hash !== hash(manifest))
    throw new Error("Build does not match the current artifact manifest");
  const token = id();
  const preview = await startPreview({ artifactDir, token });
  const browser = await launchBrowser();
  const results: JsonObject[] = [];
  const requiredChecks: JsonObject[] = [];
  const allEvidence: JsonObject[] = [];
  const images: Array<{
    path: string;
    evidence_id: string;
    width: number;
    height: number;
    sha256: string;
  }> = [];
  try {
    const buildCheck = required("build", "runtime", null, null);
    const buildEvidence = evidence(
      "browser_test",
      build.artifact_hash,
      null,
      "build.json",
      "Renderer build completed successfully",
    );
    requiredChecks.push(buildCheck);
    allEvidence.push(buildEvidence);
    results.push(
      result(
        buildCheck,
        true,
        [buildEvidence.evidence_id],
        "Renderer build completed successfully",
      ),
    );

    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport,
        colorScheme: "light",
        reducedMotion: "reduce",
      });
      await admit(context, preview.url);
      try {
        for (const sitePage of siteSpec.pages) {
          const page = await context.newPage();
          await page.goto(new URL(sitePage.route, preview.url).toString(), {
            waitUntil: "networkidle",
          });
          const checked = await pageChecks(
            page,
            siteSpec,
            profile,
            sitePage.route,
            viewport,
            build.artifact_hash,
            outputDir,
          );
          results.push(...checked.results);
          requiredChecks.push(...checked.requiredChecks);
          allEvidence.push(...checked.evidence);
          images.push(checked.image);
          await page.close();
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await preview.close();
  }
  verifyArtifact({ artifactDir, expectedHash: verifiedArtifact.hash });
  return { results, requiredChecks, evidence: allEvidence, images, build };
}
