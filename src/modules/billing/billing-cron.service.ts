import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { BillingService } from './billing.service'

// ─── Billing Cron Service ─────────────────────────────────────────────────────
// Executa verificações agendadas relacionadas ao faturamento.
// Os cron jobs só rodam dentro do container (ambiente NestJS com ScheduleModule).

@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name)

  constructor(private billingService: BillingService) {}

  // Roda todo dia às 8h da manhã
  // CronExpression.EVERY_DAY_AT_8AM = '0 8 * * *'
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleDailyOverdueCheck() {
    this.logger.log('⏰ Cron: verificação diária de vencidos iniciada')
    try {
      await this.billingService.checkOverdue()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`❌ Cron falhou: ${msg}`)
    }
  }
}
