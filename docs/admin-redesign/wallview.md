# Wall view (2D wall editor, `components/wallview`)

Approved by the owner 2026-11-11. Designs: `designs/wall-view.dc.html` (left panel + add bar over a
screenshot of a wall; the background image only resolves on the canvas) and
`designs/wall-view-panels.dc.html` (right panels).

**Do not touch the wall itself** (`CenterPanel`, `Wall`, artworks on it, handles, guides, rulers,
measurements, selection box, drag/drop). This step restyles `LeftPanel`, `CreatePanel` (bottom bar)
and `RightPanel` with its sub-panels only. Keep every Redux action, handler, value, unit, min/max,
keyboard shortcut, condition and confirm as today. Same shell vocabulary as the 3D editor
(`editor3d.md`): Geist, Phosphor light 16–22 px, radius 8–14, switches 34×20, mono for numbers.

Approved UI changes (no logic change): the right panel splits into **Layout / Look** tabs; the
width/height **sliders are removed** (the number fields stay; shape rotation and opacity sliders stay);
section collapsibles are replaced by always-visible groups inside each tab.

## 1 · Left panel (320 px, white, right border)

- **Header**: caption *EDITING WALL* (11 px caps) + h1 18/700 with the exhibition name and wall width
  if available (e.g. "Quimigramas · 1303 cm"; otherwise just the exhibition name). Under it one row:
  **Cancel** (text button), **Save** (outline; today's "Save Progress"), **Save & close** (dark, fills the
  rest). Keep today's tooltips ("Discard all changes and exit", …).
- **Control strip** (`#f5f5f5`, radius 10, padding 4): Undo, Redo (disabled state grey) · divider ·
  Zoom out, the zoom % (mono, `aria-live="polite"`, moved here from the floating "Zoom: 35%"), Zoom in ·
  **Fit** (text + CornersOut icon) on the right.
- **Helpers** (caption): one row each, icon tile 30 px (dark when on) + name + one 11.5 px line + switch:
  - Rulers & guides (*Measure and line things up*)
  - Lock guides (*Turn on rulers first*), indented and at 50 % opacity while rulers are off, as today's
    disabled state
  - Snap to align (*Works snap to edges and centres*)
  - Person for scale (*A {today's height} figure on the wall*; use the real height from the code)
- **On this wall** (caption + "n items"): the All / Images / Text / Video / Sound filter as a segmented
  control; rows 40 px: 36×27 thumbnail (the image itself; type icon tile for text, shape, video,
  sound), name (ellipsis), type in 11 px grey. Selected row: `#eef3fb`, text `#1a3f73` 600, 3 px
  `#3b6fd8` inset left edge, `aria-current="true"`.
- **Autofocus groups** (caption + small outline **New group**, today's "Make Autofocus Group" and its
  enable rule): rows on `#f7f7f7` with overlapping thumbnails of the group's works, name 600 +
  "n works", the show/hide outline toggle and remove × (32 px targets, `aria-label`s).

## 2 · Add bar (`CreatePanel`)

Floating white bar centred at the bottom of the wall area (radius 14, shadow). **From library** first
as the dark button (FolderSimplePlus + label), divider, then Image, Text, Shape, Video, Sound as 58×52
buttons with the label under the icon. Keep click-to-add-in-the-middle and drag-to-wall exactly; keep
today's tooltips. One 11 px line under the bar: *Click to add in the middle of the wall, or drag onto
the wall.*

## 3 · Right panel (320 px), one item selected

- **Header**: 48×36 thumbnail (type icon tile for non-images), name 15/600, "{Type} · {w} × {h} cm".
  Action row: 34 px icon buttons **Lock** (LockSimpleOpen / LockSimple, `aria-pressed`, today's "Lock
  artwork"), **Move to front**, **Move to back** (today's Arrangement), and on the right an outline
  **View details** (today's button; it was the black footer button).
- **Tabs** `Layout` | `Look` (`role="tablist"`). Remember the last tab while switching selection.
- **Layout tab** (all types):
  - **Size**: Width and Height number fields side by side ("cm" suffix inside), between them a 30 px
    chain-link toggle = today's "Lock proportions when resizing". Images: a text link **Use image
    proportions**. Text: a text link **Fit box to text** (today's "Wrap around text").
  - **Place on the wall**: one segmented strip of six icon buttons (AlignTopSimple,
    AlignCenterVerticalSimple, AlignBottomSimple, AlignLeft, AlignCenterHorizontal, AlignRight) with
    `aria-label` + tooltip each (Top of the wall, …). Same six actions as today.
  - **Distance to the wall edges**: a 150 px dashed box (the wall) with the item drawn in the middle
    and the four editable number fields placed top, bottom, left, right (today's from top / bottom /
    left / right; each input keeps an `aria-label` like "From top, cm"). Note under it: *All in cm.
    Type a number to move the artwork.*
  - Shape only: **Rotation** slider row (as in the 3D panels).
- **Look tab**:
  - **Image / video** "How it hangs": switch rows on `#f7f7f7` with a one-line hint (shortened from
    today's tooltips): **Frame** (when on, its options appear inside the same card: Material, Corner,
    and any others today), **Passepartout**, **Paper border**, **Support** (each reveals its own
    options when on, as today). "In the exhibition": **Show information** (*Visitors double-click to
    see details*), **Hide on the exhibition page**, **Hide shadow**. Video adds its **Video
    properties** group in the same style.
  - **Text**: *Type*: Font family (full width), then a 2-column grid: Size (cm), Line height, Style,
    Letter spacing. *Alignment*: text align (4) and vertical align (3) as two segmented icon groups on
    one row (TextAlign* / Align*Simple icons). *Colours*: Text and Background as swatch fields, with
    Background showing **None** as a crossed swatch when there is none (today's None toggle).
    *Inner spacing*: the box picture again with the four padding values. *Extras*: Paper texture
    (today's "Use texture"), Border, Monogram as switches.
  - **Shape**: Shape type, Colour, Opacity.
  - **Sound**: Playback and Appearance groups (today's controls) in the same style.
  - **Preset** (every type that has presets): one select *Apply a preset…* (empty state *No presets
    yet*), under it text buttons **Save as new preset**, **Update**, **Delete** (red), with today's
    enable/disable rules.

## 4 · Right panel, two or more selected

- Header: stacked thumbnails, "{n} works selected" (or "elements" when mixed), the names in 12 px
  (ellipsis), and a **Lock all** icon button.
- **Line them up**: six icon buttons (align left edges, centres, right edges, tops, middles, bottoms),
  then two buttons **Even gaps ↔** / **Even gaps ↕** (today's Distribution).
- **Place the group on the wall**: the same six-button strip and the distance box ("group").
- **Preset for all**: today's "Apply Preset to All" select.
