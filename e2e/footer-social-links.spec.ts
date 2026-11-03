import { test, expect } from '@playwright/test'

import { CONTACT_EMAIL, SOCIAL_LINKS } from '@/lib/socialLinks'

/**
 * The bar above the footer links to the gallery's Instagram, Facebook and
 * Pinterest, opening in a new tab so a visitor never loses the gallery, and to its email. The same three addresses go into the
 * Organization JSON-LD `sameAs`, which is how search engines tie the accounts
 * to the site. Both read from SOCIAL_LINKS, so this spec does too.
 */
test('the footer bar links to Instagram, Facebook, Pinterest and Email', async ({ page }) => {
  await page.goto('/')
  const footer = page.locator('footer')

  for (const [name, href] of [
    ['Instagram', SOCIAL_LINKS.instagram],
    ['Facebook', SOCIAL_LINKS.facebook],
    ['Pinterest', SOCIAL_LINKS.pinterest],
  ] as const) {
    const link = footer.getByRole('link', { name, exact: true })
    await expect(link).toHaveAttribute('href', href)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', /noopener/)
  }

  await expect(footer.getByRole('link', { name: 'Email', exact: true })).toHaveAttribute(
    'href',
    `mailto:${CONTACT_EMAIL}`,
  )
})

test('the Organization JSON-LD lists every social account', async ({ page }) => {
  await page.goto('/')
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
  const organization = blocks
    .map((text) => JSON.parse(text) as { '@type'?: string; sameAs?: string[] })
    .find((data) => data['@type'] === 'Organization')

  expect(organization?.sameAs).toEqual([
    SOCIAL_LINKS.instagram,
    SOCIAL_LINKS.facebook,
    SOCIAL_LINKS.pinterest,
  ])
})
