import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common'
import { ReceivablesService } from './receivables.service'
import { CreateReceivableDto } from './dto/create-receivable.dto'
import { CreatePaymentDto } from './dto/create-payment.dto'

@Controller('finance/receivables')
export class ReceivablesController {
  constructor(private readonly service: ReceivablesService) {}

  @Get()
  list(
    @Query('tenantId') tenantId: string,
    @Query('companyId') companyId: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.list({ tenantId, companyId, status, from, to })
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const rec = await this.service.findOne(id)
    if (!rec) throw new NotFoundException()
    return rec
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id)
  }

  @Post()
  create(@Body() dto: CreateReceivableDto) {
    return this.service.create(dto)
  }

  @Post(':id/payments')
  createPayment(@Param('id') id: string, @Body() dto: CreatePaymentDto) {
    return this.service.createPayment(id, dto)
  }

  @Get(':id/payments')
  async getPayments(@Param('id') id: string) {
    return this.service.listPayments(id);
  }
}
