import { Injectable, NestMiddleware } from '@nestjs/common'

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: any, _res: any, next: () => void) {
    req.tenantId = 'T-001'
    req.companyId = 'C-001'
    next()
  }
}
