import { Global, Module } from '@nestjs/common'
import { MailService } from './mail.service'

// Global: qualquer módulo pode injetar MailService sem precisar importar MailModule
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
