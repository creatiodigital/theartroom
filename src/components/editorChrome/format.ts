/**
 * A length in metres as the editor's value chips show it: "1.60 m" (editor3d.md: units take a
 * space; degrees and % stay attached). Display only.
 */
export const metres = (value: number, digits: number): string => `${value.toFixed(digits)} m`
