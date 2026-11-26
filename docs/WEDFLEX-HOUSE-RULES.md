# WedFlex house rules

This kit is configured for **WedFlex**, a wedding services marketplace, owned by
Tristan. Everything else follows Nate's defaults in
[EDITING-PLAYBOOK.md](EDITING-PLAYBOOK.md) and the skills. Where they disagree,
**this file wins** for WedFlex work. Brand details are in
[DESIGN.wedflex.md](../DESIGN.wedflex.md).

## 1. Approvals

- **Ask before any paid API call**, every time, with the service, what it will
  do, and the expected cost. Free local work (Whisper, FFmpeg, HyperFrames
  renders) and the free Pixabay API need no approval.
- **Never post, publish, upload, or send** a video or message anywhere. Deliver
  files in the project folder; Tristan posts.
- Never print, log, or commit API keys. Keys live only in the root `.env`.

## 2. Transcription: local Whisper

Local OpenAI Whisper replaces ElevenLabs Scribe. It is free and nothing leaves
the computer.

```sh
npm run transcribe:whisper -- video-projects/<slug>/assets/raw.mp4
```

This runs `whisper --model turbo --word_timestamps True --output_format json`
from `.venv-whisper`, keeps Whisper's raw output in `whisper-raw/`, and writes the
kit transcript `{text, audio_duration_secs, words:[{text,start,end}]}` next to the
source, with the duration read by ffprobe. To convert an existing Whisper JSON:

```sh
node scripts/normalize-whisper.mjs whisper.json --media raw.mp4 --output raw.json
```

- Reuse an existing transcript; pass `--force` only to redo it.
- Brand spelling: the normalizer corrects "Wedflex", "Wed Flex" and "wed-flex"
  to **WedFlex** in the words and text without touching times. Add any new
  misspelling to `BRAND_SPELLINGS` in `scripts/normalize-whisper.mjs`.
- Do not use `--prompt` (Whisper's initial prompt) by default: on real footage
  `--prompt "WedFlex"` invented a "WedFlex" in the trailing silence. If you use
  it, delete any word after the last real speech before cutting.
- Whisper often starts a word early after a pause, swallowing the silence into it
  (seen at 0.5-0.9 s on real footage). Never cut at a Whisper word start that
  follows a pause; find the real onset with
  `ffmpeg -i <clip> -af silencedetect=noise=-35dB:d=0.25 -f null -`.
- Whisper word ends are looser than Scribe's. Treat every warning (overlap,
  zero-length, low confidence) as a place to listen before cutting, and confirm
  cut points against the waveform. The normalizer never shifts or invents times.

## 3. B-roll sourcing order

Every shot still has to move (playbook rule). Pick the first source that fits:

1. **Footage Tristan owns** in `raw-media/broll/` (including WedFlex app screen
   recordings and Artlist clips he already made). Always search here first and
   list what you checked.
2. **Screen recording or animated UI mock** of the WedFlex app or site, per the
   playbook.
3. **Pixabay stock video**, only when nothing owned fits:
   ```sh
   node scripts/pixabay.mjs search "bride walking garden" --vertical --min-secs 4
   node scripts/pixabay.mjs download <id> --project <slug> --use "hook: walking down the aisle"
   ```
   - With `--vertical`/`--horizontal` the script checks 200 results (Pixabay
     cannot filter orientation, so it is done locally); the summary line says how
     many it checked.
   - Needs `PIXABAY_API_KEY` in `.env`. If it is missing, stop and ask Tristan to
     add it; never ask for the key in chat.
   - **For ads:** no recognizable faces and no visible brand logos or trademarks
     (check full-size frames of the whole interval used, including corners: signs,
     bottles, laptops, clothing). Prefer hands, details, backs, silhouettes, crowds
     out of focus, venues, and objects.
   - Do not imply that a person shown endorses WedFlex.
   - Download clips into the project (the script does); never hotlink.
   - Every Pixabay clip gets a row in the project's `CREDITS.md` with its Pixabay
     page URL (the script writes it; check it is there).
4. **AI video made in Artlist** for concrete metaphors stock cannot show. See §4.

Never use Kie.ai, ElevenLabs, Suno, or any other generator for WedFlex assets.

## 4. AI video: write Artlist prompts

Do not generate AI video. Write prompts for Tristan to run in Artlist (AI plan)
and save them in the project's `ARTLIST-PROMPTS.md`, one block per shot:

```md
### Shot 07: "stop overpaying for your DJ"  (anchor: "overpaying", 12.4 s)
- Purpose: the cost pain, made physical
- Aspect ratio: 9:16 (or 16:9 for long-form) · Generate: 5 s · Use: first 2.5 s
- Prompt: Slow push-in on a stack of wedding invoices on a linen tablecloth,
  a hand adding another invoice to the pile, warm golden-hour window light,
  shallow depth of field, soft lavender and cream tones, realistic, 35mm film look.
- Avoid: readable text, logos, faces looking at camera, extra hands, scene cuts.
- Continuity: matches shot 05 tablecloth and lighting (attach its last frame as the
  reference image).
- Save as: raw-media/broll/artlist-ai/<slug>-shot07.mp4
```

Prompt rules: one continuous camera move, physical and specific; describe light,
lens, and palette (cream, lavender, warm gold to sit with the brand); no on-screen
text (AI text turns to gibberish); plan to use the first continuous 2.5 s (models
often cut angles around 2.5 to 3 s); keep people consistent across shots and give
a reference frame. Tell Tristan when the prompts are ready, then wait for the clips.
Log each Artlist clip in `CREDITS.md` as "Artlist AI (Tristan's plan)".

## 5. Music and sound effects

- Use **only** files in `raw-media/music/` and `raw-media/sfx/`, licensed from
  Artlist or Pixabay. Each folder has a `SOURCES.md` table; a file without a row
  there is not used. Ask Tristan about it instead.
- **Never** download, generate, or use music or effects from anywhere else
  (no Suno, no ElevenLabs sound generation, no web downloads, no example-project
  tracks).
- Pick music by mood from `SOURCES.md` and the track itself, per the playbook
  (confident beat for claims and news, light groove for how-to, warm and romantic
  for real-wedding stories). Say which track you chose and why.
- Record every track and effect used in the project's `CREDITS.md` with its source
  and URL or ID from `SOURCES.md`.
- If no suitable track or effect exists, stop and ask Tristan to add one, with a
  suggested mood, tempo, and length.

## 6. CREDITS.md

`npm run new-video` creates it. Columns: File · Source · URL / ID · Author ·
License · Used for · Added. Every third-party asset (Pixabay, Artlist music, SFX,
Artlist AI clips) gets a row before it appears in a render. Check it during
verification.

## 7. Brand

Follow [DESIGN.wedflex.md](../DESIGN.wedflex.md): WedFlex palette, Montserrat
ExtraBold captions in one `#2a292a` box, Fraunces italic (not Abril Fatface) as the
serif accent, red `#ff3131` and green `#4cb051` for headline pops, logo files from
`assets/brand/`. A project's own `DESIGN.md` starts from it. The AI Automation
Society assets were removed; never reintroduce them.

## 8. The feedback loop

When Tristan gives a note on a draft:

1. Fix the edit.
2. **In the same turn, write the note into the relevant skill** (`.claude/skills/`)
   or this file as a concrete rule, check, or script change, then run
   `npm run sync:skills`. Do not ask whether to; it is standing approval.
3. Add a row to the log below: the note in his words, and where the rule now lives.

### Notes log

| Date | Tristan's note | Rule added (file and section) |
| --- | --- | --- |
