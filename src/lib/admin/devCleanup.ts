/**
 * Whether the dev/staging test-data cleanup tools are on (order hard-delete,
 * "Dev cleanup" on the admin dashboard). An allowlist, not "anything but
 * production": these wipe orders and issued invoices, so a production build
 * that lost or misspelled NEXT_PUBLIC_APP_ENV must keep them OFF.
 *
 * Inlined at build time, so client components can read it too; the server
 * actions check it again and are the authoritative guard.
 */
export const DEV_CLEANUP_ALLOWED =
  process.env.NEXT_PUBLIC_APP_ENV === 'staging' ||
  process.env.NEXT_PUBLIC_APP_ENV === 'development'
