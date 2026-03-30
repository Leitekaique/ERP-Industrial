import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto'

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async list(params: { tenantId: string; companyId: string; q?: string }) {
  const { tenantId, companyId, q } = params
    return this.prisma.customer.findMany({
      where: {
        tenantId,
        companyId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { document: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      document: true,
      docType: true,
      ie: true,
      email: true,
      phone: true,
      zip: true,
      address: true,
      number: true,
      district: true,
      city: true,
      state: true,
      emailFinanceiro: true,
      emailAdicional1: true,
      emailAdicional2: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

  async create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: dto })
  }

  async get(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } })
    if (!customer) throw new NotFoundException('Cliente não encontrado')
    return customer
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.get(id)
    return this.prisma.customer.update({ where: { id }, data: dto })
  }

  async remove(id: string) {
    await this.get(id)
    return this.prisma.customer.delete({ where: { id } })
  }
}
