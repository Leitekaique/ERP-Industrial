import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { CreateSupplierDto } from './dto/create-supplier.dto'
import { UpdateSupplierDto } from './dto/update-supplier.dto'

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  list(tenantId?: string, companyId?: string, q?: string) {
    return this.prisma.supplier.findMany({
      where: {
        tenantId: tenantId || undefined,
        companyId: companyId || undefined,
        OR: q ? [
          { name: { contains: q, mode: 'insensitive' } },
          { document: { contains: q, mode: 'insensitive' } },
        ] : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  get(id: string) {
    return this.prisma.supplier.findUnique({ where: { id } })
  }

  async create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        docType: dto.docType as any,
        document: dto.document,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
      },
    })
  }

  async update(id: string, dto: UpdateSupplierDto) {
    return this.prisma.supplier.update({
      where: { id },
      data: { ...dto },
    })
  }

  async remove(id: string) {
    // remoção definitiva; se preferir, troque por "soft delete" (ex.: flag is_active)
    return this.prisma.supplier.delete({ where: { id } })
  }
}
