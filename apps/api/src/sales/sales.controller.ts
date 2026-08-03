import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { SalesService } from './sales.service'
import { CurrentUser } from '../auth/current-user.decorator'
import { CreateSaleDto, PaySaleDto } from './dto/sales.dto'

@UseGuards(AuthGuard('jwt'))
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  listSales() {
    return this.salesService.listSales()
  }

  @Get(':id')
  getSale(@Param('id') id: string) {
    return this.salesService.getSale(id)
  }

  @Post()
  createSale(@Body() createDto: CreateSaleDto, @CurrentUser() user: any) {
    return this.salesService.createSale(createDto, user)
  }

  @Post(':id/pay')
  paySale(@Param('id') id: string, @Body() payDto: PaySaleDto, @CurrentUser() user: any) {
    return this.salesService.paySale(id, payDto, user)
  }

  @Post(':id/void')
  voidSale(@Param('id') id: string) {
    return this.salesService.voidSale(id)
  }
}