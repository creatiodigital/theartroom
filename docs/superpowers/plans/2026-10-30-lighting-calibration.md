# Lighting calibration: a measured plan (AR-169, 2026-10-30)

**Evidence base:** `.superpowers/ar169/research/reports/Natural interior lighting calibration.md` (68 sources; notes in `.superpowers/ar169/research/research_notes/`). Every target number below comes from it.

## Goal

The Paris room lit so that:

1. **Correct:** the baker matches a Cycles path-traced reference within written tolerances.
2. **Real:** light levels and ratios are those of a real gallery.
3. **Approved:** the owner approves the look on three fixed cameras.
   - **Key test:** a real off-white wall and ceiling (paint LRV 0.85–0.90) read as **white, not grey**.
   - Pure 255 white is unrealistic. It's used only to start calibrating, never as the final colour (owner, 2026-10-29).
4. **Repeatable:** the result is written as a recipe in `docs/3d-spaces-playbook.md`, so Vienna, Madrid and new spaces only repeat it.

## Why we kept failing (research finding)

Professionals keep every light at physical strength and spend **one global knob, the camera**: exposure, one white balance and a tone curve. We did the reverse. Each complaint went to a local knob, and every local knob moved another area:

| Complaint | Local knob we used | What it really did |
|---|---|---|
| Room too dim | Downlights 6,800 → 12,500 lm | Same as opening the camera 0.88 stop while dimming daylight 0.88 stop |
| Too bright | Camera stopped down | The camera already sits ~1.1 stops dark for a 200 lx gallery |
| Walls tinted | Floor bounce color 0 | A V-Ray-style "GI saturation" cheat |
| Window glow | Glass shown at 1/6 | A legitimate camera override, but it shows a flat plate |

Two more causes came out of the research:

- **The tone curve.** Khronos PBR Neutral was built for shopping-site product shots. It goes flat white about 3.5 stops above middle grey, which is why "more exposure looks pale" and why the window becomes a flat plate.
- **Bloom.** It adds about 30% of the glass's brightness on top of the window bars.

## Rules of engagement

1. **One variable per run.** If a bake changes two things, it proves nothing.
2. **Pass criteria first.** They're written before the run and never moved after seeing the result.
3. **Every run logged** in `.superpowers/ar169/calibration/runs.md`: ID, git SHA, the variable (old → new), the probe table, pass/fail, the owner's verdict.
4. **Numbers come from the float buffer, not from reading code.** Yesterday I misread the window's brightness by 3.3× (I missed the `× 0.3` in `Windows.tsx`).
5. **Every bake log confirms the change was active.** Yesterday the soft-light trial silently didn't run (`ceiling0` vs `ceiling`).
6. **No local knob for a global problem.** No lumen boosts for exposure, no desaturation for white balance, no dimming the sun for contrast.
7. **Physical by default.** Every deviation is an owner decision, recorded with its measured cost.
8. **Numbers judge correctness, the owner judges the look.** The look is judged only on the three fixed cameras, A/B.
9. **Asset rule:** a file rebuilt under the same name gets `?v=N` (the dev server caches assets as immutable).

## Inputs from the owner

- **Blender** open with `paris23.blend` and the MCP add-on running (needed from phase 3).
- **2–3 photos of real galleries** you want to match. They're used for ratios and the look, not as absolute numbers.
- **Decisions D1–D6** below can be thought over in advance. Each one is taken during the day, with its measurement on screen.

## Testbed (frozen for the whole day)

- **Room:** Paris, `paris23_noq.glb?v=2`.
- **Exhibition:** **landscapes** (john-doe, dev DB), the owner's all-white Paris show: walls, ceiling, glass, window frames and radiator #ffffff, no artworks. Permanence is used for the final look checks.
- **Cameras:** C1 room overview, C2 window, C3 corridor. These are the `shots.mjs` positions, exported identically to Blender.
- **About 30 probes** (position + normal):
  - each wall at 0.3 m, 1.5 m and 0.3 m below the ceiling;
  - the floor at 0.5, 2, 5 and 10 m from the window;
  - the ceiling centre and the ceiling above the sun patch;
  - the corridor end wall;
  - the glass.
- **Material table:** wall Y 0.877; ceiling; oak mean linear RGB measured from its texture.
  - The bake already scales the picked colour by paint reflectance 0.9, so a picked #ffffff is a 0.9 paint.
  - Transport tests (phases 2–3) use clay 0.8.
  - Look phases (5–9) use real off-whites: today's #fffcf5 (Y 0.877) and an LRV-0.85-class off-white such as #f0ede7, for walls and ceiling. Never 255 white everywhere.
- **Light table:** one unit convention for the whole day.

## The day

The phases go in order: units, transport, light levels, camera, tone curve, glare, background. Each phase depends on the ones before it being right.

