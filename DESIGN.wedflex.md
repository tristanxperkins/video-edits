# WedFlex design system

WedFlex is a wedding services marketplace. Videos should feel warm, trustworthy,
and modern: celebration without cliché. Tokens live in `assets/brand-tokens.css`;
fonts in `assets/fonts/` (SIL OFL); logos in `assets/brand/`.

## Logo

| File | Use |
| --- | --- |
| `assets/brand/wedflex-logo.png` | Full lockup: interlocked rings over the "WedFlex" wordmark. End card, CTA. |
| `assets/brand/wedflex-rings.png` | Ring mark alone. Corner bug, avatar, small placements, transitions. |

- The rings are one purple ring (`#603078`) interlocked with one lavender ring (`#c9b5d5`).
  Keep that pairing; never recolor the rings or separate them.
- Place on light backgrounds (`#f7f7f7`, `#ece5fa`, white) or on a lavender-mist card.
  On dark footage, put the logo on a light card rather than placing purple on black.
- Clear space around the lockup: at least the height of one ring.
- Source files: the PNGs here are transparent masters from the brand owner. Replace
  them with SVG masters when available; do not redraw the logo.
- Motion: the two rings may slide together and interlock as a reveal. That is the
  brand motif for openers, transitions, and the end card.

## Color

| Token | Hex | Role |
| --- | --- | --- |
| `--wf-purple` | `#603078` | Brand moments: logo, section cards, end card, CTA fills. Not caption text. |
| `--wf-lavender` | `#c9b5d5` | Concept or keyword captions; soft accents; caption box edge. |
| `--wf-lilac-mist` | `#ece5fa` | Light panels and cards. |
| `--wf-offwhite` | `#f7f7f7` | Light background. |
| `--wf-charcoal` | `#403f40` | Text and UI on light backgrounds. |
| `--wf-gray` | `#6b7280` | Secondary text. |
| `--wf-tan` | `#b89c76` | Fraunces italic serif accent; premium detail lines. |
| `--wf-red` | `#ff3131` | Eye-catching headlines: the wrong way, a loss, a shock stat. |
| `--wf-green` | `#4cb051` | Eye-catching headlines: the action, payoff, or saving. |
| `--wf-caption-box` | `#2a292a` | The one caption box for the whole reel. |

Measured contrast (WCAG ratio) for large bold text:

| Text color | on caption box `#2a292a` | on purple `#603078` | on off-white `#f7f7f7` |
| --- | --- | --- | --- |
| White | 14.5 | 9.6 | 1.1 (never) |
| Lavender `#c9b5d5` | 7.6 | 5.0 | 1.8 (never) |
| Tan `#b89c76` | 5.6 | 3.7 | 2.4 (never) |
| Green `#4cb051` | 5.3 | 3.5 | 2.6 (never) |
| Red `#ff3131` | 4.0 | 2.6 (avoid) | 3.4 |

Rules:
- Red and green are for large, bold headline words only (captions at 62 px and
  up, title text). Never use them for small labels or body text.
- Never put red text on purple. On light backgrounds, use red or green as a solid
  block behind white or charcoal text instead of as the text color.
- `#403f40` stays the text charcoal on light scenes; the darker `#2a292a` is used
  only for the caption box so every caption color passes 3:1.

## Type

- **Captions and headlines:** Montserrat ExtraBold (800), all caps, 62 to 64 px at
  1080 wide.
- **Serif accent:** Fraunces Bold Italic (700), sentence case, on 5 to 20% of caption
  chunks for soft, emotional, or premium words ("forever", "your day", "finally").
  Color it tan `#b89c76` or white. Never two serif chunks in a row. Fraunces replaces
  Nate's Abril Fatface everywhere in WedFlex work.
- Load fonts from `assets/fonts/` with `@font-face` (already in `brand-tokens.css`).
  Await `document.fonts.ready` before any canvas capture.

## Caption color system

Color 25 to 45% of chunks, whole chunk only:

| Meaning | Color |
| --- | --- |
| The wrong way, a loss, a shock headline ("STOP OVERPAYING") | Red `#ff3131` |
| The concept or keyword ("FLEX BOOKING") | Lavender `#c9b5d5` |
| The action, payoff, or saving ("SAVE 30%", "BOOK IN 2 MIN") | Green `#4cb051` |
| Soft word, serif accent | Fraunces italic, tan `#b89c76` |
| Everything else | White |

Every caption sits in the same box: `#2a292a` fill, 1-2 px lavender edge
(`rgba(201,181,213,0.55)`), consistent radius and padding.

## Mood

Light, airy scenes (off-white, lilac mist) for planning, browsing, and the product;
footage-led scenes for real weddings and vendors; purple brand cards for section
breaks and the end card. Motion is smooth and confident (soft eases, rings
interlocking), never frantic or glitchy. Sound is warm and organic: paper, soft
taps, light chimes; no lasers or sci-fi effects.
