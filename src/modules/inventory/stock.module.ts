import { Module } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { StockController } from './stock.controller'
import { StockService } from './stock.service'
import { ProcessHistoryModule } from '../process-history/process-history.module'

@Module({
  controllers: [StockController],
  imports: [ProcessHistoryModule],
  providers: [StockService, PrismaService],
  exports: [StockService],
})
export class StockModule {}
