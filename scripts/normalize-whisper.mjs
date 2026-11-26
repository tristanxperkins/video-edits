#!/usr/bin/env node
// Convert OpenAI Whisper JSON (run with --word_timestamps True) into the kit's
// common transcript format:
//   { text, audio_duration_secs, words: [{ text, start, end, probability }] }
//
// Usage:
//   node scripts/normalize-whisper.mjs <whisper.json> --media <source video/audio>
//        [--output <path>] [--strict]
//
// - audio_duration_secs comes from ffprobe on --media (the exact source file
//   the transcript was made from), never from the transcript.
// - Word times are copied as-is (rounded to the millisecond). Nothing is invented
//   or shifted. Suspicious words are reported as warnings so the editor checks
//   them against the audio; --strict turns warnings into a failure.
// - Brand names in BRAND_SPELLINGS are corrected in the text (e.g. "Wedflex" ->
//   "WedFlex"); times are never touched. The count is in source.spelling_fixes.
// - Default output: <whisper-stem>.words.json next to the Whisper JSON.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename, extname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { argv, exit } from "node:process";
import { fileURLToPath } from "node:url";

const LOW_PROBABILITY = 0.4;
const round = (n) => Math.round(n * 1000) / 1000;

// Brand names Whisper gets wrong, fixed in word and full text (times untouched).
// Add a row when a new misspelling turns up.
export const BRAND_SPELLINGS = [
  [/\bwed[-\s]?flex\b/gi, "WedFlex"],
];

export function fixSpellings(text) {
  let fixes = 0;
  let out = String(text);
  for (const [pattern, right] of BRAND_SPELLINGS) {
    out = out.replace(pattern, (m) => {
      if (m !== right) fixes++;
      return right;
    });
  }
  return { text: out, fixes };
}

export function probeDuration(mediaPath) {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", mediaPath],
    { encoding: "utf8" },
  );
  if (r.error) throw new Error(`ffprobe not found on PATH (${r.error.code})`);
  if (r.status !== 0) throw new Error(`ffprobe failed on ${mediaPath}: ${r.stderr.trim()}`);
  const d = Number(r.stdout.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`ffprobe returned no duration for ${mediaPath}`);
  return d;
}

export function normalizeWhisper(whisper, audioDurationSecs) {
  if (!whisper || !Array.isArray(whisper.segments)) {
    throw new Error("not a Whisper JSON file: no `segments` array");
  }
  const raw = whisper.segments.flatMap((s) => (Array.isArray(s.words) ? s.words : []));
  if (raw.length === 0) {
    throw new Error("no word timestamps found; rerun whisper with --word_timestamps True");
  }
  const words = [];
  const warnings = [];
  let spellingFixes = 0;
  for (const w of raw) {
    const fixed = fixSpellings(String(w.word ?? w.text ?? "").trim());
    const text = fixed.text;
    if (!text) continue;
    spellingFixes += fixed.fixes;
    const start = Number(w.start);
    const end = Number(w.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error(`word "${text}" has no numeric start/end`);
    }
    const word = { text, start: round(start), end: round(end) };
    if (Number.isFinite(Number(w.probability))) word.probability = round(Number(w.probability));
    const at = `"${text}" @ ${word.start.toFixed(2)}s`;
    if (word.end < word.start) throw new Error(`word ${at} ends before it starts`);
    if (word.end === word.start) warnings.push(`zero-length word ${at}`);
    const prev = words.at(-1);
    if (prev && word.start < prev.end) warnings.push(`word ${at} overlaps "${prev.text}" by ${(prev.end - word.start).toFixed(3)}s`);
    if (prev && word.start < prev.start) throw new Error(`word ${at} starts before the previous word; timestamps out of order`);
    if (word.probability !== undefined && word.probability < LOW_PROBABILITY) {
      warnings.push(`low-confidence word ${at} (p=${word.probability})`);
    }
    words.push(word);
  }
  if (words.length === 0) throw new Error("Whisper JSON contains only empty words");
  const duration = round(audioDurationSecs);
  if (words.at(-1).end > duration + 0.05) {
    throw new Error(
      `last word ends at ${words.at(-1).end}s but the media is ${duration}s; ` +
        "is --media the same file that was transcribed?",
    );
  }
  const text = fixSpellings(String(whisper.text ?? words.map((w) => w.text).join(" ")).trim()).text;
  const out = { text, audio_duration_secs: duration, words };
  if (whisper.language) out.language_code = whisper.language;
  out.source = { provider: "openai-whisper" };
  if (spellingFixes) out.source.spelling_fixes = spellingFixes;
  return { transcript: out, warnings, spellingFixes };
}

function main() {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(
      "Usage: node scripts/normalize-whisper.mjs <whisper.json> --media <source> [--output path] [--strict]",
    );
    exit(args.length === 0 ? 1 : 0);
  }
  let input = null, media = null, output = null, strict = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--media") media = args[++i];
    else if (a === "--output" || a === "-o") output = args[++i];
    else if (a === "--strict") strict = true;
    else if (a.startsWith("--")) { console.error(`unknown option: ${a}`); exit(1); }
    else if (!input) input = a;
    else { console.error(`unexpected argument: ${a}`); exit(1); }
  }
  if (!input) { console.error("no Whisper JSON given"); exit(1); }
  if (!media) { console.error("--media <source file> is required (audio duration comes from ffprobe)"); exit(1); }
  const inputPath = resolve(input);
  const mediaPath = resolve(media);
  for (const p of [inputPath, mediaPath]) if (!existsSync(p)) { console.error(`not found: ${p}`); exit(1); }
  const outputPath = resolve(
    output ?? join(dirname(inputPath), `${basename(inputPath, extname(inputPath))}.words.json`),
  );
  if (outputPath === inputPath) { console.error("output would overwrite the Whisper JSON; pass --output"); exit(1); }

  try {
    const whisper = JSON.parse(readFileSync(inputPath, "utf8"));
    const { transcript, warnings } = normalizeWhisper(whisper, probeDuration(mediaPath));
    for (const w of warnings) console.warn(`warning: ${w}`);
    if (strict && warnings.length) { console.error(`${warnings.length} warning(s) with --strict; not written`); exit(2); }
    writeFileSync(outputPath, JSON.stringify(transcript, null, 2) + "\n");
    console.log(
      `ok | ${transcript.words.length} words | ${transcript.audio_duration_secs}s audio | ` +
        `${warnings.length} warning(s) | ${outputPath}`,
    );
  } catch (err) {
    console.error(err.message);
    exit(1);
  }
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(argv[1] ?? "")) main();
