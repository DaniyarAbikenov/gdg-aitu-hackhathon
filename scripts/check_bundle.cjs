#!/usr/bin/env node
// Fails when the production build grows past its size budget. Run after `npm run build`.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const dist = path.join(__dirname, "..", "frontend", "dist");
const LARGEST_CHUNK = 250 * 1024; // minified bytes, any single JavaScript file
const INITIAL_GZIP = 180 * 1024; // what the first page needs before rendering

const assets = path.join(dist, "assets");
const size = (file) => fs.statSync(path.join(assets, file)).size;
const gzip = (file) =>
  zlib.gzipSync(fs.readFileSync(path.join(assets, file)), { level: 9 }).length;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const scripts = fs.readdirSync(assets).filter((f) => f.endsWith(".js"));
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const initial = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map(
  (m) => m[1],
);
// Translations load right after start; count the largest language.
const languages = scripts.filter((f) => /^(en|ru|kz)-/.test(f));
const language = languages.sort((a, b) => size(b) - size(a))[0];

const problems = [];
for (const file of scripts)
  if (size(file) > LARGEST_CHUNK)
    problems.push(`${file} is ${kb(size(file))}, over ${kb(LARGEST_CHUNK)}`);
const first = [...initial, language].filter(Boolean);
const firstGzip = first.reduce((total, file) => total + gzip(file), 0);
if (firstGzip > INITIAL_GZIP)
  problems.push(
    `first page needs ${kb(firstGzip)} gzipped, over ${kb(INITIAL_GZIP)}`,
  );

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(
  `Bundle within budget: first page ${kb(firstGzip)} gzipped (${first.join(", ")}), largest chunk ${kb(Math.max(...scripts.map(size)))}.`,
);
