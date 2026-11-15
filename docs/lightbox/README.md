# Lightbox: a presentation option for image artworks

Owner's decisions, 2026-11-14 (asked for by an artist). Planned with Design Claude. **Status: designed, not built.**
Design: canvas board "Studio · Lightbox" (`Lightbox.dc.html`), copy in `designs/lightbox.dc.html`.

## The idea
A **lightbox** (backlit print, as in Jeff Wall's work): the image sits in a shallow box and is lit from behind, so it
glows instead of reflecting the room's light. In The Art Room it is **not a new artwork type**: it is a way to present
an **image artwork**, like Frame or Passepartout. The same image can be framed in one exhibition and a lightbox in
another.

## Where the artist sets it
Wall editor › an image artwork › **Look** tab › **How it hangs**: a new **first** card.
- **Lightbox** switch, line *"Lit from behind, in a shallow box"*. Off by default.
- When on, its settings open in the same card (the card gets a 1 px dark outline):
  | Setting | Control | Values | Default |
  |---|---|---|---|
  | Brightness | slider, labels *Soft* / *Bright* (no numbers) | 0–1 | 0.55 |
  | Light colour | 3-way: *Warm* (≈3000 K) · *Neutral* (≈4000 K) · *Cool* (≈6500 K), each with a small colour dot | `warm` `neutral` `cool` | `neutral` |
  | Depth | number, cm | 3–15 | 6 |
  | Edge (front border around the image) | 3-way: *None* (edge to edge) · *Thin* (≈1.5 cm) · *Wide* (≈4 cm) | `none` `thin` `wide` | `thin` |
  | Material (box sides and edge) | 5 swatches: Black aluminium · Silver aluminium · White · Oak · Walnut | `alu-black` `alu-silver` `white` `oak` `walnut` | `alu-black` |
  | Front | 2-way: *Matte* · *Glossy* (faint room reflection over the glow) | `matte` `glossy` | `matte` |
- **Exclusive with Frame, Passepartout, Paper border and Support.** While Lightbox is on, those four cards are greyed
  and their switches disabled, with the line *"A lightbox has its own box: frame, passepartout, paper border and support
  are off while it is on. Your settings for them are kept."* Turning Lightbox off restores them exactly.
- **Hide shadow** and the rest of the panel are unchanged. Presets save and apply the lightbox settings too.
- Oak and Walnut reuse the frame's wood textures (`wood-light` / `wood-dark` look) so wood looks identical on frames
  and lightboxes.

## Data (one migration)
On **`ExhibitionArtwork`** (display properties are per exhibition, like `showFrame`) and on **`ArtworkPreset`**:
```
showLightbox        Boolean @default(false)
lightboxBrightness  Float   @default(0.55)   // 0..1
lightboxLight       String  @default("neutral") // warm | neutral | cool
lightboxDepth       Float   @default(6)      // cm, 3..15
lightboxEdge        String  @default("thin") // none | thin | wide
lightboxMaterial    String  @default("alu-black") // alu-black | alu-silver | white | oak | walnut
lightboxFront       String  @default("matte") // matte | glossy
```
Validation server-side (enums and ranges). Only for image artworks.

## How it looks in the 3D room (the important part)
No transparency is involved: the image **is** the light.
1. **Self-lit image.** Draw the image unlit (like `VideoObject`'s screen, `MeshBasicMaterial`/emissive), so the room's
   light and the baked lightmap do not dim it. Colour = image × light colour × intensity, where intensity maps
   Brightness to about **1.0–1.8** (above paper white), so highlights pass the bloom threshold and get a soft halo from
   the existing **Bloom** (`Effects.tsx`) while blacks stay black (multiply, never add).
2. **Backlit-film character**, fixed (not settings): a gentle contrast/saturation lift; a soft centre-to-edge
   falloff (≈5–10 %); a 1–2 px bright light leak along the image's edge where film meets box.
3. **The box:** a box of the chosen depth and material behind and around the image; the edge width as a front border.
   It casts the normal artwork shadow (unless Hide shadow).
4. **Front:** glossy adds the same faint reflection the framed glass uses; matte none.
5. **Light on the surroundings: baked** (owner 2026-11-14). The lightbox's front face is added to the room bake as
   an **area emitter**, the same way `scene/bake/LightBaker.ts` already bakes window glass for daylight ("1b. Daylight:
   window glass as area emitters"): its size = the image area, its colour = the light colour, its power follows
   Brightness. The bake then puts a soft wash on the wall around it, the floor below and nearby works.
   - **The image's own glow is NOT baked:** it stays live (self-lit + bloom), so brightness/colour changes show at
     once.
   - **Fallback:** a soft additive glow decal on the wall around the box, tinted and scaled by Brightness, shown when
     the room has no bake yet, or when the lightbox was moved/changed after the last bake (the bake is stale for it).
     Hidden once a fresh bake includes it.
   - Moving a lightbox or changing its brightness/light colour marks the bake as needing a re-bake, like lamps.
   - **No real-time area lights.**
6. Performance: one extra material and one decal per lightbox; must stay smooth on phones.

## 2D wall editor
The box is drawn with its edge and material colour; the image slightly brighter than prints with the light colour,
so the artist sees which works are lightboxes. No glow needed in 2D.

## Elsewhere
**Decided (owner 2026-11-15): the lightbox is only a way to display the work in the 3D room.** Nothing changes
outside the room: the artwork page, the room's artwork details, prints and the print flow stay exactly as for any
other image artwork (prints are ordered and printed as usual). No "Exhibited as a lightbox" line anywhere.

## Order of work
1. Schema (migration: owner runs it). 2. Panel card + exclusivity + presets. 3. 3D rendering (self-lit image, box,
edge, front, fallback wall glow). 3b. The bake: lightbox fronts as area emitters (like window glass). 4. 2D wall look. 5. Tests (exclusivity restores the other four; values
validated; renders on phone without frame-rate drop).

## Where things live in the code today (starting points, checked 2026-11-14)
Follow how **`showFrame`** flows through the app; a lightbox travels the same path:
- Schema: `prisma/schema.prisma` › `ExhibitionArtwork` (display properties, per exhibition) and `ArtworkPreset`.
- Types and mapping: `src/types/artwork.ts`, `src/lib/exhibitionArtworkMapper.ts`, `src/factories/artworkFactory.ts`,
  `src/components/wallview/utils.ts`, `src/components/wallview/constants.ts`.
- Save/load: `src/app/api/exhibition-artworks/route.ts`, `src/components/wallview/hooks/useSaveExhibition.ts`.
- Presets: `src/app/api/presets/route.ts`, `src/app/api/presets/[id]/route.ts`,
  `src/components/wallview/RightPanel/PresetSection/applyPresetToArtwork.ts`.
- Panel: `src/components/wallview/RightPanel/PresentationSection/PresentationSection.tsx` (the *How it hangs*
  group: Frame, Passepartout, Paper border, Support; `FRAME_MATERIALS` lives here), used by
  `RightPanel/ArtisticImagePanel/ArtisticImagePanel.tsx`; handlers in `RightPanel/hooks/useArtworkImageHandlers.ts`.
- 2D wall: `src/components/wallview/ArtisticImage/ArtisticImage.tsx`, `src/components/wallview/Artwork/Artwork.tsx`.
- 3D: `src/components/scene/spaces/objects/Display/Display.tsx` and `Display/artworkFile.ts` (artwork materials),
  `objects/Frame/`, `objects/Passepartout/`, `objects/Support/` (box geometry to learn from),
  `objects/VideoObject/VideoObject.tsx` (a self-lit screen: `emissive`), `objects/Effects/Effects.tsx` +
  `bloomIntensity.ts` (bloom, threshold), `objects/ShadowDecal/` (a wall decal to learn from for the fallback glow).
- Bake: `src/components/scene/bake/LightBaker.ts` (step "1b. Daylight: window glass as area emitters" is the model for
  lightbox emitters), `bakeJob.ts`, `bakedLook.ts`; whatever marks a bake stale when lamps change must also react to
  lightbox position/size/brightness/light colour.
