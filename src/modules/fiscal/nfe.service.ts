import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { CreateNfeDto } from './dto/create-nfe.dto'
import { Decimal } from '@prisma/client/runtime/library'

@Injectable()
export class NfeService {
  constructor(private prisma: PrismaService) {}

  async createDraft(dto: CreateNfeDto) {
    let customerId = dto.customer_id

    if (!customerId && dto.customer) {
      const { doc_type, document, name, email } = dto.customer
      const found = await this.prisma.customer.findFirst({
        where: { tenantId: dto.tenantId, companyId: dto.company_id, document },
      })
      const customer = found || await this.prisma.customer.create({
        data: { tenantId: dto.tenantId, companyId: dto.company_id, docType: doc_type as any, document, name, email }
      })
      customerId = customer.id
    }

    const totalProducts = dto.items.reduce(
      (acc, it) => acc + Number(it.qty) * Number(it.unit_price), 0
    )

    return this.prisma.nfe.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.company_id,
        customerId: customerId!,
        status: 'draft',
        totalProducts: new Decimal(totalProducts),
        totalTax: new Decimal(0),
        totalInvoice: new Decimal(totalProducts),
        items: {
          create: dto.items.map(it => ({
            description: it.description,
            cfop: it.cfop,
            ncm: it.ncm,
            qty: new Decimal(it.qty),
            unit: it.unit ?? 'UN',
            unitPrice: new Decimal(it.unit_price),
            total: new Decimal(Number(it.qty) * Number(it.unit_price)),
          })),
        },
      },
      include: { items: true, customer: true },
    })
  }

  submit(id: string) {
    return this.prisma.nfe.update({ where: { id }, data: { status: 'authorized', issuedAt: new Date() } })
  }

  list(status?: string) {
    return this.prisma.nfe.findMany({
      where: { status: status as any | undefined },
      orderBy: { createdAt: 'desc' },
      include: { items: true, customer: true },
      take: 50,
    })
  }

  get(id: string) {
    return this.prisma.nfe.findUnique({ where: { id }, include: { items: true, customer: true } })
  }
}
