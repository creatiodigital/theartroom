import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: 1.0,

  // Enable logging
  enableLogs: true,

  // Console logging integration
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
  ],

  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production',

  // Replay for session recording (errors only)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,
})
