// A size written inside a variant's name can't follow the visitor's cm | in switch, and the real
// size is already shown next to the name (docs/public-redesign/units.md "Variant names: words, not
// sizes"). Digits with an x / × between them, or digits followed by cm / in.
const SIZE_IN_NAME = /\d\s*[x×]\s*\d|\d\s*(?:cm|in)\b/i

/** True when a variant's name looks like it carries a size ("S1 22 x 33", "40 cm"). A hint only. */
export function nameLooksLikeSize(name: string): boolean {
  return SIZE_IN_NAME.test(name)
}
