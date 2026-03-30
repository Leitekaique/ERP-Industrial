// src/modules/catalog/catalog.service.ts
import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, companyId: string, ownerType?: string) {
    if (!tenantId || !companyId) {
      throw new BadRequestException('tenantId e companyId são obrigatórios.')
    }

    return this.prisma.catalogProduct.findMany({
      where: {
        tenantId,
        companyId,
        ...(ownerType ? { ownerType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createProduct(dto: any) {
    if (!dto.sku) {
      // 🔹 Garante que o campo obrigatório seja informado
      throw new BadRequestException('O campo SKU é obrigatório para criar o produto.')
    }

    return this.prisma.catalogProduct.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        sku: dto.sku, // ✅ campo obrigatório
        name: dto.name,
        code: dto.code ?? null,
        description: dto.description ?? null,
        ownerType: dto.ownerType ?? 'internal',
        unit: dto.unit ?? 'UN',
        price: dto.price ?? 0,
        ncm: dto.ncm ?? null,
        cfop: dto.cfop ?? null,
      },
    })
  }

  async getProduct(id: string) {
    return this.prisma.catalogProduct.findUnique({
      where: { id },
    })
  }

  async updateProduct(id: string, dto: any) {
    return this.prisma.catalogProduct.update({
      where: { id },
      data: {
        sku: dto.sku,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        ownerType: dto.ownerType,
        unit: dto.unit,
        price: dto.price,
        ncm: dto.ncm,
        cfop: dto.cfop,
      },
    })
  }
}
