/**
 * Minimal static server for the exported `out/` directory.
 *
 * Two jobs:
 *   1. `npm run serve` — preview exactly what Cloudflare will receive, rather
 *      than the dev server, which behaves differently.
 *   2. Backs the Playwright `webServer`, so the suite tests the real artefact.
 *
 * Deliberately dependency-free. Node's http + fs is enough for a flat export.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const ROOT = resolve(process.argv[2] ?? "out");
const PORT = Number(process.env.PORT ?? 3100);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

async function readIfFile(path) {
  try {
    const body = await readFile(path);
    return body;
  } catch {
    return null;
  }
}

async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const safe = normalize(clean).replace(/^(\.\.[/\\])+/, "");

  // Refuse anything that escapes ROOT.
  const target = join(ROOT, safe);
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null;

  // Mirrors what a static host does: exact file, then a directory index, then
  // the extensionless route. Matches `trailingSlash: true` in next.config.
  for (const candidate of [
    target,
    join(target, "index.html"),
    `${target}.html`,
  ]) {
    const body = await readIfFile(candidate);
    if (body) return { body, path: candidate };
  }
  return null;
}

const server = createServer(async (req, res) => {
  const found = await resolveFile(req.url ?? "/");

  if (found) {
    res.writeHead(200, {
      "Content-Type": TYPES[extname(found.path)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(found.body);
    return;
  }

  const notFound = await readIfFile(join(ROOT, "404.html"));
  res.writeHead(404, { "Content-Type": TYPES[".html"] });
  res.end(notFound ?? "Not found");
});

server.listen(PORT, () => {
  console.log(`serving ${ROOT} → http://localhost:${PORT}`);
});
