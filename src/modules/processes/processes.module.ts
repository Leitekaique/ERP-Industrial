import { Module } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { ProcessesService } from './processes.service'
import { ProcessesController } from './processes.controller'

@Module({
  controllers: [ProcessesController],
  providers: [ProcessesService, PrismaService],
})
export class ProcessesModule {}
