import { Controller, Get, Query } from '@nestjs/common'
import { DashboardService } from './dashboard.service'

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  // GET /dashboard/summary?tenantId=T-001&companyId=C-001&mes=3&ano=2026
  @Get('summary')
  getSummary(
    @Query('tenantId') tenantId: string,
    @Query('companyId') companyId: string,
    @Query('mes') mes?: string,
    @Query('ano') ano?: string,
  ) {
    return this.service.getSummary(
      tenantId,
      companyId,
      mes ? Number(mes) : undefined,
      ano ? Number(ano) : undefined,
    )
  }
}
