import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class EmpresaOrigemService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        tradeName: true,
        legalName: true,
      },
    })

    const customers = await this.prisma.customer.findMany({
      where: { tenantId, companyId },
      select: {
        id: true,
        name: true,
      },
    })

    const suppliers = await this.prisma.supplier.findMany({
      where: { tenantId, companyId },
      select: {
        id: true,
        name: true,
      },
    })

    return [
      company && {
        id: company.id,
        name: company.tradeName ?? company.legalName,
        tipo: 'COMPANY',
      },
      ...customers.map(c => ({
        id: c.id,
        name: c.name,
        tipo: 'CUSTOMER',
      })),
      ...suppliers.map(s => ({
        id: s.id,
        name: s.name,
        tipo: 'SUPPLIER',
      })),
    ].filter(Boolean)
  }
}
