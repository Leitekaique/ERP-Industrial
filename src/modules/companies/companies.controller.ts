import { Controller, Get, Query } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Controller('companies')
export class CompaniesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list(@Query() q: any) {
    const { tenantId } = q

    return this.prisma.company.findMany({
      where: { tenantId },
      select: {
        id: true,
        tradeName: true,
        legalName: true,
        cnpj: true,
        ie: true,
        address: true,
        number: true,
        district: true,
        city: true,
        uf: true,
        zip: true,
        phone: true,
        cityCode: true,
        crt: true,
        icmsSnRate: true,
      },
      orderBy: { tradeName: 'asc' },
    })
  }
}
