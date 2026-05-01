import { test, expect } from '@playwright/test'

/**
 * /admin/orders — bucket tabs render correctly.
 *
 * The orders list groups orders into nine buckets by current state:
 * `New | At TPS | In production | Shipped | Delivered | Artist paid |
 * Rejected | Refunded | Needs attention`. This spec asserts the tab
 * structure (titles + count badges) without touching any orders, so
 * it's safe to run against the shared dev DB.
 *
 * Read-only: navigates to the page and reads the tablist; never
 * clicks any row CTA, never advances any stage, never refunds, never
 * creates orders.
 */

test.use({ storageState: 'e2e/.auth/admin.json' })

const EXPECTED_TABS = [
  'New',
  'At TPS',
  'In production',
  'Shipped',
  'Delivered',
  'Artist paid',
  'Rejected',
  'Refunded',
  'Needs attention',
] as const

test('admin/orders: nine bucket tabs render in pipeline order', async ({ page }) => {
  test.setTimeout(45_000)

  const res = await page.goto('/admin/orders')
  expect(res?.status(), 'orders page should respond 2xx').toBeLessThan(400)

  const tablist = page.getByRole('tablist', { name: /order workflow stages/i })
  await expect(tablist, 'tablist should render').toBeVisible({ timeout: 15_000 })

  const tabs = tablist.getByRole('tab')
  await expect(tabs, 'should render every bucket tab').toHaveCount(EXPECTED_TABS.length)

  for (let i = 0; i < EXPECTED_TABS.length; i++) {
    await expect(
      tabs.nth(i),
      `tab #${i} should be "${EXPECTED_TABS[i]}"`,
    ).toContainText(EXPECTED_TABS[i])
  }
})

test('admin/orders: every tab exposes a numeric count badge', async ({ page }) => {
  test.setTimeout(45_000)

  await page.goto('/admin/orders')
  const tablist = page.getByRole('tablist', { name: /order workflow stages/i })
  await expect(tablist).toBeVisible({ timeout: 15_000 })

  const tabs = tablist.getByRole('tab')
  const tabCount = await tabs.count()

  for (let i = 0; i < tabCount; i++) {
    const text = (await tabs.nth(i).innerText()).trim()
    // Each tab's button text ends with a number — the count pill.
    // Tab innerText is "<title><count>" with no separator (e.g. "New0",
    // "At TPS3"). We just need the trailing digits regardless.
    expect(
      text,
      `tab "${text}" should expose a trailing numeric count`,
    ).toMatch(/\d+\s*$/)
  }
})

test('admin/orders: clicking Refunded tab swaps the helper copy', async ({ page }) => {
  test.setTimeout(45_000)

  await page.goto('/admin/orders')
  const tablist = page.getByRole('tablist', { name: /order workflow stages/i })
  await expect(tablist).toBeVisible({ timeout: 15_000 })

  // Default lands on "New" — its helper mentions the card hold.
  await expect(
    page.getByText(/Buyer paid; card is on hold/i),
    'New tab should be the default and show its helper',
  ).toBeVisible({ timeout: 5_000 })

  await tablist.getByRole('tab', { name: /^Refunded/ }).click()

  await expect(
    page.getByText(/Buyer was refunded/i),
    'Refunded tab should show its own helper copy',
  ).toBeVisible({ timeout: 5_000 })
})

test('admin/orders: clicking Rejected tab swaps the helper copy', async ({ page }) => {
  test.setTimeout(45_000)

  await page.goto('/admin/orders')
  const tablist = page.getByRole('tablist', { name: /order workflow stages/i })
  await expect(tablist).toBeVisible({ timeout: 15_000 })

  await tablist.getByRole('tab', { name: /^Rejected/ }).click()

  await expect(
    page.getByText(/Orders pulled out of the pipeline/i),
    'Rejected tab should show its own helper copy',
  ).toBeVisible({ timeout: 5_000 })
})
