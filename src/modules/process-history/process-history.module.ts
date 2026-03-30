import { Module } from '@nestjs/common'
import { ProcessHistoryService } from './process-history.service'
import { PrismaService } from '../../database/prisma.service'

@Module({
  providers: [ProcessHistoryService, PrismaService],
  exports: [ProcessHistoryService],
})
export class ProcessHistoryModule {}
