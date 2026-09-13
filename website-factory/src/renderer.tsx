import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hash, id, now, validate, type JsonObject } from "./contracts.js";

export const RENDERER_VERSION = "local-service/1.0.0";
const PREVIEW_POLICY_VERSION = "local-noindex-no-submit/1.0.0";
const TEST_CONFIG = { viewports: [375, 768, 1440], fullPage: true };
const CONTENT_SECURITY_POLICY =
  "default-src 'none'; img-src 'self' data:; style-src 'self'; font-src 'self'; form-action 'none'; connect-src 'none'; base-uri 'none'";

type RenderArgs = {
  leadId: string;
  siteSpec: JsonObject;
  profile: JsonObject;
  assets: JsonObject[];
  outputDir: string;
  mode: "fixture" | "live";
};

function routeParts(route: string): string[] {
  if (route === "/") return [];
  if (
    !/^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(route)
  ) {
    throw new Error(`Unsafe site route: ${route}`);
  }
  return route.slice(1).split("/");
}

function hrefForRoute(route: string): string {
  routeParts(route);
  return route;
}

function copyText(value: JsonObject): string {
  return String(value.text);
}

function contactLabel(contact: JsonObject): string {
  const labels: Record<string, string> = {
    email: "E-Mail",
    phone: "Telefon",
    contact_page: "Kontaktseite",
    booking_page: "Buchungsseite",
  };
  return labels[contact.kind] ?? "Kontakt";
}

function findSectionRoute(
  siteSpec: JsonObject,
  sectionId: string,
): string | undefined {
  for (const page of siteSpec.pages) {
    if (
      page.sections.some(
        (section: JsonObject) => section.section_id === sectionId,
      )
    )
      return page.route;
  }
  return undefined;
}

function Cta({
  cta,
  siteSpec,
  profile,
}: {
  cta: JsonObject;
  siteSpec: JsonObject;
  profile: JsonObject;
}) {
  if (cta.target === "section") {
    const route = findSectionRoute(siteSpec, cta.target_ref);
    if (!route)
      throw new Error(`CTA references unknown section: ${cta.target_ref}`);
    return (
      <a
        className="button"
        href={`${route === "/" ? "" : route}#${encodeURIComponent(cta.target_ref)}`}
      >
        {copyText(cta.label)}
      </a>
    );
  }
  const contact = profile.contacts.find(
    (candidate: JsonObject) => candidate.contact_id === cta.target_ref,
  );
  if (!contact)
    throw new Error(`CTA references unknown contact: ${cta.target_ref}`);
  return (
    <button
      className="button"
      type="button"
      disabled
      title="Vorschau: Es wird nichts versendet"
    >
      {copyText(cta.label)}
    </button>
  );
}

function Section({
  section,
  siteSpec,
  profile,
  assetUrls,
}: {
  section: JsonObject;
  siteSpec: JsonObject;
  profile: JsonObject;
  assetUrls: Map<string, string>;
}) {
  const assetUrl =
    section.asset_id === null ? undefined : assetUrls.get(section.asset_id);
  if (section.asset_id !== null && !assetUrl)
    throw new Error(
      `Section references unavailable asset: ${section.asset_id}`,
    );
  const contactSection = section.component === "contact";
  return (
    <section
      id={section.section_id}
      className={`section component-${section.component} variant-${section.variant}`}
    >
      <div className="section-copy">
        <h2>{copyText(section.heading)}</h2>
        {section.body.map((paragraph: JsonObject, index: number) => (
          <p key={index}>{copyText(paragraph)}</p>
        ))}
        {section.items.length > 0 && (
          <div className="items">
            {section.items.map((item: JsonObject, index: number) => (
              <article className="item" key={index}>
                <h3>{copyText(item.title)}</h3>
                <p>{copyText(item.text)}</p>
              </article>
            ))}
          </div>
        )}
        {contactSection && (
          <div className="contacts">
            {profile.contacts.map((contact: JsonObject) => (
              <div className="contact" key={contact.contact_id}>
                <span>{contactLabel(contact)}</span>
                <strong>{contact.value}</strong>
              </div>
            ))}
            <p className="demo-note">
              Vorschau: Es wird nichts versendet. Kontaktaktionen sind
              deaktiviert.
            </p>
          </div>
        )}
        {section.cta && (
          <Cta cta={section.cta} siteSpec={siteSpec} profile={profile} />
        )}
      </div>
      {assetUrl && (
        <img
          className="section-image"
          src={assetUrl}
          alt={assetUrls.get(`${section.asset_id}:alt`) ?? ""}
        />
      )}
    </section>
  );
}

