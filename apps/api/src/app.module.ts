import { Module } from '@nestjs/common'
import { SentryModule } from '@sentry/nestjs/setup'
import { HealthController } from './health.controller'
import { AuthModule } from './auth/auth.module'
import { SupabaseModule } from './supabase/supabase.module'
import { ProductsModule } from './products/products.module'
import { ProcurementModule } from './procurement/procurement.module'
import { SalesModule } from './sales/sales.module'

@Module({
  controllers: [HealthController],
  imports: [SentryModule.forRoot(), AuthModule, SupabaseModule, ProductsModule, ProcurementModule, SalesModule],
})
export class AppModule {}