| # | Phase (the ONE variable) | Who / time | Pass criterion |
|---|---|---|---|
| 0 | **Freeze the testbed.** Calibration exhibition, probes, cameras, run log. **Baseline B0** = the current tree with every trial flag off. | Me, 30 min | B0 probe table and three screenshots logged |
| 1 | **Instruments**, no change to the look: probe readback in lux from a stored bake; false-colour view (behind `BAKE_DEBUG`); clay flag (all albedos 0.8 neutral, bake and display); group flag `?bakegroups=window,sun,downlights,track`; the **Quick bake** preset (the owner's stage 2) | Me, ~3 h | Sum of single-group bakes = all-groups bake within ±2%. Quick bake = full bake within ±2% on the probes (otherwise use full bakes). |
| 2 | **Units against closed forms**, in clay with bounces 0: spot E = I·cosθ/d²; downlight I₀ = Φ/π; window Φ = πLA; sun patch E = E⊥·sin h through the portal; doubling every light doubles every probe; changing an albedo moves only indirect light | Me, 1 h | Direct terms within ±2% of analytic. Each failure is fixed alone and re-run before phase 3. |
| 3 | **Cycles ground truth**, clay, same lights: clamp 0, 32 bounces, denoiser off, a portal in the window, linear EXR plus Diffuse direct/indirect, two seeds, at 0 / 1 / N bounces. The W↔lux constant is pinned by a one-light test scene first. | Me + owner's Blender, 2 h | Direct: median ±3%, every probe ±5%. Full GI: median ±10%, every probe ±15%. Surface-pair ratios ±5%. White-wall R/B ±3%. A failure is read from the ratio map: uniform = units, corners = clamp, varies with distance from the window = daylight or bounce. |
| 4 | **Floor-tint experiment:** real oak back on; floor bounce colour 1 vs 0 against Cycles with the same oak | Me, 30 min | Wall R/B within ±3% of Cycles means the tint is physics and goes to decision **D3**. If the baker is warmer than Cycles, that's a baker bug and gets fixed. |
| 5 | **Light levels to gallery targets**, one group at a time with group weights, then re-rated fixtures: art 150–300 lx (200 nominal); art : wall 2:1–4:1; walls ≥110 lx; track spots from a real datasheet (candela, 40° beam, 30° aim); window 800–1,600 cd/m² through glass; sun per **D2**. Soft light vs real fixtures per **D6**. | Me, owner on the 3 cameras, 1.5 h | Probe targets met. Owner verdict on how the light is distributed, at a fixed exposure. |
| 6 | **Camera:** exposure from the walls with the incident-meter rule (e ≈ 224 / E_wall, ≈1.1 at 200 lx), per **D1**. White balance stays on the key light ([1,1,1], all lights white). | Me, 30 min | The off-white wall at art height reads as white, not grey. Its target band (sRGB / false colour) is agreed with the owner before the run. Window : wall recorded in stops (physical 4–8). |
| 7 | **Tone curve:** Neutral vs AgX with a contrast look, each at its own wall-matched exposure (never one shared exposure) | Owner A/B, 45 min | Window graded, not flat white. Walls −0.5 to +2 stops over grey. **D5.** |
| 8 | **Bloom, energy-conserving:** threshold 0, NORMAL blend, opacity 0.02–0.04; lamp discs at physical brightness so they still glow | Owner A/B, 30 min | Window bars change less than 1 stop with bloom on vs off. Lamp discs still glow. |
| 9 | **Window view:** camera-only image behind the glass (CC0 street photo or HDRI) at shaded-facade level, 330–1,300 cd/m² through glass. The bake's daylight is unchanged. | Me + owner's pick, 1 h | The view outside reads; the horizon matches the room. |
| 10 | **Lock:** probe tables and screenshots saved as goldens; recipe written into the playbook; Vienna/Madrid steps listed | Me, 30 min | A later baker change re-runs phases 2–3 and fails on unexplained drift |

**Time:** about 11–12 hours of work. The owner (2026-10-29): "we will have all the time we need". No shortcuts: every phase runs in order, and the next phase starts only when the current one passes.

## Owner decisions (each taken with its measurement on screen)

| # | Decision | Options | Evidence the research gives |
|---|---|---|---|
| D1 | **Exposure rule** (yours, 10-16: "never raise exposure") | Keep it, or set exposure from the walls as photographers do | The camera is ~1.1 stops dark for a 200 lx room. The lumen boosts that compensated for it dimmed the daylight by 0.88 stop relative to the lamps. The "pale" look came from Neutral's short shoulder, not from exposure. Images are file-exact, so the paper-white guard no longer protects them. |
| D2 | **Sun** | Physical (~46–52 klx patch, clips, warm glow near the window), or a recorded lower value | Our sun is ~1/16 of physical, about 4 stops low. |
| D3 | **Floor bounce colour** | Physical (1) or your exception (0) | Settled by phase 4. Real warm-floor tint is small at mid-wall (~2–3%) and strong only near a sun patch. |
| D4 | **Lamp colour** | White (your decision 10-29) | Kept. Its cost is losing the warm-pool-against-cool-window cue. |
| D5 | **Tone curve** | Neutral or AgX + contrast look | Phase 7 A/B at matched exposures. |
| D6 | **General light** | Hidden soft light (your trial), or real hidden fixtures: wallwashers about h/3 ≈ 1.2 m from the walls, spaced ≤1.55 m | Phase 5 measures both on the same probes. One track line at about 1.2 m from the wall serves both the 30° aim and the wallwasher rule. |

## What changed yesterday and stays in the tree (uncommitted)

- White rule: all lights #ffffff, cameras [1,1,1], white sun.
- Floor bounce colour 0.
- Glass shown at 1/6.
- `paris23_noq.glb?v=2`.
- Soft-light trial `?ar169soft=1` (camera ×0.794).

The Permanence dev copy's track beam was changed by me from 0.8 to 0.35.

Phase 0 records all of this as B0. Nothing is reverted or kept without a phase deciding it.

## Progress

Live log: `.superpowers/ar169/calibration/runs.md` (every run, numbers, bugs, next steps).

2026-10-30:
- Phase 0 done: testbed = landscapes, 29 probes, 4 cameras.
- Phase 1 in progress:
  - Done: probe reader (validated, 0.6%), `?bakegroups=`, `?bakequality=quick` (bakes in 9–24 s).
  - BUG 1 (daylight-only bakes black) fixed.
  - BUG 2 (light well faces outward) open.
  - Still to build: clay flag, false-colour view.
- Session 2 (same day): phase 1 DONE.
  - R2b ✅ group bakes add up (median 0.94 %, max 3.5 %); R3 ❌ quick ≠ full (median 5.8 %) → full bakes only; R6 seed noise floor median 0.69 %, max 4.5 %.
  - Instruments: `?bakeseed=`, `?bakeclay=1`, `?falsecolor=1` (R5 inert when off, R7, R8 13/13 bands), `?baketwosided=1` (A/B).
  - BUG 2 fixed (emit along the authored face normal; decision: no HDRI — a uniform sky through an opening IS a Lambertian emitter at it). R4 ✅ vestibule +92 lx vs 28.8 lx analytic direct.
  - BUG 3 found + fixed: walls/ceiling/floor took light on their back face (corridor wall +16.4 lx analytic leak; half the S wall's daylight). Fix = front-only shell. R9 failed 3/4 pre-set criteria; leak removal proven, side effect → BUG 4 (jitter clip, R10 partial) and BUG 4b (ceiling band −6 %, open → phase 3).
  - Phase 2 started: `?bakebounces=N` ✅ (R11). First closed-form test (window direct, Φ = πLA) ❌ → BUG 5: window direct light 0…−8 % low, a per-bake global factor that moves with the seed; not shadow-cube resolution (E1).
  - Next: BUG 5, then the rest of phase 2, then phase 3.
- Session 3: BUG 5 closed — not a baker bug (my reference had the GLB's glass; the app pushes it 5 cm back). Phase 2 DONE: every direct term within ±2 % of analytic (window, light well, downlights, track, sun; albedo moves only indirect). References now come from the live scene (`scenegeom.mjs`, `geom.mjs`).
  - Findings for the owner: F1 the glass push-back (`Windows.tsx`) costs 3–10 % daylight near the window and shifts Vienna's x-facing glass sideways; F2 the app drops wall0's node scale 1.004 (walls 2–5 cm inside the model).
  - Next: decide F1/F2, then phase 3 (Cycles from the live geometry dump).
- Session 3b (owner: glass in the middle of the frame; paris23 re-exported with the scale applied; keep the 39.6° spot aim; Cycles OK): model v3 + glass in the frame + window lights on the glass (R17–R19); BUG 6 (window direct −1…−4 %, possibly seed noise — E6 running); phase 3 started: Cycles units pinned (C1), Cycles window direct = analytic within 0.3 % (C2). Resume: runs.md "State at the end of session 3".
- Session 4: phase 3 DONE vs Cycles (Paris, clay): direct median 0.27 %, full GI median 0.75 % (was 7.5 %; corridor −12 % → 0 %). Fixed: BUG 7 the sun was a point 60 m away (patch 12 % too much light) → parallel; BUG 8 multi-bounce energy loss (bounce grid 128 → 256 + near field at every bounce). BUG 4b closed (front-only right); BUG 6 = noise. Owner peek: lighting better, corridor/floor better; window + surroundings washed out (no headroom above walls at 241/255 — tone curve/exposure), track pools too strong. Owner: one setup for every space, focus Paris. Next: the look (AgX + walls lower + real glass + sky view), then track spots. Resume: runs.md "State at the end of session 4".
- Session 4b (owner A/B, Paris): culprit of the over-lit room = downlights (72–93 % of wall light) → 6,250 lm. Then one-param A/B pairs chosen by the owner: bloom on lamps only, camera 0.62, HDRI diffuse fill 40 lx, track ×0.25, sky ×0.5, off-white paint #fbf9f4 on walls/ceiling/frames/radiator → **APPROVED** ("now we're talking!"). Rejected: AgX (flat/"fog"), hidden uplight, HDRI 80/60. Recipe + next steps: runs.md "APPROVED LOOK" and "State at the end of session 4 (night)".