function Layout({
  children,
  siteSpec,
}: {
  children: ReactNode;
  siteSpec: JsonObject;
}) {
  return (
    <>
      <header className="site-header">
        <a className="brand" href="/">
          Vorschau
        </a>
        <nav aria-label="Hauptnavigation">
          {siteSpec.navigation.map((item: JsonObject) => (
            <a key={item.route} href={hrefForRoute(item.route)}>
              {copyText(item.label)}
            </a>
          ))}
        </nav>
      </header>
      <div className="preview-banner" role="note">
        Unverbindlicher Gestaltungsvorschlag · Zugriff zeitlich begrenzt
      </div>
      <main>{children}</main>
      <footer>
        <p>
          Unverbindlicher Gestaltungsvorschlag. Keine Nachricht, Buchung oder
          Zahlung wird ausgelöst.
        </p>
      </footer>
    </>
  );
}

function Document({
  page,
  siteSpec,
  profile,
  assetUrls,
}: {
  page: JsonObject;
  siteSpec: JsonObject;
  profile: JsonObject;
  assetUrls: Map<string, string>;
}) {
  const accent =
    siteSpec.theme.palette === "brand" && siteSpec.theme.accent_hex
      ? siteSpec.theme.accent_hex
      : siteSpec.theme.palette === "dark"
        ? "#e6b566"
        : "#176b5b";
  const themeClass = `theme-${siteSpec.theme.palette} font-${siteSpec.theme.font_pair} spacing-${siteSpec.theme.spacing} motion-${siteSpec.theme.motion}`;
  return (
    <html lang={siteSpec.locale} className={themeClass} data-accent={accent}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <meta
          httpEquiv="Content-Security-Policy"
          content={CONTENT_SECURITY_POLICY}
        />
        <meta name="description" content={copyText(page.meta_description)} />
        <title>{copyText(page.title)}</title>
        <link rel="stylesheet" href="/assets/site.css" />
      </head>
      <body>
        <Layout siteSpec={siteSpec}>
          <header className="page-title">
            <h1>{copyText(page.title)}</h1>
          </header>
          {page.sections.map((section: JsonObject) => (
            <Section
              key={section.section_id}
              section={section}
              siteSpec={siteSpec}
              profile={profile}
              assetUrls={assetUrls}
            />
          ))}
        </Layout>
      </body>
    </html>
  );
}

