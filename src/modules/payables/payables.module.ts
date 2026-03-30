import { Module } from '@nestjs/common'
import { SuppliersController } from './suppliers.controller'
import { SuppliersService } from './suppliers.service'
import { PayablesController } from './payables.controller'
import { PayablesService } from './payables.service'
import { PrismaService } from '../../database/prisma.service'

@Module({
  controllers: [SuppliersController, PayablesController],
  providers: [SuppliersService, PayablesService, PrismaService],
  exports: [SuppliersService, PayablesService],
})
export class PayablesModule {}
