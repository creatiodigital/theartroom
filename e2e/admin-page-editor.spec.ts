import { test, expect, type Page } from '@playwright/test'

import { seedCookieConsent } from './consent-helpers'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * The page editor's save bar (gallery.md §2c): "Unsaved changes" only after a
 * real edit, Discard puts the last saved values back, and leaving with unsaved
 * changes asks first (Q81).
 *
 * Read-only: nothing here presses Save, Replace or Remove, so no page and no
 * banner is written. Typed text only ever lives in the browser.
 */

const PAGES = [
  { slug: 'about', label: 'About us' },
  { slug: 'prints', label: 'Prints' },
  { slug: 'terms', label: 'Terms and conditions' },
  { slug: 'sale-terms', label: 'Online terms of sale' },
  { slug: 'privacy', label: 'Privacy policy' },
  { slug: 'accessibility', label: 'Accessibility policy' },
]

const saveBar = (page: Page) => page.getByRole('region', { name: 'Save' })

async function openEditor(page: Page, slug: string) {
  await seedCookieConsent(page)
  await page.goto(`/admin/content/${slug}`)
  await expect(page.getByRole('textbox', { name: 'Content' })).toBeVisible()
}

for (const { slug, label } of PAGES) {
  test(`an untouched ${label} page reads as saved`, async ({ page }) => {
    await openEditor(page, slug)
    await expect(page.getByRole('heading', { level: 1, name: `${label} page` })).toBeVisible()

    // As it mounts, the editor rewrites the stored HTML into its own form and
    // reports it as a change. That must not count as an edit: give it a moment
    // to land, then the bar must still say saved.
    await page.waitForTimeout(300)
    await expect(saveBar(page).getByRole('status')).toHaveText('All changes saved')
    await expect(saveBar(page).getByRole('button', { name: 'Discard' })).toBeDisabled()

    await expect(page.getByRole('heading', { name: 'Banner image' })).toHaveCount(
      slug === 'prints' ? 1 : 0,
    )
  })
}

test('Discard puts back the title and the text', async ({ page }) => {
  await openEditor(page, 'about')
  const bar = saveBar(page)
  const status = bar.getByRole('status')
  const dialog = page.getByRole('dialog')

  const title = page.getByRole('textbox', { name: 'Page title' })
  const loadedTitle = await title.inputValue()
  await title.fill(`${loadedTitle} e2e`)
  await expect(status).toHaveText('Unsaved changes')

  await bar.getByRole('button', { name: 'Discard' }).click()
  await expect(dialog).toContainText('Discard changes?')
  await dialog.getByRole('button', { name: 'Discard' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(title).toHaveValue(loadedTitle)
  await expect(status).toHaveText('All changes saved')

  // Focus, not click: a click could land on a link inside the text.
  const token = 'e2eDiscardToken'
  const text = page.getByRole('textbox', { name: 'Content' })
  await text.focus()
  await page.keyboard.type(token)
  await expect(text).toContainText(token)
  await expect(status).toHaveText('Unsaved changes')

  await bar.getByRole('button', { name: 'Discard' }).click()
  await dialog.getByRole('button', { name: 'Discard' }).click()
  await expect(text).not.toContainText(token)
  await expect(status).toHaveText('All changes saved')
})

test('with unsaved changes, closing the tab asks first', async ({ page }) => {
  await openEditor(page, 'about')
  const title = page.getByRole('textbox', { name: 'Page title' })

  // A real click and real keys: the browser asks only on a page the user has
  // interacted with. Nothing is saved; Stay keeps the typed text in the browser.
  await title.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' e2e')
  await expect(saveBar(page).getByRole('status')).toHaveText('Unsaved changes')

  const asked = page.waitForEvent('dialog')
  await page.close({ runBeforeUnload: true })
  const dialog = await asked
  expect(dialog.type()).toBe('beforeunload')
  await dialog.dismiss()
  await expect(title).toHaveValue(/ e2e$/)
})
