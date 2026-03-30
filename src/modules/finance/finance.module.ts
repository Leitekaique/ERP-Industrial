import { Module } from '@nestjs/common'
import { ReceivablesController } from './receivables.controller'
import { ReceivablesService } from './receivables.service'
import { PrismaService } from '../../database/prisma.service'

@Module({
  controllers: [ReceivablesController],
  providers: [ReceivablesService, PrismaService],
  exports: [ReceivablesService],
})
export class FinanceModule {}