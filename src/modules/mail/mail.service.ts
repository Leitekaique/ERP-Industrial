import { Injectable, Logger } from '@nestjs/common'
import * as nodemailer from 'nodemailer'

// ─── Mail Service ─────────────────────────────────────────────────────────────
//
// Gateado por MAIL_ENABLED=true (deve ser false em dev).
// Em produção, configurar as variáveis SMTP_* no .env.
//
// Variáveis de ambiente:
//   MAIL_ENABLED=true          → habilita envio real
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=587
//   SMTP_USER=user@gmail.com
//   SMTP_PASS=senha_ou_app_password
//   SMTP_FROM=ERP Tapajós <noreply@tapajos.com.br>

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)

  private get enabled(): boolean {
    return process.env.MAIL_ENABLED === 'true'
  }

  private createTransport() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: {
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? '',
      },
    })
  }

  async sendMail(opts: {
    to: string | string[]
    subject: string
    html: string
    text?: string
    attachments?: { filename: string; content: Buffer; contentType: string }[]
  }): Promise<void> {
    if (!this.enabled) {
      const toList = Array.isArray(opts.to) ? opts.to.join(', ') : opts.to
      this.logger.log(`📧 [MAIL DESABILITADO] Para: ${toList} — Assunto: ${opts.subject}`)
      return
    }

    const from = process.env.SMTP_FROM ?? 'ERP Tapajós <noreply@tapajos.com.br>'
    try {
      const transporter = this.createTransport()
      const info = await transporter.sendMail({ from, ...opts })
      this.logger.log(`✅ E-mail enviado: ${info.messageId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`❌ Falha ao enviar e-mail: ${msg}`)
      // Não relança — falha de e-mail não deve derrubar o fluxo principal
    }
  }
}
