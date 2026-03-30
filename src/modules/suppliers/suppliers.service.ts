import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto'

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async list(params: { tenantId: string, companyId: string, q?: string}) {
	const { tenantId, companyId, q } = params
		return this.prisma.supplier.findMany({
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

  async create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto })
  }

  async get(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } })
    if (!supplier) throw new NotFoundException('Fornecedor não encontrado')
    return supplier
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.get(id)
    return this.prisma.supplier.update({ where: { id }, data: dto })
  }

  async remove(id: string) {
    await this.get(id)
    return this.prisma.supplier.delete({ where: { id } })
  }
}