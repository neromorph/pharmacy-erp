import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn:
    process.env.SENTRY_DSN ??
    'https://2cff9442f6e80c9f4e06e5db27240367@o4511864804343808.ingest.us.sentry.io/4511864835407872',
  integrations: [
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
  ],
  // Capture 100% of transactions for performance monitoring
  tracesSampleRate: 1.0,
  // Attach local variable values to stack frames
  includeLocalVariables: true,
  // Enable logs to be sent to Sentry
  enableLogs: true,
})