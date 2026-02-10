/**
 * Password validation and generation utilities
 */

// Password requirements: 8+ chars, at least 1 uppercase, 1 lowercase, 1 number
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_RULES = [
  { regex: /[A-Z]/, message: 'at least one uppercase letter' },
  { regex: /[a-z]/, message: 'at least one lowercase letter' },
  { regex: /[0-9]/, message: 'at least one number' },
]

export type PasswordValidationResult = {
  valid: boolean
  errors: string[]
}

/**
 * Validate a password against the requirements.
 * Returns { valid: true } or { valid: false, errors: [...] }
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = []

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`at least ${PASSWORD_MIN_LENGTH} characters`)
  }

  for (const rule of PASSWORD_RULES) {
    if (!rule.regex.test(password)) {
      errors.push(rule.message)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Generate a random provisional password that meets all requirements.
 * Format: 2 uppercase + 2 lowercase + 2 digits + 2 lowercase = 8 chars, then shuffled
 */
export function generateProvisionalPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // No I, O to avoid confusion
  const lower = 'abcdefghjkmnpqrstuvwxyz' // No i, l, o to avoid confusion
  const digits = '23456789' // No 0, 1 to avoid confusion

  const pick = (chars: string, count: number) =>
    Array.from({ length: count }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

  const parts = pick(upper, 2) + pick(lower, 4) + pick(digits, 2)

  // Shuffle
  return parts
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}
