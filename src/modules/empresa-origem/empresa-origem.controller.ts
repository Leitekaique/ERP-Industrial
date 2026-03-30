import { Controller, Get, Query } from '@nestjs/common'
import { EmpresaOrigemService } from './empresa-origem.service'

@Controller('empresas-origem')
export class EmpresaOrigemController {
  constructor(private readonly service: EmpresaOrigemService) {}

  @Get()
  list(
    @Query('tenantId') tenantId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.service.list( tenantId, companyId )
  }
}
