# Step 19 · Lucide → Phosphor, whole site (front and back)

Approved by the owner 2026-11-11: "replace ALL Lucide icons in the site, front and back, and remove the
Lucide library". **Icons only**: no layout, copy, logic or behaviour changes. One commit (or one per
area if it gets big: shared `Icon` + public site, then 3D room/editors, then anything left), and as
always stop before committing for the owner's browser check.

## Rules

- Library: `@phosphor-icons/react` (already installed). Import named icons; use the **SSR** entry
  (`@phosphor-icons/react/dist/ssr`) in server components, as the admin already does.
- **Weight `light`** everywhere (closest to today's Lucide at stroke 1.25), **`fill`** only where a
  state is "on/active" (as in the admin menu). Keep each icon's current **size** and colour
  (`currentColor`).
- `components/ui/Icon/Icon.tsx` keeps its name-based API (`icon="close"` etc.), so callers don't
  change: swap its internal map to Phosphor. Then replace the ~24 files that import `lucide-react`
  directly.
- Remove `ICON_STROKE_WIDTH` / `src/lib/iconConfig.ts` once nothing uses them (Phosphor has weights,
  not stroke widths), and **remove `lucide-react` from `package.json`** + lockfile.
- Icons inside buttons keep their `aria-hidden` / labels exactly as today.
- Custom SVGs in `src/icons/` stay unless step 20 replaces them (gesture icons). The monogram and brand
  marks stay.
- When you're done, check every page type in the browser at desktop and 390 px: home, exhibitions list,
  a 3D room (menu, instructions, wall view), artwork modal, prints, cart/checkout, about, legal, artist
  studio, 3D editor, wall view, admin. `grep -r lucide src` must return nothing.

## Mapping (Lucide → Phosphor)

| Lucide | Phosphor | | Lucide | Phosphor |
|---|---|---|---|---|
| X | X | | Lock | LockSimple |
| MoreVertical | DotsThreeVertical | | LoaderCircle | CircleNotch (spin it as today) |
| Menu | List | | Link | LinkSimple |
| ChevronDown / Right / Left | CaretDown / CaretRight / CaretLeft | | Info | Info |
| ArrowUp / Down / Left / Right | ArrowUp / ArrowDown / ArrowLeft / ArrowRight | | AlertCircle | WarningCircle |
| ArrowUpFromLine / Down / Left / Right | ArrowLineUp / ArrowLineDown / ArrowLineLeft / ArrowLineRight | | CheckCircle | CheckCircle |
| MoveVertical / MoveHorizontal | ArrowsVertical / ArrowsHorizontal | | Check | Check |
| Undo2 / Redo2 | ArrowCounterClockwise / ArrowClockwise | | Eye / EyeOff | Eye / EyeSlash |
| Plus | Plus | | Image / ImageOff | Image / ImageBroken |
| Trash2 | Trash | | Video | VideoCamera |
| SquarePen | PencilSimple | | Music | MusicNotes |
| Square | Square | | Headphones | Headphones |
| Shapes | Shapes | | Volume2 / Volume1 | SpeakerHigh / SpeakerLow |
| Type | TextT | | Play / Pause | Play / Pause |
| Settings | GearSix | | Mouse | MouseSimple |
| Share2 | ShareNetwork | | MousePointer2 | Cursor |
| Mail | Envelope | | Touchpad | HandSwipeRight (step 20 rule) |
| ShoppingBag | ShoppingBag | | Monitor | Monitor |
| Printer | Printer | | Camera | Camera |
| House | House | | Box | Cube |
| GripVertical | DotsSixVertical | | Ruler | Ruler |
| Grid2x2 | GridFour | | Magnet | Magnet |
| FolderDown | FolderSimplePlus | | PersonStanding | Person |
| BringToFront / SendToBack | SelectionForeground / SelectionBackground | | Armchair | Armchair |
| PanelTop | Rows | | LampCeiling | Lightbulb |
| PanelBottomDashed | Selection | | BrickWall | Rows |

If a Lucide icon in the code is missing from this table, pick the closest Phosphor icon, keep the
meaning, and list it in the step's Built note so Design Claude can confirm it.
