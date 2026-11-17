# Print wizard sliders on phones (owner 2026-11-17)

Problem (owner): on phones the slider knobs sit at the left edge of the column, close to the screen edge. Aiming at a
knob often starts the system's edge swipe (back) or moves the whole page instead. Happens in Safari and Chrome:
on iPhone both use the same engine, and Android has its own edge-back gesture. A web page can't switch off the
system's edge gesture, so the fix is to **never need the edge**: the knob doesn't have to be aimed at.

Today: `components/ui/Slider` is a native `<input type="range">` with a 2 px track and a 12 px thumb, so the
touch target is roughly 12 × 12 px. On iOS a native range only drags if the touch starts on the thumb.

## The fix (looks the same; nothing moves out of alignment)
1. **Touch anywhere on the track.** A touch row 44 px tall over the whole track width. Touching anywhere moves the
   knob to that point and the drag continues from there (pointer events + `setPointerCapture`). The buyer can start in
   the middle of the screen, far from the edge, and slide left: the knob reaches the minimum without the finger ever
   touching the edge zone.
2. **The page doesn't move while sliding.** `touch-action: none` on the slider row only (the rest of the page still
   scrolls normally). Also `overflow-x: clip` on the wizard's panel so nothing can pan sideways.
3. **Bigger knob target, same look.** The knob stays a 12 px dot, but its hit area is 32 px (transparent around the dot).
4. **The knob stays inside the column.** At the minimum, the knob's left *edge* (not its centre) lines up with the
   labels above; at the maximum, its right edge lines up with the right side. The track keeps the full column width.
   No offset of the layout, no misalignment.
5. **Keep it a real slider** for keyboard and screen readers: keep the native `<input type="range">` (visually the same)
   for focus, arrow keys and `aria-valuetext`; the touch row drives its value.
6. Scope: the print wizard's sliders (size, paper border, mount width). The editor's sliders can adopt it later.

Test on a real iPhone (Safari and Chrome) and an Android phone: start a drag in the middle of the track and go to the
minimum; the page must not scroll or go back.

## Alternatives without a knob: REJECTED (owner 2026-11-17: "no, horrible"). Keep the slider + the fix above.
Board: "Visitors · print wizard on phones: a free size without a knob" (`WizardPhoneSize.dc.html`), copy in
`designs/wizard-phone-size.dc.html`. Kept for the record only:
- **A · ruler you swipe (recommended):** the size written large (Height × width), a ruler sliding under a fixed centre
  marker; swipe anywhere on it (flick = far, slow = 0.1 cm), pale and springy past the smallest/largest; "Type a size"
  opens the fields with the number keyboard. Paper border: a short ruler 0–10 cm ("None" at 0).
- **B · − / + buttons** on each field (1 cm a tap, faster when held).
- **C · today's fields on top + the ruler instead of the slider.**
