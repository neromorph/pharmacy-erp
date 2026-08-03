import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ProductsService } from './products.service'
import { CurrentUser } from '../auth/current-user.decorator'

@UseGuards(AuthGuard('jwt'))
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAll()
  }

  @Post()
  create(@Body() createDto: any, @CurrentUser() user: any) {
    return this.productsService.create(createDto, user)
  }
}