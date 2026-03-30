import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { DEFAULT_TENANT_ID, DEFAULT_COMPANY_ID } from '../common/constants/tenant-company.constants';


@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async createWithDefaults<T extends keyof PrismaClient>(
    model: T,
    data: any
  ): Promise<any> {
    const prismaModel = (this as any)[model];
    if (!prismaModel?.create) {
      throw new Error(`Modelo Prisma '${String(model)}' não encontrado.`);
    }

    return prismaModel.create({
      data: {
        tenantId: data.tenantId ?? DEFAULT_TENANT_ID,
        companyId: data.companyId ?? DEFAULT_COMPANY_ID,
        ...data,
      },
    });
  }
}