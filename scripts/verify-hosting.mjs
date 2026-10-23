/**
 * Hosting release gate: static AWS Amplify output must be complete.
 * No graphics are created by this script. Social images intentionally remain unset
 * until the owner approves real artwork and absolute public image URLs.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";

const root = process.cwd();
const dist = resolve(root, "apps/web/dist");
const mustExist = (path) => {
  assert.ok(existsSync(path), `Missing deploy file: ${path}`);
  assert.ok(statSync(path).isFile(), `Not a file: ${path}`);
};
const htmlPath = join(dist, "index.html");
mustExist(htmlPath);
mustExist(join(dist, "favicon.svg"));
mustExist(join(dist, "favicon.png"));
mustExist(join(dist, "apple-touch-icon.png"));
mustExist(join(dist, "brand/azelvori-symbol.svg"));
mustExist(join(dist, "brand/azelvori-logo-horizontal.svg"));
mustExist(join(dist, "brand/azelvori-social-cover.png"));
mustExist(join(dist, "brand/azelvori-home-hero.svg"));
mustExist(join(dist, "brand/azelvori-home-mobile.svg"));
mustExist(join(dist, "robots.txt"));

const html = readFileSync(htmlPath, "utf8");
const favicon = readFileSync(join(dist, "favicon.svg"), "utf8");
assert.match(html, /<title>AZELVORI STUDIO/);
assert.match(html, /property=["']og:title["']/);
assert.match(html, /property=["']og:description["']/);
assert.match(html, /property=["']og:site_name["']/);
assert.match(html, /name=["']twitter:card["']/);
assert.match(html, /href=["']\/favicon\.svg["']/);
assert.match(favicon, /<svg\b/);

const referenced = [...html.matchAll(/\b(?:src|href)=["'](\/[^"'?#]+)[^"']*["']/g)];
for (const match of referenced) {
  const relative = decodeURIComponent(match[1]).slice(1);
  if (!relative || relative.includes("..")) throw new Error(`Unsafe asset path: ${match[1]}`);
  mustExist(join(dist, relative));
}
const assets = join(dist, "assets");
assert.ok(existsSync(assets), "Vite assets directory missing");
assert.ok(readdirSync(assets).some((name) => extname(name) === ".js"), "No bundled JS assets");
assert.ok(readdirSync(assets).some((name) => extname(name) === ".css"), "No bundled CSS assets");

const config = readFileSync(resolve(root, "amplify.yml"), "utf8");
assert.match(config, /appRoot:\s*apps\/web/);
assert.match(config, /buildPath:\s*\//);
assert.match(config, /baseDirectory:\s*apps\/web\/dist/);
const rewrites = JSON.parse(readFileSync(resolve(root, "infrastructure/amplify-rewrites.json"), "utf8"));
assert.ok(rewrites.some((rule) => rule.target === "/index.html" && String(rule.status) === "200"), "Missing SPA rewrite rule");
if (html.includes('property="og:image"') || html.includes('name="twitter:image"')) {
  const social = [...html.matchAll(/(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']/g)];
  for (const match of social) {
    assert.ok(/^https:\/\//.test(match[1]), "Social image URLs must be absolute HTTPS URLs");
  }
}
console.log("Amplify brand assets and hosting preflight PASS: HTML, Vite bundles, favicon, robots, metadata, monorepo spec and SPA rewrite.");
