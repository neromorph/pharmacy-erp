import { Controller, Get, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import * as Sentry from '@sentry/nestjs'
import { CurrentUser } from './auth/current-user.decorator'

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok' }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('auth')
  authCheck(@CurrentUser() user: any) {
    return { status: 'authenticated', tenantId: user.tenantId }
  }

  @Get('debug-sentry')
  debugSentry() {
    // Send a log before throwing the error
    Sentry.logger.info('User triggered test error', {
      action: 'test_error_endpoint',
    })
    // Send a test metric before throwing the error
    Sentry.metrics.count('test_counter', 1)
    throw new Error('My first Sentry error!')
  }
}
