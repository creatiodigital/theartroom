import { test, expect } from '@playwright/test'
import { r2Reachable, R2_BLOCKED_REASON } from './r2-reachable'

import prisma from '@/lib/prisma'
import { deleteR2KeyDirect, getR2ObjectSize, uploadToR2 } from '@/lib/r2'

/**
 * Deleting a user (AR-189). The cascade would take a user's artworks and exhibitions with the row
 * but none of their files, and a work with orders can't go at all (it 500ed). So the delete is
 * refused while the user still has either, with what to delete first, and the admin Users page
 * says so. A user with neither goes, and their profile image and signature leave R2 after the row.
 *
 * Runs as the e2e admin, a superAdmin (only a superAdmin deletes users).
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

/** Profile images and signatures live in the PUBLIC bucket: a head on that one. */
const publicObjectExists = async (key: string) => (await getR2ObjectSize(key)) !== null

const stampNow = () => `${Date.now().toString(36)}-${Math.round(Math.random() * 1e6).toString(36)}`

/** A throwaway user nobody else uses. */
const createUser = (
  stamp: string,
  extra: { profileImageUrl?: string; signatureUrl?: string } = {},
) =>
  prisma.user.create({
    data: {
      name: 'E2E Delete',
      lastName: `User ${stamp}`,
      handler: `e2e-delete-user-${stamp}`,
      biography: '',
      userType: 'artist',
      ...extra,
    },
    select: { id: true, name: true, lastName: true },
  })

test('a user who still has an artwork and an exhibition is refused, and the Users page says why', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const stamp = stampNow()
  let userId: string | null = null
  try {
    const user = await createUser(stamp)
    userId = user.id
    await prisma.artwork.create({
      data: {
        name: 'E2E Delete User Work',
        slug: `e2e-delete-user-work-${stamp}`,
        title: 'E2E Delete User Work',
        userId: user.id,
      },
    })
    await prisma.exhibition.create({
      data: {
        userId: user.id,
        handler: `e2e-delete-user-${stamp}`,
        mainTitle: 'E2E Delete User Exhibition',
        url: `e2e-delete-user-${stamp}`,
        spaceId: 'paris',
        status: 'draft',
      },
    })
    const fullName = `${user.name} ${user.lastName}`

    await page.goto('/admin/users')
    const row = page.locator('tbody tr', { hasText: fullName }).first()
    await row.getByRole('button', { name: `Actions for ${fullName}` }).click()
    await page.getByRole('menuitem', { name: 'Delete user…' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.locator('#confirm-delete-user').fill('CONFIRM')
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(dialog).toContainText(
      'This user still has 1 artwork and 1 exhibition. Delete them first, then the user.',
    )

    // Nothing went: the user, the work and the exhibition are all still there.
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1)
    expect(await prisma.artwork.count({ where: { userId: user.id } })).toBe(1)
    expect(await prisma.exhibition.count({ where: { userId: user.id } })).toBe(1)

    // The API's own answer: a 409, not the 500 a sold work used to give.
    const res = await page.request.delete(`/api/users/${user.id}`)
    expect(res.status()).toBe(409)
  } finally {
    try {
      if (userId) {
        await prisma.exhibition.deleteMany({ where: { userId } })
        await prisma.artwork.deleteMany({ where: { userId } })
        await prisma.user.deleteMany({ where: { id: userId } })
      }
    } catch (err) {
      console.warn('[e2e cleanup] user delete (refused):', err instanceof Error ? err.message : err)
    }
  }
})

test('a user with no artworks or exhibitions goes, and their profile image and signature leave R2', async ({
  page,
}) => {
  test.skip(!(await r2Reachable()), R2_BLOCKED_REASON)
  test.setTimeout(90_000)
  const stamp = stampNow()
  // REAL objects in R2, so "the file is gone" is a fact and not a mock.
  const profileKey = `staging/test/user-delete-profile-${stamp}.webp`
  const signatureKey = `staging/test/user-delete-signature-${stamp}.png`
  let userId: string | null = null
  try {
    const [profileImageUrl, signatureUrl] = await Promise.all([
      uploadToR2(profileKey, Buffer.from('e2e-user-delete-profile'), 'image/webp'),
      uploadToR2(signatureKey, Buffer.from('e2e-user-delete-signature'), 'image/png'),
    ])
    const user = await createUser(stamp, { profileImageUrl, signatureUrl })
    userId = user.id
    expect(await publicObjectExists(profileKey), 'profile image uploaded').toBe(true)
    expect(await publicObjectExists(signatureKey), 'signature uploaded').toBe(true)

    const res = await page.request.delete(`/api/users/${user.id}`)
    expect(res.status(), `delete should succeed: ${await res.text()}`).toBe(200)

    expect(await prisma.user.count({ where: { id: user.id } }), 'user row is gone').toBe(0)
    expect(await publicObjectExists(profileKey), 'profile image deleted').toBe(false)
    expect(await publicObjectExists(signatureKey), 'signature deleted').toBe(false)
  } finally {
    try {
      if (userId) await prisma.user.deleteMany({ where: { id: userId } })
      for (const key of [profileKey, signatureKey]) {
        if (await publicObjectExists(key)) await deleteR2KeyDirect(key)
      }
    } catch (err) {
      console.warn('[e2e cleanup] user delete (files):', err instanceof Error ? err.message : err)
    }
  }
})
