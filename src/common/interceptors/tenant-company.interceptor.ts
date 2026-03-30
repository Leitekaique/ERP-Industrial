import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { DEFAULT_TENANT_ID, DEFAULT_COMPANY_ID } from '../constants/tenant-company.constants'

@Injectable()
export class TenantCompanyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest()

    // Se o usuário está autenticado (JWT validado pelo JwtAuthGuard),
    // usamos os IDs do token. Caso contrário, fallback para os defaults.
    const tenantId = req.user?.tenantId ?? DEFAULT_TENANT_ID
    const companyId = req.user?.companyId ?? DEFAULT_COMPANY_ID

    req.body = { tenantId, companyId, ...req.body }
    req.query = { tenantId, companyId, ...req.query }

    return next.handle()
  }
}
