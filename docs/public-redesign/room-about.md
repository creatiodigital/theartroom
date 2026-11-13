# 3D room · "About this exhibition" and "Send feedback" in the room menu (step 38)

Owner request 2026-11-12. Design: `designs/room-about-exhibition.dc.html`. Builds on step 20's room menu
(`docs/admin-redesign/visitor-wallview.md`). **No change to the 3D scene.** UI only, except reading data the
exhibition page already reads.

## The menu (step 20's menu, two items added)
Order: **About this exhibition** (Phosphor `Info`, light) · Sound (switch) · How to move around · **Send feedback**
(Phosphor `ChatCircle`, light) · divider · Leave exhibition. Same item style, 46 px rows, menu ~252 px wide.
**Send feedback** opens step 25's feedback window (source `room`, with this exhibition). This replaces the separate
"Feedback" button drawn earlier in `feedback-in-room.dc.html`: no extra button on screen; the window is the same.

## The panel
- **Desktop:** a panel on the **left** (so the menu button on the right stays free), 20 px from the edges, 400 px
  wide, full height minus 40, white, 14 px radius, the menu's shadow. Header: small grey caps *About this
  exhibition* and a 36 px close button (radius 10). The body scrolls inside the panel.
- **Phone:** a bottom sheet, 78 % of the height, 18 px top corners, a grab handle; drag down or × to close.
- **Content** (all existing data):
  1. the artist in small caps, the title in EB Garamond 30 (26 on phone), and *"26 works · 3 series"* (same counts
     and rules as the exhibition page; hide what the data can't fill);
  2. the **full** exhibition text (Lato 15.5 / 1.7, `#444`), no "Continue reading";
  3. *About the artist*: 96 px 3:2 portrait, name (serif 19), bio clamped to 2 lines;
  4. **→ Exhibition page ↗** and **→ View artist ↗**, both opening in a **new tab** so the visitor keeps their place in
     the room; a grey line says so.
- **While it's open:** the room stays visible and still renders; clicks, wheel and keys inside the panel don't reach
  the room (same guards as the menu); Esc and × close it; focus moves into the panel and back to the menu button on
  close (`role="dialog"`, labelled). Opening it closes the menu.
- **Phone:** while the sheet is open, the room's touch gestures pause.
