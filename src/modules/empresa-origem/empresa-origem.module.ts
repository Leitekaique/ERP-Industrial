import { Module } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { EmpresaOrigemController } from './empresa-origem.controller'
import { EmpresaOrigemService } from './empresa-origem.service'

@Module({
  controllers: [EmpresaOrigemController],
  providers: [EmpresaOrigemService, PrismaService],
})
export class EmpresaOrigemModule {}
