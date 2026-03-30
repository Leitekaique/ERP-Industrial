import { Body, Controller, Get, NotFoundException, Param, Post, Query, Res } from '@nestjs/common'
import { Response } from 'express'
import { BillingService } from './billing.service'
import { Public } from '../auth/decorators/public.decorator'

@Controller('billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  // GET /billing?status=open&customerId=...&year=2025&month=3
  @Get()
  list(
    @Query('tenantId') tenantId: string,
    @Query('companyId') companyId: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.service.list({
      tenantId, companyId, status, customerId,
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
    })
  }

  // POST /billing/generate
  // Body: { customerId, month, year }
  @Post('generate')
  generate(
    @Query('tenantId') tenantId: string,
    @Query('companyId') companyId: string,
    @Body() body: { customerId: string; month: number; year: number },
  ) {
    return this.service.generateBilling({
      tenantId, companyId,
      customerId: body.customerId,
      month: Number(body.month),
      year: Number(body.year),
    })
  }

  // GET /billing/:id/pdf
  @Public()
  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.service.getBillingPdf(id)
    if (!buffer) throw new NotFoundException()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="duplicata-${id}.pdf"`)
    res.send(buffer)
  }

  // POST /billing/:id/send
  @Post(':id/send')
  send(@Param('id') id: string) {
    return this.service.sendBilling(id)
  }

  // POST /billing/:id/paid
  @Post(':id/paid')
  paid(@Param('id') id: string) {
    return this.service.markPaid(id)
  }

  // POST /billing/:id/receive — baixa todos os recebíveis da fatura de uma vez
  @Post(':id/receive')
  receive(@Param('id') id: string, @Body() dto: { paidAt?: string; method?: string; note?: string }) {
    return this.service.receiveFull(id, dto)
  }

  // POST /billing/:id/cancel
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id)
  }

  // GET /billing/unbilled-receivables — recebíveis em aberto sem fatura gerada
  @Get('unbilled-receivables')
  unbilledReceivables(
    @Query('tenantId') tenantId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.service.getUnbilledReceivables(tenantId, companyId)
  }

  // POST /billing/check-overdue — acionamento manual (útil para testes)
  @Post('check-overdue')
  checkOverdue() {
    return this.service.checkOverdue()
  }
}
