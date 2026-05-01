import { test, expect, type Page } from '@playwright/test'

import { fixtures, routes } from './fixtures'
import { pickCheckoutCountry } from './wizard-helpers'

/**
 * PrintCheckout form behaviour — required-field validation messages
 * and the phone-prefix dropdown.
 *
 * Read-only: every test stops before the form is submitted to the
 * server. Native `required` + the in-component `setTouched` flow are
 * exercised, but no PaymentIntent is ever created.
 */

async function gotoCheckout(page: Page): Promise<void> {
  const slug = fixtures.artworkSlug
  const wizardResponse = await page.goto(routes.printWizard(slug))
  expect(wizardResponse?.status(), 'wizard should respond 2xx').toBeLessThan(400)

  const wizardCta = page.getByRole('button', { name: /add shipping address/i })
  await expect(wizardCta, 'wizard CTA should be enabled with default config').toBeEnabled({
    timeout: 30_000,
  })
  await wizardCta.click()
  await page.waitForURL(`**/artworks/${slug}/print/checkout?**`, { timeout: 15_000 })
}

test('checkout: country field flips data-invalid as the user picks/un-picks', async ({ page }) => {
  test.setTimeout(45_000)
  await gotoCheckout(page)

  // The country error message ("Please choose a country.") is gated
  // by two attributes on the country .field wrapper:
  //   data-invalid="true" — set when `!country`
  //   data-touched="true" — set after a submit attempt or after
  //                         picking once
  // We can't easily fire the submit handler from a disabled-button
  // form, so instead verify the data-invalid mechanism, which is
  // what gates the error in the first place. The error span itself
  // is in the DOM either way (hidden by CSS).

  const countryField = page
    .locator('label', { hasText: /^Country$/ })
    .locator('xpath=ancestor::div[1]')
  await expect(countryField, 'country field wrapper should be present').toBeVisible({
    timeout: 15_000,
  })
  await expect(
    countryField,
    'country field should be marked invalid before any selection',
  ).toHaveAttribute('data-invalid', 'true')

  // The error span should already be in the DOM (rendered, just
  // hidden by CSS until both data-touched and data-invalid are true).
  await expect(
    page.locator('text=Please choose a country.'),
    'country error span should exist in DOM',
  ).toHaveCount(1)

  // After picking, data-invalid should flip to "false".
  await pickCheckoutCountry(page, 'belgium')
  await expect(
    countryField,
    'country field should no longer be invalid after a pick',
  ).toHaveAttribute('data-invalid', 'false')
})

test('checkout: phone field shows "Please enter a phone number." after touched + invalid', async ({
  page,
}) => {
  test.setTimeout(45_000)
  await gotoCheckout(page)

  // Pick a country first so the form's other gates pass; we want the
  // phone error specifically.
  await pickCheckoutCountry(page, 'belgium')

  // Focus and blur the phone input without typing — that flips the
  // field into `data-touched="true"`, which combined with native
  // `:invalid` (required + empty) renders the error span.
  const phoneInput = page.getByLabel(/phone \(for carrier\)/i)
  await phoneInput.focus()
  await phoneInput.blur()

  await expect(
    page.getByText('Please enter a phone number.'),
    'phone error should be shown once field is touched while empty',
  ).toBeVisible({ timeout: 5_000 })
})

test('checkout: phone-dial dropdown lists unique, sorted prefixes', async ({ page }) => {
  test.setTimeout(45_000)
  await gotoCheckout(page)

  // Two SelectDropdowns on this page: country + phone-prefix. The
  // SelectDropdown component has no aria-label, so we can't target by
  // name. Identify the phone-prefix one by its text shape — it always
  // shows "+<digits>" (the seeded ES dial code at first render),
  // whereas the country trigger shows either a country name or the
  // "Choose a country…" placeholder.
  const dialTrigger = page
    .getByRole('button')
    .filter({ hasText: /^\+\d+$/ })
    .first()
  await expect(dialTrigger, 'phone-prefix trigger should be on the page').toBeVisible({
    timeout: 15_000,
  })
  await dialTrigger.click()

  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible({ timeout: 5_000 })

  const labels = await listbox.getByRole('option').allTextContents()
  const trimmed = labels.map((l) => l.trim()).filter(Boolean)

  // Every option is just "+<digits>" — no country names.
  for (const label of trimmed) {
    expect(label, `option "${label}" should match +<digits> only`).toMatch(/^\+\d+$/)
  }

  // Deduplicated: no two options share the same dial code.
  const uniqueCount = new Set(trimmed).size
  expect(uniqueCount, 'phone-prefix options should be deduplicated').toBe(trimmed.length)

  // Sorted numerically ascending. Compare consecutive pairs.
  const numeric = trimmed.map((l) => Number(l.replace('+', '')))
  for (let i = 1; i < numeric.length; i++) {
    expect(numeric[i], `option ${trimmed[i]} should sort after ${trimmed[i - 1]}`).toBeGreaterThan(
      numeric[i - 1],
    )
  }

  // Sanity: enough entries to be plausible (the catalog covers ~150
  // unique dial codes globally; assert a generous lower bound).
  expect(trimmed.length, 'should expose a meaningful number of prefixes').toBeGreaterThan(100)
})
