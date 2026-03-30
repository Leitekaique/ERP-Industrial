import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { SuppliersService } from './suppliers.service'
import { CreateSupplierDto } from './dto/create-supplier.dto'
import { UpdateSupplierDto } from './dto/update-supplier.dto'

@Controller('payables/suppliers')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Get()
  list(@Query('tenantId') tenantId?: string, @Query('companyId') companyId?: string, @Query('q') q?: string) {
    return this.service.list(tenantId, companyId, q)
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  create(@Body() dto: CreateSupplierDto) {
    return this.service.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
