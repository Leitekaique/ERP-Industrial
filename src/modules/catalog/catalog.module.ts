import { Module } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { CatalogController } from './catalog.controller'
import { CatalogService } from './catalog.service'

@Module({
  controllers: [CatalogController],
  providers: [PrismaService, CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
