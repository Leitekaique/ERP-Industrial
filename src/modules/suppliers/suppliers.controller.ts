import { Controller, Get, Delete, Patch, Post, Query, Body, Param, NotFoundException} from '@nestjs/common'
import { SuppliersService } from './suppliers.service'
import { UpdateSupplierDto, CreateSupplierDto} from './dto/supplier.dto'

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly svc: SuppliersService) {}

  @Get()
  async list(@Query('tenantId') tenantId: string,
    @Query('companyId') companyId: string,
    @Query('q') q?: string) {
		return this.svc.list({tenantId, companyId, q});
  }

  @Get(':id')
  async get(@Param('id') id: string) {
	  return this.svc.get(id)
  }
  
  @Post()
  async create(@Body() dto: CreateSupplierDto) {
    return this.svc.create(dto)
  }
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.svc.update(id, dto)
  }
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.svc.remove(id)
  }
}
