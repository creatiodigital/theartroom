/**
 * Spaces offered to ADMINS when creating an exhibition.
 *
 * Held to the same contents as the ARTIST list in `components/user/dashboard/constants.ts`:
 * every space carries the same privileges for both audiences (AR-145, 2026-09-08). Nothing
 * in code enforces the match, so change both together.
 *
 * ⚠️ `adminOnly` is NOT enforced at the call site — `dashboard/index.tsx` passes spaceOptions
 * unfiltered — so presence in this array IS the gate. To withdraw a space, comment its line
 * out; setting adminOnly would do nothing. (The artist list is the opposite: there the flag
 * works.)
 *
 * ⚠️ This array doubles as the space-name lookup for the exhibitions table, which falls back
 * to the raw spaceId. Withdrawing a space that existing exhibitions still use makes their
 * rows read "madrid" rather than "Madrid".
 */
export const spaceOptions = [
  { label: 'Paris', value: 'paris', adminOnly: false },
  { label: 'Madrid', value: 'madrid', adminOnly: false },
  // Enabled 2026-09-08 (AR-145) once vienna11.glb and both bakes were on R2.
  { label: 'Vienna', value: 'vienna', adminOnly: false },
]
