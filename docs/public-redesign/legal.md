# Public site · Content pages (rich text)

Approved by the owner 2026-11-11. Designs: `designs/legal-desktop.dc.html`, `designs/legal-phone.dc.html` (drawn with
Terms and conditions). **One template for every rich-text page** edited in Admin › Content › page editor: Terms and
conditions, Online terms of sale, Privacy policy, Accessibility policy, Cookie settings page, and any future one.
No images. Only layout and hierarchy change; the content comes from the editor as today. **No underlines.**

- **Header:** page title in EB Garamond 52 (36 phone), sentence case; the page's subtitle in Lato 18 `#555`
  (16 phone). A hairline under the header.
- **Two columns on desktop:** "On this page" (300 px) and the text (max 720 px), 116 px apart.
  - "On this page": small grey caps label, then the list of the page's **H2 headings, built automatically**
    (anchors on each H2). Lato 14, `#777`, a 1 px `#e3e3e3` line on the left of the list; the section being read is
    `#1a1a1a` with the line `#1a1a1a`. Sticky while scrolling; smooth-scrolls on click. Hidden if a page has fewer
    than 3 H2s (the text column then starts at the left).
  - Phone: a 50 px field (`#f5f5f3`, `#ececec` border) "On this page · N sections" with a caret, opening the same
    list; then the text.
- **Text styles:**
  - H2: EB Garamond 28 (24 phone), `#1a1a1a`, weight 400, 48 px above (36 phone), 16 px below.
  - H3 (if used): Lato 17 bold `#1a1a1a`, 28 px above.
  - Paragraphs: Lato 17 / 1.75 (16 / 1.7 phone), `#444`, 16 px apart.
  - Lists: bullets, 22 px indent, same size as paragraphs, 4 px between items.
  - Links inside the text: `#1a1a1a` bold, no underline.
  - Headings shown in sentence case (CSS can't do this reliably: fix the headings in the editor).
- **Content fixes for the owner in admin (Terms):** "Lumen Gallery" → "The Art Room" (Informational purpose);
  "the The Art Room website" → "The Art Room website"; "proceding" → "preceding" (Limitation of liability).
