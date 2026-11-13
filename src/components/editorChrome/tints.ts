/**
 * A tool panel's header tile color (editor3d.md "Panel shell"; tokens `--editor-tint-*`). Display
 * panels and the Artwork panel use `walls` until they are drawn (questions.md Q137).
 */
export type ToolTint = 'lighting' | 'walls' | 'windows' | 'floor' | 'benches' | 'view' | 'bake'
