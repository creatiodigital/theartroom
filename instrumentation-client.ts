import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: 1.0,

  // Enable logging
  enableLogs: true,

  // Console logging integration
  integrations: [Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] })],

  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production',

  // Replay for session recording (errors only)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,

  // Filter out noise from browser extensions (e.g. Google Translate)
  beforeSend(event) {
    const message = event.exception?.values?.[0]?.value || ''
    if (
      message.includes('removeChild') ||
      message.includes('insertBefore') ||
      message.includes('The node to be removed is not a child of this node')
    ) {
      return null
    }
    return event
  },
})
