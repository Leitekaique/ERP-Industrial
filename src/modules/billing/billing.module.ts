import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { BillingService } from './billing.service'
import { BillingController } from './billing.controller'
import { BillingCronService } from './billing-cron.service'
import { PrismaService } from '../../database/prisma.service'

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [BillingController],
  providers: [BillingService, BillingCronService, PrismaService],
  exports: [BillingService],
})
export class BillingModule {}
