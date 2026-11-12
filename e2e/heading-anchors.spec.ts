import { test, expect } from '@playwright/test'

import { splitAtH2, withHeadingAnchors } from '../src/lib/richText/headingAnchors'

/**
 * The content pages' "On this page" (docs/public-redesign/legal.md): every H2 of the editor's
 * text gets an anchor, and the list is built from them. The helper alone, no page.
 */
test.describe('heading anchors (public step 32)', () => {
  test('each H2 gets an id from its text, listed in order', () => {
    const { html, headings } = withHeadingAnchors(
      '<p>Intro</p><h2>Informational purpose</h2><p>a</p><h2>Privacy</h2>',
    )
    expect(headings).toEqual([
      { id: 'informational-purpose', text: 'Informational purpose' },
      { id: 'privacy', text: 'Privacy' },
    ])
    expect(html).toBe(
      '<p>Intro</p><h2 id="informational-purpose">Informational purpose</h2><p>a</p><h2 id="privacy">Privacy</h2>',
    )
  })

  test('a repeated heading gets a numbered id', () => {
    const { headings } = withHeadingAnchors('<h2>Notes</h2><h2>Notes</h2><h2>Notes</h2>')
    expect(headings.map((h) => h.id)).toEqual(['notes', 'notes-2', 'notes-3'])
  })

  test('markup and entities inside a heading are read as text', () => {
    const { headings, html } = withHeadingAnchors(
      '<h2 class="x"><strong>Terms &amp; sale</strong>&nbsp;today</h2>',
    )
    expect(headings).toEqual([{ id: 'terms-sale-today', text: 'Terms & sale today' }])
    expect(html).toBe(
      '<h2 class="x" id="terms-sale-today"><strong>Terms &amp; sale</strong>&nbsp;today</h2>',
    )
  })

  test('accents are folded in the id, kept in the text', () => {
    const { headings } = withHeadingAnchors('<h2>Política de privacidad</h2>')
    expect(headings).toEqual([{ id: 'politica-de-privacidad', text: 'Política de privacidad' }])
  })

  test('H3s and everything else stay as they are', () => {
    const source = '<h3>Sub</h3><p>Text <a href="/x">link</a></p><ul><li>One</li></ul>'
    expect(withHeadingAnchors(source)).toEqual({ html: source, headings: [] })
  })

  test('an empty H2 is left out of the list and gets no id', () => {
    const source = '<h2> </h2><h2><br></h2>'
    expect(withHeadingAnchors(source)).toEqual({ html: source, headings: [] })
  })
})

// About (step 33): each H2 of the editor's text becomes a labelled section.
test.describe('splitAtH2 (public step 33)', () => {
  test('cuts at every H2, the heading as text, the rest as HTML', () => {
    expect(
      splitAtH2('<h2>The Gallery</h2><p>a</p><p>b</p><h2>Program &amp; Approach</h2><p>c</p>'),
    ).toEqual([
      { heading: 'The Gallery', html: '<p>a</p><p>b</p>' },
      { heading: 'Program & Approach', html: '<p>c</p>' },
    ])
  })

  test('text before the first H2 is kept without a heading; blank parts are dropped', () => {
    expect(splitAtH2('<p>Intro</p><h2 class="x">One</h2><p>1</p><p></p>')).toEqual([
      { heading: null, html: '<p>Intro</p>' },
      { heading: 'One', html: '<p>1</p><p></p>' },
    ])
    expect(splitAtH2('<p> </p><h2>One</h2><p>1</p>')).toEqual([
      { heading: 'One', html: '<p>1</p>' },
    ])
  })

  test('no H2 at all: one part, unlabelled', () => {
    expect(splitAtH2('<p>Just text</p>')).toEqual([{ heading: null, html: '<p>Just text</p>' }])
    expect(splitAtH2('')).toEqual([])
  })
})
