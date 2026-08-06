import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.NODE_ENV === 'development') {
      // ponytail: Next 16 dev proxy (router-server httpxy + compression) stacks
      // close listeners on response objects; raises the bar above the warning
      // threshold instead of hiding it. Remove when upstream fixes the leak.
      process.setMaxListeners(100)
    }
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Captures all unhandled server-side request errors
export const onRequestError = Sentry.captureRequestError
