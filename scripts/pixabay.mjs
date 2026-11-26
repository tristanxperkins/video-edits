#!/usr/bin/env node
// Pixabay video search and download for B-roll (free API; no paid calls).
// Use only after footage the user owns (raw-media/broll) has been checked.
//
//   node scripts/pixabay.mjs search "<query>" [--vertical|--horizontal] [--min-secs 4]
//        [--per-page N] [--type film|animation|all]
//   (--per-page defaults to 20, or 200 with --vertical/--horizontal: orientation
//    is filtered locally and most stock video is horizontal)
//   node scripts/pixabay.mjs download <id> --project <slug> [--size large|medium|small]
//        [--use "what it illustrates"]
//
// Key: PIXABAY_API_KEY from the environment or the workspace .env. The key is
// never printed; error messages are scrubbed of it.
// Search results are cached for 24 hours in tmp/pixabay-cache (Pixabay's API
// terms ask clients to cache). Downloads are saved locally (no hotlinking) to
// video-projects/<slug>/assets/broll/ and logged in that project's CREDITS.md.

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { argv, exit, env } from "node:process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://pixabay.com/api/videos/";
const CACHE_DIR = join(ROOT, "tmp", "pixabay-cache");
const CACHE_MS = 24 * 60 * 60 * 1000;