const CSS = `
:root{--ink:#18201d;--paper:#f7f4ed;--surface:#fff;--muted:#63706a;--accent:#176b5b;--line:#d9ddd8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper);line-height:1.6}html[data-accent="#176b5b"]{--accent:#176b5b}html[data-accent="#e6b566"]{--accent:#b67b16}.theme-dark{--ink:#f7f4ed;--paper:#121714;--surface:#1b241f;--muted:#b6c0ba;--line:#344139}.font-editorial h1,.font-editorial h2,.font-editorial h3{font-family:Georgia,"Times New Roman",serif}.spacing-compact{--space:clamp(3rem,7vw,6rem)}.spacing-comfortable{--space:clamp(4rem,9vw,8rem)}.spacing-generous{--space:clamp(5rem,11vw,10rem)}*{box-sizing:border-box}body{margin:0;overflow-x:hidden}a{color:inherit}.site-header{min-height:76px;padding:1rem clamp(1.25rem,5vw,5rem);display:flex;align-items:center;justify-content:space-between;gap:2rem;background:var(--surface);border-bottom:1px solid var(--line)}.brand{font-size:1.1rem;font-weight:800;text-decoration:none;letter-spacing:-.02em}.site-header nav{display:flex;gap:clamp(.8rem,3vw,2rem);flex-wrap:wrap}.site-header nav a{text-underline-offset:.35rem}.preview-banner{padding:.65rem 1.25rem;background:var(--accent);color:#fff;text-align:center;font-size:.82rem;font-weight:700;letter-spacing:.03em}.page-title{padding:var(--space) clamp(1.25rem,8vw,8rem) clamp(2rem,5vw,4rem);max-width:1100px}.page-title h1{margin:0;font-size:clamp(2.8rem,9vw,7.5rem);line-height:.94;letter-spacing:-.055em}.section{padding:var(--space) clamp(1.25rem,8vw,8rem);display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(2rem,6vw,6rem);align-items:center;border-top:1px solid var(--line)}.section-copy{max-width:760px}.variant-split:has(.section-image){grid-template-columns:minmax(0,1fr) minmax(280px,.8fr)}.section h2{font-size:clamp(2rem,5vw,4.5rem);line-height:1.02;letter-spacing:-.04em;margin:.25rem 0 1.5rem}.eyebrow{text-transform:uppercase;letter-spacing:.14em;color:var(--accent);font-weight:800;font-size:.74rem}.items{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:1rem;margin:2rem 0}.item,.contact{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:1.4rem}.item h3{margin-top:0}.section-image{width:100%;max-height:600px;object-fit:cover;border-radius:28px}.button{display:inline-flex;margin-top:1.25rem;padding:.85rem 1.25rem;border:0;border-radius:999px;background:var(--accent);color:#fff;text-decoration:none;font:inherit;font-weight:750}.button:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:4px}.button:disabled{cursor:not-allowed;opacity:.72}.contacts{display:grid;gap:.8rem;margin-top:2rem}.contact{display:flex;justify-content:space-between;gap:1rem}.contact span,.demo-note{color:var(--muted)}.demo-note{font-size:.9rem}footer{padding:3rem clamp(1.25rem,8vw,8rem);background:var(--surface);border-top:1px solid var(--line);color:var(--muted)}@media(max-width:700px){.site-header{align-items:flex-start;flex-direction:column}.variant-split:has(.section-image){grid-template-columns:1fr}.contact{align-items:flex-start;flex-direction:column}.page-title h1{font-size:clamp(2.5rem,16vw,4.5rem)}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
`.trim();

function extensionFor(localRef: string): string {
  const extension = path.extname(localRef).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"].includes(extension))
    throw new Error(`Unsupported asset type: ${extension || "none"}`);
  return extension;
}

async function prepareAssets(
  siteSpec: JsonObject,
  assets: JsonObject[],
  artifactDir: string,
): Promise<{ urls: Map<string, string>; hashes: string[] }> {
  const registry = new Map<string, JsonObject>();
  for (const asset of assets) {
    validate("ApprovedAsset", asset);
    if (registry.has(asset.asset_id))
      throw new Error(`Duplicate asset: ${asset.asset_id}`);
    registry.set(asset.asset_id, asset);
  }
  const urls = new Map<string, string>();
  const hashes: string[] = [];
  await mkdir(path.join(artifactDir, "assets"), { recursive: true });
  for (const assetId of siteSpec.asset_ids) {
    const asset = registry.get(assetId);
    if (!asset)
      throw new Error(`SiteSpec references unapproved asset: ${assetId}`);
    const source = await realpath(asset.local_ref);
    const contents = await readFile(source);
    const actualHash = createHash("sha256").update(contents).digest("hex");
    if (actualHash !== asset.sha256)
      throw new Error(`Asset hash mismatch: ${assetId}`);
    const filename = `${hash(assetId).slice(0, 20)}${extensionFor(source)}`;
    await copyFile(source, path.join(artifactDir, "assets", filename));
    urls.set(assetId, `/assets/${filename}`);
    urls.set(`${assetId}:alt`, asset.alt_text);
    hashes.push(actualHash);
  }
  return { urls, hashes: hashes.sort() };
}

