import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @Get()
  async list(
    @Query('tenantId') tenantId: string,
    @Query('companyId') companyId: string,
    @Query('ownerType') ownerType?: string,
  ) {
    return this.service.list(tenantId, companyId, ownerType);
  }

  @Post()
  async create(@Body() dto: any) {
    return this.service.createProduct(dto);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.service.getProduct(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.service.updateProduct(id, dto);
  }
}
