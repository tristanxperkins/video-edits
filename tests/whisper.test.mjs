import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalizeWhisper } from '../scripts/normalize-whisper.mjs';

const root = resolve(import.meta.dirname, '..');
const fixture = JSON.parse(readFileSync(join(root, 'examples/editing/whisper-sample.json'), 'utf8'));
const scratch = () => mkdtempSync(join(tmpdir(), 'kit-whisper-test-'));

test('flattens Whisper segments into trimmed kit words with exact times', () => {
  const { transcript, warnings } = normalizeWhisper(fixture, 4.0);
  assert.equal(transcript.audio_duration_secs, 4);
  assert.deepEqual(transcript.words.map(w => w.text), ['Planning', 'a', 'wedding?', 'Start', 'here.']);
  assert.deepEqual(transcript.words[0], { text: 'Planning', start: 0.24, end: 0.72, probability: 0.981 });
  assert.equal(transcript.words.at(-1).end, 3.46);
  assert.equal(transcript.text, 'Planning a wedding? Start here.');
  assert.equal(transcript.language_code, 'en');
  assert.deepEqual(warnings, []);
});

test('warns on overlap, zero length and low confidence without changing times', () => {
  const doc = structuredClone(fixture);
  doc.segments[1].words[0] = { word: ' Start', start: 1.3, end: 1.3, probability: 0.2 };
  const { transcript, warnings } = normalizeWhisper(doc, 4.0);
  assert.equal(transcript.words[3].start, 1.3);
  assert.equal(transcript.words[3].end, 1.3);
  assert.equal(warnings.length, 3);
});

test('rejects transcripts without word timestamps or longer than the media', () => {
  assert.throws(() => normalizeWhisper({ segments: [{ text: 'hi', start: 0, end: 1 }] }, 2), /--word_timestamps True/);
  assert.throws(() => normalizeWhisper(fixture, 2.0), /same file/);
  assert.throws(() => normalizeWhisper({ text: 'x' }, 2), /segments/);
});

test('CLI reads duration from ffprobe and writes the kit format', { skip: spawnSync('ffprobe', ['-version']).status !== 0 && 'ffprobe missing' }, () => {
  const dir = scratch();
  const media = join(dir, 'clip.wav');
  const ff = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '4', media]);
  assert.equal(ff.status, 0, String(ff.stderr));
  const raw = join(dir, 'clip.json');
  writeFileSync(raw, JSON.stringify(fixture));
  const r = spawnSync(process.execPath, [join(root, 'scripts/normalize-whisper.mjs'), raw, '--media', media], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = join(dir, 'clip.words.json');
  assert.ok(existsSync(out));
  const doc = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(doc.audio_duration_secs, 4);
  assert.equal(doc.words.length, 5);
  // The normalized file feeds the cutting tools unchanged.
  const cut = spawnSync(process.execPath, [join(root, '.claude/skills/cut-silences/scripts/cut-silences.mjs'), out, '--out-dir', dir], { encoding: 'utf8' });
  assert.equal(cut.status, 0, cut.stderr);
});