function outputFileFor(artifactDir: string, route: string): string {
  const parts = routeParts(route);
  return parts.length === 0
    ? path.join(artifactDir, "index.html")
    : path.join(artifactDir, ...parts, "index.html");
}

function validateFactReferences(
  siteSpec: JsonObject,
  profile: JsonObject,
): void {
  const facts = new Map<string, JsonObject>(
    profile.facts.map((fact: JsonObject) => [fact.fact_id, fact]),
  );
  const copies: JsonObject[] = [];
  for (const item of siteSpec.navigation) copies.push(item.label);
  for (const page of siteSpec.pages) {
    copies.push(page.title, page.meta_description);
    for (const section of page.sections) {
      copies.push(section.heading, ...section.body);
      for (const item of section.items) copies.push(item.title, item.text);
      if (section.cta) copies.push(section.cta.label);
    }
  }
  for (const copy of copies) {
    for (const factId of copy.fact_ids) {
      const fact = facts.get(factId);
      if (
        !fact ||
        fact.value === null ||
        fact.verification === "conflicting" ||
        fact.verification === "unknown"
      ) {
        throw new Error(`Copy references unavailable fact: ${factId}`);
      }
    }
  }
}

export async function renderSite({
  leadId,
  siteSpec,
  profile,
  assets,
  outputDir,
  mode,
}: RenderArgs): Promise<{
  artifactDir: string;
  manifest: JsonObject;
  hash: string;
  contentHash: string;
  build: JsonObject;
}> {
  if (!leadId) throw new Error("Renderer requires the owning lead ID");
  validate("SiteSpec", siteSpec);
  validate("Profile", profile);
  validateFactReferences(siteSpec, profile);
  const routes = new Set<string>();
  for (const page of siteSpec.pages) {
    routeParts(page.route);
    if (routes.has(page.route))
      throw new Error(`Duplicate route: ${page.route}`);
    routes.add(page.route);
  }
  for (const item of siteSpec.navigation) {
    hrefForRoute(item.route);
    if (!routes.has(item.route))
      throw new Error(`Navigation references unknown route: ${item.route}`);
  }

  const renderId = id();
  const stagingDir = path.join(outputDir, `artifact-${renderId}`);
  await mkdir(stagingDir, { recursive: true });
  const preparedAssets = await prepareAssets(siteSpec, assets, stagingDir);
  await writeFile(
    path.join(stagingDir, "assets", "site.css"),
    `${CSS}\n`,
    "utf8",
  );
  const pageHashes: Array<{ route: string; hash: string }> = [];
  for (const page of siteSpec.pages) {
    const html = `<!doctype html>${renderToStaticMarkup(<Document page={page} siteSpec={siteSpec} profile={profile} assetUrls={preparedAssets.urls} />)}\n`;
    const outputFile = outputFileFor(stagingDir, page.route);
    await mkdir(path.dirname(outputFile), { recursive: true });
    await writeFile(outputFile, html, "utf8");
    pageHashes.push({ route: page.route, hash: hash(html) });
  }
  const integrityFiles = listArtifactFiles(stagingDir).map((relativePath) => ({
    path: relativePath,
    sha256: createHash("sha256")
      .update(readFileSync(path.join(stagingDir, relativePath)))
      .digest("hex"),
  }));
  const contentHash = hash(integrityFiles);
  const createdAt = now();
  const expiresAt = new Date(
    Date.parse(createdAt) + 60 * 60 * 1000,
  ).toISOString();
  const manifest = validate("ArtifactManifest", {
    manifest_id: renderId,
    lead_id: leadId,
    site_spec_hash: hash(siteSpec),
    renderer_hash: hash({
      renderer_version: RENDERER_VERSION,
      content_hash: contentHash,
    }),
    asset_hashes: preparedAssets.hashes,
    facts_hash: hash(profile.facts),
    preview_policy_hash: hash(PREVIEW_POLICY_VERSION),
    test_config_hash: hash(TEST_CONFIG),
    deployment_hash: null,
    created_at: createdAt,
    expires_at: expiresAt,
    mode,
  });
  const manifestHash = hash(manifest);
  const build = validate("BuildResult", {
    artifact_hash: manifestHash,
    renderer_version: RENDERER_VERSION,
    result: "pass",
    evidence_ids: [],
  });
  await writeFile(
    path.join(stagingDir, "integrity.json"),
    `${JSON.stringify({ version: 1, content_hash: contentHash, files: integrityFiles }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(stagingDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(stagingDir, "build.json"),
    `${JSON.stringify(build, null, 2)}\n`,
    "utf8",
  );
  return {
    artifactDir: stagingDir,
    manifest,
    hash: manifestHash,
    contentHash,
    build,
  };
}

const METADATA_FILES = new Set([
  "build.json",
  "integrity.json",
  "manifest.json",
]);

function listArtifactFiles(root: string, relative = ""): string[] {
  const directory = path.join(root, relative);
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink())
      throw new Error(`Artifact integrity violation: symbolic link ${child}`);
    if (entry.isDirectory()) files.push(...listArtifactFiles(root, child));
    else if (entry.isFile() && !METADATA_FILES.has(child)) files.push(child);
    else if (!entry.isFile())
      throw new Error(
        `Artifact integrity violation: unsupported entry ${child}`,
      );
  }
  return files.sort();
}

export function verifyArtifact({
  artifactDir,
  expectedHash,
}: {
  artifactDir: string;
  expectedHash?: string;
}): {
  manifest: JsonObject;
  build: JsonObject;
  hash: string;
  contentHash: string;
} {
  const root = realpathSync(artifactDir);
  const rootStats = lstatSync(root);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink())
    throw new Error("Artifact integrity violation: invalid artifact directory");
  let manifest: JsonObject;
  let build: JsonObject;
  let integrity: JsonObject;
  try {
    manifest = validate(
      "ArtifactManifest",
      JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8")),
    );
    build = validate(
      "BuildResult",
      JSON.parse(readFileSync(path.join(root, "build.json"), "utf8")),
    );
    integrity = JSON.parse(
      readFileSync(path.join(root, "integrity.json"), "utf8"),
    ) as JsonObject;
  } catch (error) {
    throw new Error("Artifact integrity violation: metadata is invalid", {
      cause: error,
    });
  }
  if (
    integrity.version !== 1 ||
    typeof integrity.content_hash !== "string" ||
    !Array.isArray(integrity.files)
  )
    throw new Error("Artifact integrity violation: malformed integrity record");
  const actualPaths = listArtifactFiles(root);
  const recordedPaths = integrity.files
    .map((file: JsonObject) => file.path)
    .sort();
  if (
    new Set(recordedPaths).size !== recordedPaths.length ||
    JSON.stringify(actualPaths) !== JSON.stringify(recordedPaths)
  )
    throw new Error("Artifact integrity violation: file set changed");
  const actualFiles = actualPaths.map((relativePath) => ({
    path: relativePath,
    sha256: createHash("sha256")
      .update(readFileSync(path.join(root, relativePath)))
      .digest("hex"),
  }));
  if (JSON.stringify(actualFiles) !== JSON.stringify(integrity.files))
    throw new Error("Artifact integrity violation: file contents changed");
  const contentHash = hash(actualFiles);
  if (
    contentHash !== integrity.content_hash ||
    manifest.renderer_hash !==
      hash({
        renderer_version: build.renderer_version,
        content_hash: contentHash,
      })
  )
    throw new Error("Artifact integrity violation: renderer binding changed");
  const manifestHash = hash(manifest);
  if (
    build.artifact_hash !== manifestHash ||
    (expectedHash !== undefined && expectedHash !== manifestHash)
  )
    throw new Error("Artifact integrity violation: manifest hash changed");
  return { manifest, build, hash: manifestHash, contentHash };
}
