// What marks a field as failing: `FormField`'s wrapper (label included, so the
// label scrolls into view with its control) and any control rendered with
// `invalid` (Input, Textarea, SelectDropdown, Button all set `aria-invalid`).
const ERROR_SELECTOR = '[data-error="true"], [aria-invalid="true"]'

// Room the sticky site header can cover at the top of the viewport. A field
// under it counts as off-screen.
const TOP_OBSTRUCTION_PX = 96

/**
 * After a failed submit, bring the first field showing an error into view.
 * Call it straight after setting the errors: it waits one frame, by which point
 * React has committed them (sync handlers flush at the end of the event, async
 * ones in a microtask — both before the next frame).
 *
 * Only scrolls when that field is NOT already fully visible, so a short form or
 * a modal with its error right under the button doesn't jolt. `querySelector`
 * returns the first match in document order, i.e. the topmost field.
 *
 * Deliberately no `focus()`: on Android a programmatic focus shortly after the
 * tap still opens the keyboard, which then covers the field we just revealed.
 */
export const scrollToFirstError = () => {
  requestAnimationFrame(() => {
    const first = document.querySelector<HTMLElement>(ERROR_SELECTOR)
    if (!first) return

    const rect = first.getBoundingClientRect()
    const inView = rect.top >= TOP_OBSTRUCTION_PX && rect.bottom <= window.innerHeight
    if (!inView) first.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}
