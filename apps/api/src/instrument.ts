import * as Sentry from '@sentry/nestjs'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? 'https://61d19fb413c27629d4ec1ae2ad36df1b@o4511864804343808.ingest.us.sentry.io/4511864808275968',
  integrations: [nodeProfilingIntegration()],
  // Send structured logs to Sentry
  enableLogs: true,
  // Tracing
  tracesSampleRate: 0.1,
  profileSessionSampleRate: 0.1,
  profileLifecycle: 'trace',
})
