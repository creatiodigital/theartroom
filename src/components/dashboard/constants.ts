export const spaceOptions = [
  { label: 'Paris', value: 'paris', adminOnly: false },
  { label: 'Madrid', value: 'madrid', adminOnly: false },
  // Enabled 2026-09-08 (AR-145) once vienna11.glb and both bakes were on R2.
  // ⚠️ `adminOnly` is NOT enforced at the only call site — `dashboard/index.tsx`
  // passes spaceOptions unfiltered — so presence in this array IS the gate. To
  // withdraw a space, comment its line out; setting adminOnly would do nothing.
  { label: 'Vienna', value: 'vienna', adminOnly: false },
]
