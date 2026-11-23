import { Controller, Get } from '@nestjs/common'
import { Public } from '../auth/decorators/public.decorator'

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  get() {
    // version: tag da imagem (vX.Y.Z) — o script de atualização do cliente confere por aqui
    return { ok: true, version: process.env.APP_VERSION ?? 'dev', uptime: process.uptime(), timestamp: new Date().toISOString() }
  }

  @Public()
  @Get('config')
  config() {
    return { sefazEnv: process.env.SEFAZ_ENV ?? 'producao' }
  }
}
