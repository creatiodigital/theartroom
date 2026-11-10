/**
 * True when a key event is aimed at something the user is typing into — a
 * field or contentEditable text. Editor-wide shortcuts (Delete/Backspace,
 * Cmd+Z) must leave those keys to the field: otherwise Backspace in a panel
 * input deletes the selected works, and Cmd+Z undoes the wall instead of the
 * text.
 */
export const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable)
