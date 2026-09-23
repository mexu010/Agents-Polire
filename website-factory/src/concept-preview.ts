import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type ServerResponse } from "node:http";
import { lstat, readFile, realpath } from "node:fs/promises";
import type { JsonObject } from "./contracts.js";
import { startPreview } from "./preview.js";
import { verifyArtifact } from "./renderer.js";

type ConceptPreviewArgs = { review: JsonObject; port?: number };
type Screenshot = { filename: string; sha256: string };

const CSP =
  "default-src 'none'; img-src 'self'; style-src 'self'; form-action 'none'; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'";

const digest = (value: string): Buffer =>
  createHash("sha256").update(value).digest();

const equalSecret = (value: string, expected: Buffer): boolean =>
  timingSafeEqual(digest(value), expected);

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function securityHeaders(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.setHeader("Content-Security-Policy", CSP);
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("X-Frame-Options", "DENY");
}

function end(response: ServerResponse, status: number, message: string): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.end(message);
}

function sessionCookie(value: string | undefined): string | undefined {
  for (const part of value?.split(";") ?? []) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "factory_concepts") return rest.join("=");
  }
  return undefined;
}

const css = `
:root{color-scheme:light;background:#f2efe8;color:#191815;font:16px/1.5 system-ui,sans-serif}*{box-sizing:border-box}body{margin:0}main{max-width:1500px;margin:auto;padding:32px}header{margin-bottom:28px}.eyebrow{font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.concept-card{display:flex;flex-direction:column;background:#fff;border:1px solid #d8d2c7;border-radius:16px;overflow:hidden}.copy{padding:20px}.profile{color:#625d53;font-size:.85rem}.desktop-frame{aspect-ratio:1.44;background:#dedad1;overflow:auto}.desktop-frame img{display:block;width:100%;height:auto}.copy{overflow-wrap:anywhere}.tradeoff{padding-top:12px;border-top:1px solid #e5e0d8}a{color:#191815;font-weight:700}details{margin-top:auto;border-top:1px solid #e5e0d8;padding:16px 20px}summary{cursor:pointer;font-weight:700}.mobile{display:block;max-width:375px;width:100%;height:auto;margin:16px auto 0;border:1px solid #d8d2c7}@media(max-width:900px){.grid{grid-template-columns:1fr}main{padding:20px}.desktop-frame{aspect-ratio:1.44}}
`;

function galleryHtml(
  review: JsonObject,
  artifactUrls: string[],
  screenshotRoutes: Array<{ desktop: string; mobile: string }>,
): string {
  const mode = review.mode === "live" ? "Live-Vorschau" : "Fixture-Vorschau";
  const cards = review.previews
    .map((preview: JsonObject, index: number) => {
      const concept = preview.concept as JsonObject;
      return `<article class="concept-card">
        <div class="desktop-frame"><img src="${screenshotRoutes[index].desktop}" alt="Desktopansicht ${escapeHtml(preview.conceptId)}"></div>
        <div class="copy"><p class="eyebrow">${escapeHtml(preview.conceptId)} · ${escapeHtml(concept.design_profile)}</p><h2>${escapeHtml(concept.title)}</h2><p>${escapeHtml(concept.rationale)}</p><p class="tradeoff"><strong>Abwägung:</strong> ${escapeHtml(concept.tradeoff)}</p><p><a href="${escapeHtml(artifactUrls[index])}">Geschützte Seitenvorschau öffnen</a></p><p>Im bestehenden CLI auswählen: <strong>${escapeHtml(preview.conceptId)}</strong></p></div>
        <details><summary>Mobile Ansicht</summary><img class="mobile" src="${screenshotRoutes[index].mobile}" alt="Mobile Ansicht ${escapeHtml(preview.conceptId)}"></details>
      </article>`;
    })
    .join("");
  return `<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Konzeptvergleich ${escapeHtml(review.runId)}</title><link rel="stylesheet" href="/gallery.css"></head><body><main><header><p class="eyebrow">${mode} · Revision ${escapeHtml(review.revision)}</p><h1>Drei Designrichtungen vergleichen</h1><p>Die Richtung über ihre ID im bestehenden CLI auswählen. Diese Ansicht ist schreibgeschützt.</p><p>${review.mode === "live" ? "" : "Synthetische Testfirma und simulierte Modellantworten; die Seiten und Browserbilder wurden tatsächlich erstellt. "}${escapeHtml(review.notice)}</p></header><section class="grid">${cards}</section></main></body></html>`;
}

