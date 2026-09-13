import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type ServerResponse } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { verifyArtifact } from "./renderer.js";

type PreviewArgs = {
  artifactDir: string;
  token: string;
  port?: number;
  expiresAt?: string;
};

const CSP =
  "default-src 'none'; img-src 'self' data:; style-src 'self'; font-src 'self'; form-action 'none'; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'";
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".json": "application/json; charset=utf-8",
};

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function equalSecret(left: string, rightDigest: Buffer): boolean {
  const leftDigest = digest(left);
  return timingSafeEqual(leftDigest, rightDigest);
}

function headers(response: ServerResponse): void {
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

function cookieValue(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "factory_preview") return rest.join("=");
  }
  return undefined;
}

function candidateFile(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return null;
  const pieces = decoded.split("/").filter(Boolean);
  if (pieces.some((piece) => piece === "." || piece === "..")) return null;
  const relative = pieces.length === 0 ? "index.html" : path.join(...pieces);
  const withIndex = path.extname(relative)
    ? relative
    : path.join(relative, "index.html");
  const resolved = path.resolve(root, withIndex);
  return resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}

export async function startPreview({
  artifactDir,
  token,
  port = 0,
  expiresAt,
}: PreviewArgs): Promise<{ url: string; close: () => Promise<void> }> {
  if (!token) throw new Error("Preview token must not be empty");
  const root = await realpath(artifactDir);
  if (!(await stat(root)).isDirectory())
    throw new Error("Preview artifact must be a directory");
  const tokenDigest = digest(token);
  const sessionToken = tokenDigest.toString("hex");
  const sessionDigest = digest(sessionToken);
  const initialArtifact = verifyArtifact({ artifactDir: root });
  const manifestExpires = Date.parse(initialArtifact.manifest.expires_at);
  const requestedExpires =
    expiresAt === undefined ? manifestExpires : Date.parse(expiresAt);
  const expires = Math.min(manifestExpires, requestedExpires);
  if (!Number.isFinite(expires)) throw new Error("Invalid preview expiry");

  const server = createServer(async (request, response) => {
    headers(response);
    try {
      verifyArtifact({ artifactDir: root, expectedHash: initialArtifact.hash });
    } catch {
      return end(response, 409, "Artifact integrity check failed");
    }
    if (Date.now() >= expires) return end(response, 410, "Preview expired");
    if (request.method !== "GET" && request.method !== "HEAD")
      return end(response, 405, "Method not allowed");
    const host = request.headers.host ?? "127.0.0.1";
    const origin = `http://${host}`;
    if (request.headers.origin && request.headers.origin !== origin)
      return end(response, 403, "Origin denied");
    const requestUrl = new URL(request.url ?? "/", origin);
    const suppliedToken = requestUrl.searchParams.get("token");
    if (suppliedToken !== null) {
      if (!equalSecret(suppliedToken, tokenDigest))
        return end(response, 401, "Preview token required");
      requestUrl.searchParams.delete("token");
      const maxAge = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      response.statusCode = 303;
      response.setHeader(
        "Set-Cookie",
        `factory_preview=${sessionToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`,
      );
      response.setHeader(
        "Location",
        `${requestUrl.pathname}${requestUrl.search}`,
      );
      return response.end();
    }
    const session = cookieValue(request.headers.cookie);
    if (!session || !equalSecret(session, sessionDigest))
      return end(response, 401, "Preview token required");
    const filename = candidateFile(root, requestUrl.pathname);
    if (!filename) return end(response, 404, "Not found");
    try {
      const resolved = await realpath(filename);
      if (!resolved.startsWith(`${root}${path.sep}`))
        return end(response, 404, "Not found");
      const body = await readFile(resolved);
      response.statusCode = 200;
      response.setHeader(
        "Content-Type",
        MIME[path.extname(resolved).toLowerCase()] ??
          "application/octet-stream",
      );
      response.setHeader("Content-Length", body.byteLength);
      if (request.method === "HEAD") return response.end();
      response.end(body);
    } catch {
      end(response, 404, "Not found");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Preview server did not bind a TCP port");
  let closed = false;
  return {
    url: `http://127.0.0.1:${address.port}/?token=${encodeURIComponent(token)}`,
    close: async () => {
      if (closed) return;
      closed = true;
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
