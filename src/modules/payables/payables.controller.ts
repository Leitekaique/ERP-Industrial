import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { PayablesService } from './payables.service'
import { CreatePayableDto } from './dto/create-payable.dto'
import { CreatePayablePaymentDto } from './dto/create-payment.dto'

@Controller('payables')
export class PayablesController {
  constructor(private readonly service: PayablesService) {}

  @Get()
  list(
    @Query('tenantId') tenantId: string,
    @Query('companyId') companyId: string,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('category') category?: string,
  ) {
    return this.service.list({ tenantId, companyId, status, supplierId, from, to, category })
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  create(@Body() dto: CreatePayableDto) {
    return this.service.create(dto)
  }

  @Post(':id/payments')
  addPayment(@Param('id') id: string, @Body() dto: CreatePayablePaymentDto) {
    return this.service.addPayment(id, dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreatePayableDto>) {
    return this.service.update(id, dto)
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id)
  }

  @Get('meta/categories')
  getCategories(@Query('companyId') companyId: string) {
    return this.service.getCategories(companyId)
  }

  @Post('meta/categories')
  addCategory(@Query('companyId') companyId: string, @Body() body: { name: string }) {
    return this.service.addCategory(companyId, body.name)
  }

  @Delete('meta/categories/:name')
  removeCategory(@Query('companyId') companyId: string, @Param('name') name: string) {
    return this.service.removeCategory(companyId, decodeURIComponent(name))
  }
}
