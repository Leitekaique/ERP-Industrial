import { LoggerService } from '@nestjs/common'
import { WinstonModule, utilities as nestWinstonUtils } from 'nest-winston'
import * as winston from 'winston'
// Importar o pacote registra winston.transports.DailyRotateFile
import 'winston-daily-rotate-file'

/**
 * Logger da aplicação (substitui o logger padrão do Nest em main.ts).
 *
 * Duas saídas ("transports"):
 *  1. Console: formato colorido e legível, igual ao do Nest. É o que aparece
 *     em `docker logs erp_api`.
 *  2. Arquivo: um JSON por linha, um arquivo por dia, em LOG_DIR
 *     (padrão ./logs → no container /usr/src/app/logs, que é um volume:
 *     no PC do cliente fica em C:\ERP-Deploy\logs).
 *     Arquivos de dias anteriores são compactados (.gz) e apagados após 30 dias.
 *
 * Por que JSON no arquivo? Dá para filtrar com ferramentas (jq, Select-String)
 * e cada linha é independente: um arquivo cortado no meio não estraga o resto.
 *
 * Variáveis de ambiente:
 *  - LOG_DIR   pasta dos arquivos (padrão ./logs)
 *  - LOG_LEVEL nível mínimo: error | warn | info | debug (padrão info)
 */
export function createAppLogger(): LoggerService {
  const level = process.env.LOG_LEVEL || 'info'
  const dirname = process.env.LOG_DIR || './logs'

  // O nest-winston sempre acrescenta `stack: [trace]` no logger.error, mesmo
  // quando não há stack. Este formato remove o `"stack":[null]` vazio.
  const dropEmptyStack = winston.format((info) => {
    if (Array.isArray(info.stack) && info.stack.every((s) => s == null)) delete info.stack
    return info
  })

  return WinstonModule.createLogger({
    level,
    format: dropEmptyStack(),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          nestWinstonUtils.format.nestLike('ERP', { colors: true, prettyPrint: false }),
        ),
      }),
      new winston.transports.DailyRotateFile({
        dirname,
        filename: 'api-%DATE%.log', // ex.: api-2026-11-23.log
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxFiles: '30d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
      }),
    ],
  })
}
