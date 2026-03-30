import { Module } from '@nestjs/common'
import { ProductsController } from './products.controller'
import { ProductsService } from './products.service'
import { PrismaService } from '../../database/prisma.service'
import { ProcessHistoryModule } from '../process-history/process-history.module'

@Module({
  imports: [ProcessHistoryModule],
  controllers: [ProductsController],
  providers: [PrismaService, ProductsService],
})
export class ProductsModule {}