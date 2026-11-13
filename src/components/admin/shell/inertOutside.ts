/**
 * Makes everything on the page except `keep` (and its ancestors) inert, and
 * returns the undo. The admin's dialogs and phone drawer use it to keep Tab
 * inside them: inerting the admin alone still let focus reach what the root
 * layout renders around it (the "Skip to main content" link, the cookie
 * banner). Elements that were already inert are left as they were.
 */
export function inertOutside(keep: Element): () => void {
  const touched: Element[] = []
  let node: Element = keep
  while (node.parentElement && node !== document.body) {
    const parent: Element = node.parentElement
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node || sibling.hasAttribute('inert')) continue
      if (sibling instanceof HTMLScriptElement || sibling instanceof HTMLStyleElement) continue
      sibling.setAttribute('inert', '')
      touched.push(sibling)
    }
    node = parent
  }
  return () => {
    for (const el of touched) el.removeAttribute('inert')
  }
}
