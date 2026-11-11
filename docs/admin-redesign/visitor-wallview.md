# Visitor 3D room · one menu button + Exit wall view

Approved by the owner 2026-11-11. Designs (desktop + phone over screenshots; the backgrounds only
resolve on the canvas): `designs/visitor-room-menu.dc.html` (room, menu open and closed) and
`designs/visitor-wall-exit.dc.html` (wall view).

Public visitor side: use the public site's look (Lato), not the admin style. Icons: Phosphor light
(`List`, `X`, `SpeakerHigh` / `SpeakerSlash`, `Question`, `SignOut`, `ArrowLeft`), 18–20 px.

Shared button style (both buttons): 44 px high, **radius 10 px** (not a pill),
`rgba(255,255,255,.96)`, shadow `0 4px 16px rgba(0,0,0,.12)` + 1 px hairline `rgba(0,0,0,.05)`,
text `#1a1a1a`.

## 1 · One menu button (room view and wall view)

- Remove today's top-right X (exit exhibition) **and** the two bottom-right buttons (sound, help).
  They all move into one menu.
- **Menu button**: top-right (20 px from the edges on desktop, inside the safe area on phones), 44×44,
  `List` icon, `aria-label="Menu"`, `aria-expanded`, `aria-haspopup="menu"`. While open it turns dark
  (`#1a1a1a`, white `X` icon).
- **Panel** under it (8 px gap, right-aligned): white, radius 14, padding 6, width 244 (230 on phones),
  shadow `0 12px 36px rgba(0,0,0,.18)`. Items 46 px, 15 px text, icon 20 px, gap 12:
  1. **Sound** (`SpeakerHigh`, or `SpeakerSlash` when off) with a 34×20 switch on the right
     showing today's on/off state, `role="menuitemcheckbox"`. Same handler as today's sound button.
  2. **How to move around** (`Question`): opens today's instructions window, unchanged.
  3. a 1 px divider, then **Leave exhibition** (`SignOut`): today's exit handler.
- Closes on Esc, on a click outside, and after choosing Help or Leave (Sound keeps it open). Focus
  goes to the first item on open and back to the button on close. Clicks on the panel must not reach
  the 3D scene (no walking or selection through it).

## 2 · Exit wall view

- In wall view, replace the icon-only "pinch out" button with a labelled button in the **top-left
  corner**: `ArrowLeft` + **Exit wall view** (15 px), padding 0 18 / 0 14, the shared style above.
  Same handler as today. Phone: same label, top-left, inside the safe area.
- The menu button stays top-right in wall view too.
- No hints, no Esc label on the button, and clicking the empty wall does not exit. Keep Esc and
  pinch working as today.
