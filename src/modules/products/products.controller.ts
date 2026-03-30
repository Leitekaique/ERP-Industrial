import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Body,
} from '@nestjs/common'
import { ProductsService } from './products.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'

@Controller('products')
export class ProductsController {
  constructor(private svc: ProductsService) {}

  @Get()
  list(
    @Query('tenantId') tenantId = 'T-001',
    @Query('companyId') companyId = 'C-001',
    @Query('q') q?: string,
  ) {
    return this.svc.list({ tenantId, companyId, q })
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.findOne(id)
  }

  @Post()
  create(
    @Query('tenantId') tenantId = 'T-001',
    @Query('companyId') companyId = 'C-001',
    @Body() body: CreateProductDto,
  ) {
    return this.svc.create(tenantId, companyId, body)
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
  ) {
    return this.svc.update(id, body)
  }
  @Delete(':id')
	remove(@Param('id') id: string) {
	return this.svc.remove(id)
	}
}