export function loadKey(rootDir = ROOT, environment = env) {
  if (environment.PIXABAY_API_KEY) return environment.PIXABAY_API_KEY.trim();
  const dotenv = join(rootDir, ".env");
  if (!existsSync(dotenv)) return null;
  for (const line of readFileSync(dotenv, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*PIXABAY_API_KEY\s*=\s*(.*?)\s*$/);
    if (m && m[1]) return m[1].replace(/^["']|["']$/g, "");
  }
  return null;
}

const scrub = (text, key) => (key ? String(text).split(key).join("<PIXABAY_API_KEY>") : String(text));

export function summarizeHit(hit) {
  const best = hit.videos?.large?.url ? hit.videos.large : hit.videos?.medium ?? hit.videos?.small;
  return {
    id: hit.id,
    pageURL: hit.pageURL,
    duration: hit.duration,
    width: best?.width ?? 0,
    height: best?.height ?? 0,
    orientation: best && best.height > best.width ? "vertical" : "horizontal",
    tags: hit.tags,
    author: hit.user,
    thumbnail: best?.thumbnail ?? null,
  };
}

// Pixabay's video API cannot filter by orientation, so the filter runs locally.
// Most stock video is horizontal: with an orientation filter, check the maximum
// page (200) unless the user set --per-page.
export function pageSize(perPageArg, orientation) {
  const asked = perPageArg ?? (orientation ? 200 : 20);
  return Math.min(200, Math.max(3, Number(asked) || 20));
}

export function filterHits(hits, { orientation = null, minSecs = 0 } = {}) {
  return hits
    .map(summarizeHit)
    .filter((h) => h.duration >= minSecs)
    .filter((h) => !orientation || h.orientation === orientation);
}

export function creditsRow({ file, hit, use, date }) {
  const cell = (s) => String(s ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
  return `| ${cell(file)} | Pixabay video ${hit.id} | ${cell(hit.pageURL)} | ${cell(hit.user)} | Pixabay Content License | ${cell(use)} | ${date} |\n`;
}

export const CREDITS_HEADER =
  "# Credits\n\nEvery third-party asset in this video. Add a row before the asset is used.\n\n" +
  "| File | Source | URL / ID | Author | License | Used for | Added |\n" +
  "| --- | --- | --- | --- | --- | --- | --- |\n";

async function apiGet(params, key) {
  const qs = new URLSearchParams({ ...params, key });
  const cacheKey = createHash("sha256").update(JSON.stringify(params)).digest("hex").slice(0, 24);
  const cachePath = join(CACHE_DIR, `${cacheKey}.json`);
  if (existsSync(cachePath) && Date.now() - statSync(cachePath).mtimeMs < CACHE_MS) {
    return JSON.parse(readFileSync(cachePath, "utf8"));
  }
  let res;
  try {
    res = await fetch(`${API}?${qs}`);
  } catch (err) {
    throw new Error(`Pixabay request failed: ${scrub(err.message, key)}`);
  }
  if (!res.ok) throw new Error(`Pixabay HTTP ${res.status}: ${scrub(await res.text(), key).slice(0, 300)}`);
  const json = await res.json();
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, JSON.stringify(json));
  return json;
}

async function main() {
  const [cmd, ...rest] = argv.slice(2);
  if (!cmd || cmd === "--help" || cmd === "-h") {
    const lines = readFileSync(fileURLToPath(import.meta.url), "utf8").split(/\r?\n/).slice(1);
    const header = lines.slice(0, lines.findIndex((l) => !l.startsWith("//")));
    console.log(header.map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    exit(cmd ? 0 : 1);
  }
  const key = loadKey();
  if (!key) {
    console.error("PIXABAY_API_KEY is not set. Add it to .env (PIXABAY_API_KEY=...) and run again.");
    exit(1);
  }
  const opt = (name, fallback = null) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : fallback;
  };

  if (cmd === "search") {
    const valued = new Set(["--min-secs", "--per-page", "--type"]);
    const q = rest.find((a, i) => !a.startsWith("--") && !valued.has(rest[i - 1]));
    if (!q) throw new Error("search needs a query");
    const orientation = rest.includes("--vertical") ? "vertical" : rest.includes("--horizontal") ? "horizontal" : null;
    const params = {
      q: q.slice(0, 100),
      safesearch: "true",
      per_page: String(pageSize(opt("--per-page"), orientation)),
      video_type: opt("--type", "film"),
    };
    const json = await apiGet(params, key);
    const checked = json.hits?.length ?? 0;
    const hits = filterHits(json.hits ?? [], { orientation, minSecs: Number(opt("--min-secs", 0)) });
    console.log(`${hits.length} match (checked ${checked} of ${json.totalHits ?? 0} results) for "${q}"${orientation ? ` (${orientation})` : ""}`);
    for (const h of hits) {
      console.log(`- ${h.id} | ${h.duration}s | ${h.width}x${h.height} | ${h.author} | ${h.tags}\n  ${h.pageURL}\n  thumb: ${h.thumbnail}`);
    }
    console.log("\nFor ads: check each candidate for recognizable faces and visible brand logos before downloading.");
    return;
  }

  if (cmd === "download") {
    const id = rest[0];
    const slug = opt("--project");
    if (!/^\d+$/.test(id ?? "")) throw new Error("download needs a numeric Pixabay video id");
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("--project <slug> is required");
    const project = join(ROOT, "video-projects", slug);
    if (!existsSync(project)) throw new Error(`project not found: video-projects/${slug}`);
    const json = await apiGet({ id }, key);
    const hit = json.hits?.[0];
    if (!hit) throw new Error(`no Pixabay video with id ${id}`);
    const size = opt("--size", "large");
    const variant = hit.videos?.[size]?.url ? hit.videos[size] : hit.videos?.medium;
    if (!variant?.url) throw new Error(`no downloadable rendition for ${id}`);
    const res = await fetch(variant.url);
    if (!res.ok) throw new Error(`download HTTP ${res.status}`);
    const dir = join(project, "assets", "broll");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `pixabay-${id}.mp4`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    const credits = join(project, "CREDITS.md");
    if (!existsSync(credits)) writeFileSync(credits, CREDITS_HEADER);
    appendFileSync(credits, creditsRow({
      file: `assets/broll/pixabay-${id}.mp4`,
      hit,
      use: opt("--use", ""),
      date: new Date().toISOString().slice(0, 10),
    }));
    console.log(`saved ${variant.width}x${variant.height} ${hit.duration}s -> video-projects/${slug}/assets/broll/pixabay-${id}.mp4`);
    console.log(`logged ${hit.pageURL} in video-projects/${slug}/CREDITS.md`);
    return;
  }
  throw new Error(`unknown command: ${cmd}`);
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(argv[1] ?? "")) {
  main().catch((err) => {
    console.error(scrub(err.message, loadKey()));
    exit(1);
  });
}
