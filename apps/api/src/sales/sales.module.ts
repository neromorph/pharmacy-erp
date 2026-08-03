import { Module } from '@nestjs/common'
import { SalesController } from './sales.controller'
import { SalesService } from './sales.service'
import { SupabaseModule } from '../supabase/supabase.module'

@Module({
  imports: [SupabaseModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}