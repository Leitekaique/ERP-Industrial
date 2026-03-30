import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { CreateWarehouseDto } from './dto/create-warehouse.dto'

@Injectable()
export class WarehousesService {
  constructor(private prisma: PrismaService) {}

  list(tenantId: string, companyId: string) {
    return this.prisma.warehouse.findMany({
      where: { tenantId, companyId },
      orderBy: { createdAt: 'desc' },
    })
  }

  create(dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: dto })
  }
}
