import bcrypt from 'bcryptjs'

/**
 * bcrypt hash (cost 10, the cost every stored password uses) of a random string
 * nobody knows. Compared against when there is no account, so an unknown email
 * costs the same ~80 ms as a known one and response time cannot tell them apart.
 * Not a secret — it matches nothing.
 */
const DUMMY_HASH = '$2b$10$aO43YP6LHoemyJ37WA5f7uPbPk/i4kuzslJ8ToJYDJqdhnN6LL/9i'

/**
 * True when `password` matches `storedHash`. Always runs one bcrypt compare —
 * against a dummy hash when the account or its password is missing — so the
 * two outcomes take the same time.
 */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  const matches = await bcrypt.compare(password, storedHash ?? DUMMY_HASH)
  return Boolean(storedHash) && matches
}
