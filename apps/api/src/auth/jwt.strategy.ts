import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long',
    })
  }

  async validate(payload: any) {
    if (!payload.app_metadata?.tenant_id) {
      throw new UnauthorizedException('Missing tenant_id in JWT')
    }
    return {
      id: payload.sub,
      tenantId: payload.app_metadata.tenant_id,
      email: payload.email,
    }
  }
}
