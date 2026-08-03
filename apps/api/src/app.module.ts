import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { AuthModule } from './auth/auth.module'
import { SupabaseModule } from './supabase/supabase.module'
import { ProductsModule } from './products/products.module'

@Module({
  controllers: [HealthController],
  imports: [AuthModule, SupabaseModule, ProductsModule],
})
export class AppModule {}