import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { WarehousesService } from './warehouses.service'
import { CreateWarehouseDto } from './dto/create-warehouse.dto'

@Controller('inventory/warehouses')
export class WarehousesController {
  constructor(private readonly svc: WarehousesService) {}

  @Get()
  list(@Query('tenantId') tenantId: string, @Query('companyId') companyId: string) {
    return this.svc.list(tenantId, companyId)
  }

  @Post()
  create(@Body() body: CreateWarehouseDto) {
    return this.svc.create(body)
  }
}
