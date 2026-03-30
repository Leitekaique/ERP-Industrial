import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { PrismaModule } from './database/prisma.module'
import { HealthModule } from './modules/health/health.module'
import { NfeModule } from './modules/fiscal/nfe.module'
import { EmpresaOrigemModule } from './modules/empresa-origem/empresa-origem.module'
import { FinanceModule } from './modules/finance/finance.module'
import { PayablesModule } from './modules/payables/payables.module'
import { ProductsModule } from './modules/products/products.module'
import { ProcessesModule } from './modules/processes/processes.module'
import { CompaniesModule } from './modules/companies/companies.module'
import { CustomersModule } from './modules/customers/customers.module'
import { NfeEmitModule } from './modules/nfe-emit/nfe-emit.module'
import { NfeImportModule } from './modules/nfe-import/nfe-import.module'
import { SuppliersModule } from './modules/suppliers/suppliers.module'
import { StockModule } from './modules/inventory/stock.module'
import { TransporterModule } from './modules/transporter/transporter.module'
import { AuthModule } from './modules/auth/auth.module'
import { MailModule } from './modules/mail/mail.module'
import { BillingModule } from './modules/billing/billing.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { TenantMiddleware } from './middleware/tenant.middleware'
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard'
import { RolesGuard } from './modules/auth/guards/roles.guard'

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HealthModule,
    NfeModule,
    EmpresaOrigemModule,
    FinanceModule,
    PayablesModule,
    CompaniesModule,
    CustomersModule,
    ProductsModule,
    ProcessesModule,
    NfeEmitModule,
    NfeImportModule,
    SuppliersModule,
    StockModule,
    TransporterModule,
    MailModule,
    BillingModule,
    DashboardModule,
  ],
  providers: [
    // APP_GUARD registra os guards globalmente — todas as rotas passam por eles
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*')
  }
}
