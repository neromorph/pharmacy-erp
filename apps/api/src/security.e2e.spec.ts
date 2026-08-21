import { Test } from '@nestjs/testing'
import { Controller, Get, Post, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { NestExpressApplication } from '@nestjs/platform-express'
import * as express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { AuthModule } from './auth/auth.module'
import { CurrentUser } from './auth/current-user.decorator'

// Must match the fallback secret in jwt.strategy.ts (used when
// SUPABASE_JWT_SECRET is unset, e.g. in the test environment).
const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long'

@Controller('secure')
@UseGuards(AuthGuard('jwt'))
class SecureController {
  @Get()
  who(@CurrentUser() user: jwt.JwtPayload) {
    return { user }
  }

  @Post()
  create() {
    return { ok: true }
  }
}

describe('Security boundaries (e2e)', () => {
  let app: NestExpressApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [SecureController],
    }).compile()

    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    })
    // Mirror the production JSON body limit from main.ts.
    app.use(express.json({ limit: '100kb' }))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  function sign(payload: jwt.JwtPayload, opts?: jwt.SignOptions) {
    return jwt.sign(payload, JWT_SECRET, opts)
  }

  it('rejects a request without a token', async () => {
    await request(app.getHttpServer()).get('/secure').expect(401)
  })

  it('rejects a malformed token', async () => {
    await request(app.getHttpServer())
      .get('/secure')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401)
  })

  it('rejects an expired token', async () => {
    const token = sign({ sub: 'u1', app_metadata: { tenant_id: 't1' } }, { expiresIn: -60 })
    await request(app.getHttpServer())
      .get('/secure')
      .set('Authorization', `Bearer ${token}`)
      .expect(401)
  })

  it('rejects a token signed with a different secret', async () => {
    const token = jwt.sign(
      { sub: 'u1', app_metadata: { tenant_id: 't1' } },
      'wrong-secret-wrong-secret-wrong-secret',
    )
    await request(app.getHttpServer())
      .get('/secure')
      .set('Authorization', `Bearer ${token}`)
      .expect(401)
  })

  it('rejects a token without tenant_id', async () => {
    const token = sign({ sub: 'u1' })
    await request(app.getHttpServer())
      .get('/secure')
      .set('Authorization', `Bearer ${token}`)
      .expect(401)
  })

  it('accepts a valid token with tenant_id', async () => {
    const token = sign({ sub: 'u1', email: 'a@b.c', app_metadata: { tenant_id: 't1' } })
    const res = await request(app.getHttpServer())
      .get('/secure')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(res.body.user.tenantId).toBe('t1')
  })

  it('rejects an oversized JSON body', async () => {
    const token = sign({ sub: 'u1', app_metadata: { tenant_id: 't1' } })
    const big = JSON.stringify({ data: 'x'.repeat(200 * 1024) })
    await request(app.getHttpServer())
      .post('/secure')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send(big)
      .expect(413)
  })
})
