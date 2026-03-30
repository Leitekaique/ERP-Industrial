import { Module } from '@nestjs/common'
import { NfeController } from './nfe.controller'
import { NfeService } from './nfe.service'
import { PrismaService } from '../../database/prisma.service'

@Module({
  controllers: [NfeController],
  providers: [NfeService, PrismaService],
  exports: [NfeService],
})
export class NfeModule {}