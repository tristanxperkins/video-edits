#!/usr/bin/env node
// Transcribe locally with OpenAI Whisper, then normalize to the kit's format.
// Free and offline: no API key, nothing is uploaded.
//
// Usage:
//   node scripts/transcribe-whisper.mjs <input> [--model turbo] [--language en]
//        [--output <path>] [--force]
//
// Writes:
//   <input-dir>/whisper-raw/<stem>.json   Whisper's own JSON (kept for audit)
//   <input-dir>/<stem>.json               kit transcript {text, audio_duration_secs, words}
//
// Finds Whisper in this order: $WHISPER_BIN, .venv-whisper (Windows or POSIX
// layout) in the workspace root, then `whisper` on PATH. Setup:
//   py -3.12 -m venv .venv-whisper            (Windows; python3.12 elsewhere)
//   .venv-whisper\Scripts\pip install -U openai-whisper
// The model downloads once on first use (turbo is about 1.5 GB).

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename, extname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { argv, exit, env, platform } from "node:process";
import { fileURLToPath } from "node:url";
import { normalizeWhisper, probeDuration } from "./normalize-whisper.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const die = (m, c = 1) => { console.error(m); exit(c); };

const args = argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log("Usage: node scripts/transcribe-whisper.mjs <input> [--model turbo] [--language en] [--output path] [--force]");
  exit(args.length === 0 ? 1 : 0);
}
const opts = { input: null, model: "turbo", language: "en", output: null, force: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--model") opts.model = args[++i];
  else if (a === "--language" || a === "--lang") opts.language = args[++i];
  else if (a === "--output" || a === "-o") opts.output = args[++i];
  else if (a === "--force") opts.force = true;
  else if (a.startsWith("--")) die(`unknown option: ${a}`);
  else if (!opts.input) opts.input = a;
  else die(`unexpected argument: ${a}`);
}
const inputPath = resolve(opts.input);
if (!existsSync(inputPath)) die(`input not found: ${inputPath}`);
const dir = dirname(inputPath);
const stem = basename(inputPath, extname(inputPath));
const outputPath = resolve(opts.output ?? join(dir, `${stem}.json`));
if (outputPath === inputPath) die("output would overwrite the input; pass --output");
if (existsSync(outputPath) && !opts.force) {
  die(`transcript already exists: ${outputPath}\nReuse it, or pass --force to transcribe again.`);
}

function findWhisper() {
  const candidates = [
    env.WHISPER_BIN,
    join(ROOT, ".venv-whisper", "Scripts", "whisper.exe"),
    join(ROOT, ".venv-whisper", "bin", "whisper"),
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  const probe = spawnSync(platform === "win32" ? "where" : "which", ["whisper"], { encoding: "utf8" });
  if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim().split(/\r?\n/)[0];
  die("Whisper not found. Create .venv-whisper and pip install openai-whisper (see the header of this script).");
}

const whisper = findWhisper();
const rawDir = join(dir, "whisper-raw");
mkdirSync(rawDir, { recursive: true });
console.log(`whisper ${opts.model} (local) -> ${rawDir}`);
const t0 = Date.now();
const run = spawnSync(
  whisper,
  [
    inputPath,
    "--model", opts.model,
    "--language", opts.language,
    "--word_timestamps", "True",
    "--output_format", "json",
    "--output_dir", rawDir,
    "--verbose", "False",
  ],
  { stdio: "inherit" },
);
if (run.error) die(`could not start Whisper: ${run.error.message}`);
if (run.status !== 0) die(`Whisper exited with code ${run.status}`, run.status ?? 1);

const rawPath = join(rawDir, `${stem}.json`);
if (!existsSync(rawPath)) die(`Whisper finished but ${rawPath} is missing`);
try {
  const { transcript, warnings } = normalizeWhisper(JSON.parse(readFileSync(rawPath, "utf8")), probeDuration(inputPath));
  transcript.source.model = opts.model;
  for (const w of warnings) console.warn(`warning: ${w}`);
  writeFileSync(outputPath, JSON.stringify(transcript, null, 2) + "\n");
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`ok ${dt}s | ${transcript.words.length} words | ${transcript.audio_duration_secs}s audio | ${warnings.length} warning(s) | ${outputPath}`);
} catch (err) {
  die(err.message);
}
