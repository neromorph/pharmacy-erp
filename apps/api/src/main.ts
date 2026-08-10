import './instrument'

import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import * as express from 'express'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  })

  // Security hardening:
  // - helmet sets safe HTTP headers (CSP, HSTS, X-Content-Type-Options, ...)
  // - JSON body limit blocks oversized-payload abuse
  // - global ValidationPipe strips and rejects unknown request properties
  app.use(helmet())
  app.use(express.json({ limit: '100kb' }))
  app.use(express.urlencoded({ extended: true, limit: '100kb' }))
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  await app.listen(process.env.PORT ?? 3001)
}
bootstrap()
