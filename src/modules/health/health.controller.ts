import { Controller, Get } from '@nestjs/common'
import { Public } from '../auth/decorators/public.decorator'

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  get() {
    return { ok: true, uptime: process.uptime(), timestamp: new Date().toISOString() }
  }

  @Public()
  @Get('config')
  config() {
    return { sefazEnv: process.env.SEFAZ_ENV ?? 'producao' }
  }
}
