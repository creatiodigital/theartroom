# 3D room editor (`/exhibitions/[artistSlug]/[exhibitionSlug]/edit`)

Approved by the owner 2026-11-11. Designs: `designs/editor-3d.dc.html` (toolbar + Lighting panel over a
screenshot of the room; the background image only resolves on the canvas) and
`designs/editor-3d-panels.dc.html` (the other panels).

**Do not touch anything inside the three.js canvas** (scene, camera, controls, ExitTrigger, wall
placeholders as rendered, bake pipeline). This step restyles `components/editview/Menu` and the panel
components only. Keep every Redux action, every value, range, step, unit, save handler and the
conditions that show a tool or panel (Furniture, Bake, etc.) exactly as today. Artists use this
editor, so friendliness matters more than density. Three small UI-only additions are approved: the
editing pill, the lamp picker grid and folding benches (marked NEW).

## Toolbar (`Menu`)

- Floating card: left 16, top 16, width 76, padding 8/6, white 96 %, radius 14, shadow
  `0 8px 28px rgba(0,0,0,.14)` + 1 px hairline. Phosphor icons 22 px (light; fill when active).
- Each tool is a button with its **label under the icon** (11/500), 10 px radius; active (its panel
  open) = dark `#1a1a1a` background, white, `aria-pressed="true"`. Tooltips can stay for the longer
  description.
- Order and labels: **Exit** (ArrowLeft, today's close/leave handler) · **Spots** (wall placeholders
  toggle; Rectangle icon; pressed while shown) · divider + caption **ROOM** (9.5 px caps) · **Lighting**
  (Lightbulb) · **Walls** (PaintRoller) · **Windows** (GridFour) · **Floor** (Rows) · **Benches**
  (Armchair, Furniture panel) · **Panels** (Rows/Rectangle, display panels) · divider · **View**
  (Camera) · **Bake** (Cube). Show/hide each exactly as today.
- Bake gets an 8 px status dot (amber when the bake is out of date, none when current) **only if** the
  menu can read that state from the store; otherwise skip the dot.
- **NEW editing pill**: next to the toolbar (left 108, top 16): white pill, amber dot, "Editing" +
  exhibition name (600). Decorative status only; no actions.
- Panels open one at a time as today.

## Panel shell (shared component, e.g. `EditorPanel`)

- Floating card on the right: right/top/bottom 16, width 384 (full width minus 16 on phones), white
  97 %, radius 14, shadow `0 12px 40px rgba(0,0,0,.18)`; body scrolls, header and footer fixed.
- Header: 40 px icon tile (tint per panel, see designs: Lighting amber `#fff4d6`, Benches/Floor warm
  beige, Bake blue, Windows light blue, View lilac, Walls grey), title 18/700 in sentence case, one-line
  purpose 13 px secondary, 36 px close button (`aria-label="Close panel"`).
- Footer (only on panels that have Save today): left the **Unsaved changes** amber dot when the
  panel's values differ from the last save, *if* the panel already knows that; otherwise nothing.
  Right a dark **Save** (radius 8, 42 px). Same save handler.
- Sections (`CollapsibleSection` restyled): card `#f7f7f7`, radius 10, padding 12. The header row is a
  button: 32 px icon tile (white; dark when open), title 600 + 12 px sub, the section's main value on
  the right in mono **when closed** (e.g. Soft light 40 %), caret. Inside, sub-groups sit on white
  cards (radius 8, padding 14) with an 11 px caps caption.
- **Slider row**: label 13 px left, value chip right (Geist Mono 12, `#f2f2f2` or white on grey, radius 4),
  track 4 px `#e3e3e3` with the filled part `#1a1a1a`, thumb 16 px white with a 1.5 px dark ring. Optional
  end labels under it (11 px). Keep today's `aria-label`s, min/max/step and units. Format units with a
  space ("4.5 m", "19 cm"); degrees and % stay attached.
- **Colour row**: 40 px swatch, name 600 + hex in mono, "Change" on the right; the whole row opens
  today's `ColorPicker`.
- Switches: 36×22, `role="switch"`.

## Panels

- **Lighting**: title *Lighting*, sub *How light falls on the walls and the works.* Sections Soft light,
  Ceiling lights, Track lamps (and any others today), each with its icon (Sun, Lightbulb, LampPendant).
  Track lamps: **All lamps** card (Brightness, Angle, Distance from the wall, Lamp colour; renamed
  labels, same controls) and **Each lamp** card: **NEW** a 5-column grid of lamp buttons 1…n
  (`role="radiogroup"`, a green dot = on, grey = off, selected dark), below it only the selected lamp:
  its on/off switch, **Turn** and **Position along the track** sliders (today's two unlabelled
  sliders, same values). Default selection: lamp 1. Nothing about the lamps' data changes.
- **Benches** (Furniture): sub *Switch a bench on, pick a model, then move or turn it.* One card per
  bench: name + switch in the header; **NEW** when the bench is off the card collapses to name + "Off";
  when on: Model (today's select, or tiles if it is a short list), Across, Depth, Turn. The "baked
  with the room" note becomes an info line at the bottom.
- **Floor**: Wood card with the type as swatch tiles (today's options; use the material's colour or
  thumbnail if one exists, otherwise keep the select restyled) and Tone with a natural→honey gradient
  track and the Natural / Honey end labels. Boards card: Board width, Shift across / Shift along
  (today's Tile Position X / Y), Rotation.
- **Walls & ceiling** and **Windows**: colour rows (Walls, Ceiling / Window frames, Radiators).
  Any other controls today (e.g. wall brightness, window transparency) become slider rows below.
- **View** (Camera): Field of view (Narrow / Wide) and Eye level (Lower / Higher).
- **Bake the room**: status box (green *Bake is current* + date line / amber out of date / grey with a
  progress bar while baking; today's texts), one line *Review the result before publishing.*, dark
  **Bake**, then **Quick bake** and **View baked room** side by side, and today's quick-bake note as an
  info line.
- **Display panels** and the **Artwork panel**: same shell and rows; not drawn, follow the pattern.
