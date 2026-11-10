/**
 * Password validation and generation utilities
 */

// Password requirements: 8+ chars, at least 1 uppercase, 1 lowercase, 1 number
const PASSWORD_MIN_LENGTH = 8
// Not a policy limit — bcrypt only reads the first 72 bytes anyway. This exists
// so an unbounded string can never reach hashing or a database write. Kept in
// step with MAX_LENGTHS.password in src/lib/validation.
const PASSWORD_MAX_LENGTH = 200
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

  // Returns early: the rules below run regexes over the whole string, and there
  // is no reason to spend that on input already being rejected.
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, errors: [`at most ${PASSWORD_MAX_LENGTH} characters`] }
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
    Array.from({ length: count }, () => chars[randomIndex(chars.length)]).join('')

  const chars = (pick(upper, 2) + pick(lower, 4) + pick(digits, 2)).split('')

  // Fisher–Yates shuffle (a sort with a random comparator is biased).
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/**
 * Uniform random integer in [0, n) from the platform CSPRNG. A provisional
 * password logs its holder straight in (no email code), so it must not be
 * predictable from Math.random's engine state. Rejection sampling keeps every
 * index equally likely.
 */
function randomIndex(n: number): number {
  const buffer = new Uint32Array(1)
  const limit = Math.floor(0x1_0000_0000 / n) * n
  let value: number
  do {
    globalThis.crypto.getRandomValues(buffer)
    value = buffer[0]
  } while (value >= limit)
  return value % n
}
