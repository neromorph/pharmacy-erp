import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ProcurementService } from './procurement.service'
import { CurrentUser } from '../auth/current-user.decorator'
import {
  CreateSupplierDto,
  CreatePurchaseOrderDto,
  ReceiveGoodsDto,
} from './dto/procurement.dto'

@UseGuards(AuthGuard('jwt'))
@Controller('procurement')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Post('suppliers')
  createSupplier(@Body() createDto: CreateSupplierDto, @CurrentUser() user: any) {
    return this.procurementService.createSupplier(createDto, user)
  }

  @Get('suppliers')
  listSuppliers() {
    return this.procurementService.listSuppliers()
  }

  @Post('purchase-orders')
  createPurchaseOrder(@Body() createDto: CreatePurchaseOrderDto, @CurrentUser() user: any) {
    return this.procurementService.createPurchaseOrder(createDto, user)
  }

  @Post('purchase-orders/:id/submit')
  submitPurchaseOrder(@Param('id') id: string) {
    return this.procurementService.submitPurchaseOrder(id)
  }

  @Post('purchase-orders/:id/approve')
  approvePurchaseOrder(@Param('id') id: string, @CurrentUser() user: any) {
    return this.procurementService.approvePurchaseOrder(id, user)
  }

  @Post('purchase-orders/:id/receive')
  receiveGoods(
    @Param('id') id: string,
    @Body() receiveDto: ReceiveGoodsDto,
    @CurrentUser() user: any,
  ) {
    return this.procurementService.receiveGoods(id, receiveDto, user)
  }
}