import { Module } from '@nestjs/common'
import { NfeImportService } from './nfe-import.service'
import { NfeImportController } from './nfe-import.controller'
import { PrismaModule } from '../../database/prisma.module'
import { ProcessHistoryModule } from '../process-history/process-history.module'

@Module({
  imports: [PrismaModule, ProcessHistoryModule],
  controllers: [NfeImportController],
  providers: [NfeImportService]
})
export class NfeImportModule {}
