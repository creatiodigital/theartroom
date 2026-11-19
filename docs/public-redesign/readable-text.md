# Long texts: readable at every width (owner 2026-11-19, proposal)

Owner: "At about 1036 px wide both columns are really narrow, and as the text is very long, it's really hard to read…
We don't want too wide paragraphs or columns, nor too narrow ones. In mobile it's simple: one column. The issue is the
middle breakpoints… This happens too in the artist individual page."
Board: "Visitors · long texts readable at every width" (`ReadableColumns.dc.html`), copy in `designs/readable-columns.dc.html`.

Measured on the live exhibition page (Kritzendorf Between Two Floods, 10,858 characters, EN then FR):
- 1036 px: label a third, text 627 px in **two columns of 285 px** (~35 characters a line), section **4,909 px** tall.
- 1440 px: two columns of 420 px, 3,358 px tall: the reader goes down a whole column, then scrolls back up.

## The rule: measure the line, not the screen (owner 2026-11-19: "follow web and UX conventions for text widths, max and min")
Conventions: **50–75 characters per line** for body text, ~66 ideal (Baymard; Bringhurst 45–75); **never over 80**
(WCAG 1.4.8, AAA); under ~45 the eye jumps lines too often.
Measured on the live site (Lato 17 px / 1.75, real paragraph): 380 px ≈ 47 characters · 420 ≈ 52 · 460 ≈ 60 ·
560 ≈ 72 · 600 ≈ 77 · **660 px ≈ 83 (too long)**. So:
- **Max: `34em`** (578 px at 17 px ≈ 74 characters). In `em`, so it follows the font size.
- **Min: `22em`** (374 px ≈ 46 characters). No text column is ever narrower, except on phones, where the screen is
  the limit (390 px phone: ~350 px at 16 px ≈ 47 characters).
1. **Long texts: always one column**, `max-width: 34em`, left-aligned in the text area.
2. **The label sits on the left only from 1280 px (xl)**; below 1280 it sits on top (today: below 1024) and the text
   keeps its 34em column.
3. **Two columns only for short texts**: under ~1,500 characters (both columns fit on one screen), with
   `column-width: 22em; column-count: 2; column-gap: 56px`, so the browser drops to one column when each can't be 22em.
4. Phones: one column, full width (unchanged).
5. Headings inside the text (h2/h3) follow the same column width.

## Where
`components/ui/TextSection` (both variants): the exhibition page (About the exhibition), the artist page (bio under the
photo), About, Contact. The `columns` variant becomes: one column unless the text is short (decide from the rich
text's character count on the server and pass a `short` flag, or measure in the component).

## Site-wide crawl (2026-11-19): every place long text is set
Measured on the live site at 390, 1036, 1440 and 1920 px (Lato; ~7.9 px a character at 17 px, ~7.4 at 16 px).
One fix for all of them: a shared reading-measure token, e.g. `--measure: 34em` (≈ 74 characters) and
`--measure-min: 22em`, used instead of each component's own 680/720/760/780 px.

| Where | Component | Today | Problem | Fix |
|---|---|---|---|---|
| Exhibition page · About the exhibition | `TextSection` `columns` | 1036: 2 cols × 285 px (~36 char); 1440: 2 × 420; 1920: 2 × 525 | too narrow at mid widths; long text in 2 columns = scroll back up | rules 1–3 above |
| Exhibition page · About the artist (bio at the foot) | `ExhibitionProfile .artistBio` (own `column-count: 2`) | 1036: 2 × 285 px (~33 char) | same | same rules (use `TextSection` or the same CSS) |
| Artist page · bio | `TextSection` `columns` | 1036: 2 × 285 px (31–37 char); 1920: 2 × 525 | same | same rules |
| About page | `About.module.scss` `.unlabelled .text` + `TextSection` (760 px) | 1440 and 1920: 760 px ≈ **96 char** | too long (over WCAG's 80) | `max-width: var(--measure)` |
| Contact page | `TextSection` (760 px) | 1440: 760 px (short paragraphs) | too long when a paragraph wraps | `var(--measure)` |
| Terms, Terms of sale, Privacy, Accessibility | `ContentPage .text` (720 px) | 1440 and 1920: 720 px ≈ **91 char** | too long | `var(--measure)` |
| Prints page intro (Fine-art prints text) | rich text in the intro block | 1920: 763 px at 16 px ≈ **100 char**; 1440: 613 px ≈ 82 | too long on wide screens | `var(--measure)` |
| Page intros (Prints, Exhibitions, Artists sub line) | `PageIntro` (760 px; lead 26 px serif) | lead is large type, 1–2 lines | fine at 26 px (≈ 55 char); keep | — |
| Home · intro "Art beyond immediacy" | `landing/Intro` (780 px, centred) | short centred paragraph | centred long lines are hard to follow | cap at `var(--measure)` |
| Home · Announcements / Journal text | rich text | 1920: 668 px ≈ 84 char; 1036: 368 px ≈ 46 | slightly long on wide screens | `var(--measure)` |
| Artwork page · story under the work | `ArtworkStorySection` (680 px) | ≈ 86 char | too long | `var(--measure)` |
| 404 / error pages | `StatusPage` (760 px) | 1–2 short lines | fine; align to the token anyway | `var(--measure)` |
| Exhibition list descriptions | `ExhibitionRow` (700 px max, grid gives 450–480 px at 15 px) | ≈ 64–68 char | fine | — |
| 3D room · About this exhibition | `RoomAboutPanel` (400 px, 15.5 px) | ≈ 55 char | fine | — |
| Checkout, payment | forms (720 px) | form fields, short notes | fine | — |
| Phones (all pages) | — | 342 px at 16 px ≈ 46 char | fine | — |
