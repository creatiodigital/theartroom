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

  // Filter out noise from bots, browser extensions, and unactionable WebGL errors
  beforeSend(event) {
    // Ignore errors from bots/crawlers — they can't run WebGL
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    if (/bot|crawl|spider|Google-Read-Aloud|Googlebot|Bingbot|Slurp/i.test(ua)) {
      return null
    }

    const message = event.exception?.values?.[0]?.value || ''

    // Browser extensions (e.g. Google Translate) manipulating the DOM
    if (
      message.includes('removeChild') ||
      message.includes('insertBefore') ||
      message.includes('The node to be removed is not a child of this node')
    ) {
      return null
    }

    // WebGL context loss on mobile — device GPU limitation, not a code bug
    if (message.includes('getProgramInfoLog') || message.includes('getShaderInfoLog')) {
      return null
    }

    return event
  },
})
