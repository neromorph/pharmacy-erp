import { Controller, Get, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
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
}