export async function startConceptPreview({
  review,
  port = 0,
}: ConceptPreviewArgs): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  if (!Array.isArray(review.previews) || review.previews.length !== 3)
    throw new Error("Concept comparison requires exactly three previews");

  const previews: Array<{ close: () => Promise<void> }> = [];
  const screenshotFiles = new Map<string, Screenshot>();
  const artifactBindings: Array<{ artifactDir: string; hash: string }> = [];
  const screenshotRoutes: Array<{ desktop: string; mobile: string }> = [];
  const artifactUrls: string[] = [];
  let expires = Number.POSITIVE_INFINITY;

  try {
    for (const [index, preview] of review.previews.entries()) {
      const verified = verifyArtifact({
        artifactDir: preview.render.artifactDir,
        expectedHash: preview.render.hash,
      });
      artifactBindings.push({
        artifactDir: String(preview.render.artifactDir),
        hash: verified.hash,
      });
      const artifactExpiry = Date.parse(String(verified.manifest.expires_at));
      if (!Number.isFinite(artifactExpiry))
        throw new Error("Invalid concept preview expiry");
      expires = Math.min(expires, artifactExpiry);
      const protectedPreview = await startPreview({
        artifactDir: preview.render.artifactDir,
        token: randomBytes(32).toString("hex"),
      });
      previews.push(protectedPreview);
      artifactUrls.push(protectedPreview.url);

      const images = preview.browser?.images as JsonObject[];
      if (!Array.isArray(images) || images.length < 2)
        throw new Error("Concept preview needs desktop and mobile screenshots");
      const sorted = [...images].sort(
        (a, b) => Number(a.width) - Number(b.width),
      );
      const mobile = sorted[0];
      const desktop = sorted.at(-1)!;
      const routes = {
        desktop: `/screens/${encodeURIComponent(String(preview.conceptId))}/desktop`,
        mobile: `/screens/${encodeURIComponent(String(preview.conceptId))}/mobile`,
      };
      for (const [route, image] of [
        [routes.desktop, desktop],
        [routes.mobile, mobile],
      ] as const) {
        const filename = await realpath(String(image.path));
        const fileStat = await lstat(filename);
        if (!fileStat.isFile() || fileStat.isSymbolicLink())
          throw new Error("Concept screenshot must be a regular file");
        const body = await readFile(filename);
        const actualHash = createHash("sha256").update(body).digest("hex");
        if (actualHash !== image.sha256)
          throw new Error("Concept screenshot integrity check failed");
        screenshotFiles.set(route, { filename, sha256: String(image.sha256) });
      }
      screenshotRoutes[index] = routes;
    }
  } catch (error) {
    await Promise.allSettled(previews.map((preview) => preview.close()));
    throw error;
  }

  const token = randomBytes(32).toString("hex");
  const tokenDigest = digest(token);
  const sessionToken = tokenDigest.toString("hex");
  const sessionDigest = digest(sessionToken);
  const html = galleryHtml(review, artifactUrls, screenshotRoutes);
  let boundPort = 0;

  const server = createServer(async (request, response) => {
    securityHeaders(response);
    const host = request.headers.host ?? "";
    if (host !== `127.0.0.1:${boundPort}`)
      return end(response, 403, "Host denied");
    try {
      for (const artifact of artifactBindings)
        verifyArtifact({
          artifactDir: artifact.artifactDir,
          expectedHash: artifact.hash,
        });
    } catch {
      return end(response, 409, "Artifact integrity check failed");
    }
    if (Date.now() >= expires) return end(response, 410, "Preview expired");
    if (request.method !== "GET" && request.method !== "HEAD")
      return end(response, 405, "Method not allowed");
    const origin = `http://${host}`;
    if (request.headers.origin && request.headers.origin !== origin)
      return end(response, 403, "Origin denied");
    const requestUrl = new URL(request.url ?? "/", origin);
    const suppliedToken = requestUrl.searchParams.get("token");
    if (suppliedToken !== null) {
      if (!equalSecret(suppliedToken, tokenDigest))
        return end(response, 401, "Concept preview token required");
      requestUrl.searchParams.delete("token");
      response.statusCode = 303;
      response.setHeader(
        "Set-Cookie",
        `factory_concepts=${sessionToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.max(0, Math.floor((expires - Date.now()) / 1000))}`,
      );
      response.setHeader("Location", requestUrl.pathname + requestUrl.search);
      return response.end();
    }
    const session = sessionCookie(request.headers.cookie);
    if (!session || !equalSecret(session, sessionDigest))
      return end(response, 401, "Concept preview token required");

    if (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html") {
      response.statusCode = 200;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      if (request.method === "HEAD") return response.end();
      return response.end(html);
    }
    if (requestUrl.pathname === "/gallery.css") {
      response.statusCode = 200;
      response.setHeader("Content-Type", "text/css; charset=utf-8");
      if (request.method === "HEAD") return response.end();
      return response.end(css);
    }
    const screenshot = screenshotFiles.get(requestUrl.pathname);
    if (!screenshot) return end(response, 404, "Not found");
    try {
      const currentPath = await realpath(screenshot.filename);
      const currentStat = await lstat(currentPath);
      const body = await readFile(currentPath);
      const currentHash = createHash("sha256").update(body).digest("hex");
      if (
        currentPath !== screenshot.filename ||
        !currentStat.isFile() ||
        currentStat.isSymbolicLink() ||
        currentHash !== screenshot.sha256
      )
        return end(response, 409, "Screenshot integrity check failed");
      response.statusCode = 200;
      response.setHeader("Content-Type", "image/png");
      response.setHeader("Content-Length", body.byteLength);
      if (request.method === "HEAD") return response.end();
      response.end(body);
    } catch {
      end(response, 409, "Screenshot integrity check failed");
    }
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.off("error", reject);
        const address = server.address();
        if (!address || typeof address === "string")
          return reject(new Error("Concept preview did not bind a TCP port"));
        boundPort = address.port;
        resolve();
      });
    });
  } catch (error) {
    await Promise.allSettled(previews.map((preview) => preview.close()));
    throw error;
  }

  let closed = false;
  return {
    url: `http://127.0.0.1:${boundPort}/?token=${encodeURIComponent(token)}`,
    close: async () => {
      if (closed) return;
      closed = true;
      server.closeAllConnections();
      await Promise.all([
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
        ...previews.map((preview) => preview.close()),
      ]);
    },
  };
}
