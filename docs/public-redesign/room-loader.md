# Public site · 3D room loader (step 38b)

**Owner's final choice, 2026-11-12 18:43: Option A2, type only.** Design: `designs/room-loader.dc.html`, the
**top** board ("Option A2"). The image version (Option A, built in d7c21766) and Option B on the same board are
**not** used: replace A with this. The admin bake mode keeps `MonogramLoader` ("Lighting the room") unchanged.
Loading logic, `fraction`, `done` and `onRevealed` stay exactly as today; only what the visitor sees changes.

## What it is
A calm, still title card for the exhibition. **Nothing moves except the little red progress line.**
No image, no monogram, no blur, no rotating captions.

## Layout (desktop; phone in brackets)
Full screen, background warm paper `#fbfaf7`, everything centred horizontally and vertically, side padding 24 px:
1. Small caps *Now opening*: 11.5 px (11), letter-spacing .16em, `#999`.
2. The exhibition `mainTitle`: EB Garamond 44 px (32), weight 400, line-height 1.1, `#1a1a1a`, centred, max width
   760 px, max 3 lines. 14 px (12) below 1.
3. The artist's name: caps 14 px (12), letter-spacing .14em, `#555`. 18 px (14) below 2.
4. The progress line: 44 px (36) below 3. Track 220 px (160) × 1 px `#e6e3dc`; inside it the red `#bd1622` line
   grows from the left with the progress.
5. *Preparing the exhibition*: 14 px `#888`, 22 px (20) below 4. Static text. **Owner: never show "Hanging the works", "Setting the lights", "Opening the doors" or any other rotating lines**: remove them from the code.
6. Only after **20 s** still loading: *Large rooms take a little longer on slower connections.* 13 px `#aaa`,
   8 px below 5, fades in once (300 ms) and stays.

## The red line (the only motion)
- `p` = today's `fraction` (0..1), latched so it never goes backwards. Shown value `d` eases toward `p`
  (`d += (p − d) × 0.06` per frame) so jumps look smooth. Width = `d`.
- Never "done" early: `d` is capped at 0.96 until `done`; then it completes to 1 in 300 ms and the whole screen
  fades out (500 ms) to reveal the room. Under 1 s extra on fast connections; no forced minimum.
- Never frozen on slow connections (loads take 10 s to 2 min): while `p` has not moved for 3 s, `d` creeps
  +0.002/s on its own, still capped at 0.96 and never more than `p + 0.08` ahead.
- Drive it with `requestAnimationFrame` writing a CSS variable (`--d`, `transform: scaleX(var(--d))`,
  `transform-origin: left`): no React re-render per frame.

## Before the data arrives
- Title or artist not loaded yet: keep their space (no layout jump), fade them in (300 ms) when they arrive. The line
  and *Preparing the exhibition* show from the first frame.

## Accessibility and motion
- Wrapper keeps `role="status"`, `aria-live="polite"`, `data-testid="monogram-loader"` (rename only together with
  the tests) and `data-progress`. Accessible text: "Preparing the exhibition {title}".
- `prefers-reduced-motion`: the line still shows progress, but without easing (jumps to `p`).

## Build notes
- Rework the `RoomLoader` component from 38b: props `{ progress, done, title?, artist? }` (drop `imageUrl` and the
  image / blur / monogram-fallback code). `LoadingOverlay` renders it in visitor mode, `MonogramLoader` in bake mode.
