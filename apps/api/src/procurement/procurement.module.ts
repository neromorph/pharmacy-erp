import { Module } from '@nestjs/common'
import { ProcurementController } from './procurement.controller'
import { ProcurementService } from './procurement.service'
import { SupabaseModule } from '../supabase/supabase.module'

@Module({
  imports: [SupabaseModule],
  controllers: [ProcurementController],
  providers: [ProcurementService],
})
export class ProcurementModule {}