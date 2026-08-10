import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { SentryModule } from '@sentry/nestjs/setup'
import { HealthController } from './health.controller'
import { AuthModule } from './auth/auth.module'
import { SupabaseModule } from './supabase/supabase.module'
import { ProductsModule } from './products/products.module'
import { ProcurementModule } from './procurement/procurement.module'
import { SalesModule } from './sales/sales.module'

@Module({
  controllers: [HealthController],
  imports: [
    SentryModule.forRoot(),
    // Rate limit: 100 requests per IP per minute. Guards all routes.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    AuthModule,
    SupabaseModule,
    ProductsModule,
    ProcurementModule,
    SalesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}