import { test, expect } from '@playwright/test'

import { inviteKind, SET_PASSWORD_LINK_HOURS } from '../src/lib/invite'

/**
 * Step 21 (questions.md Q37): re-inviting someone who already signs in with their own password
 * sends a link to set a new one and leaves the password alone; everyone else still gets a
 * temporary password, as before. The rule alone, no request.
 */
test.describe('invite kind (step 21)', () => {
  test('a user with their own password gets a set-password link', () => {
    expect(inviteKind({ password: '$2a$10$hash', mustChangePassword: false })).toBe(
      'set-password-link',
    )
  })

  test('a user who never finished the first sign-in gets a new temporary password', () => {
    expect(inviteKind({ password: '$2a$10$hash', mustChangePassword: true })).toBe(
      'temporary-password',
    )
  })

  test('a user with no password yet (first invite) gets a temporary password', () => {
    expect(inviteKind({ password: null, mustChangePassword: false })).toBe('temporary-password')
  })

  test('the link lasts three days', () => {
    expect(SET_PASSWORD_LINK_HOURS).toBe(72)
  })
})
