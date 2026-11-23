import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import * as Sentry from '@sentry/nestjs'
import { logRequest } from './http-logging.interceptor'

/**
 * Filtro global de exceções.
 *
 * 1. Envia ao Sentry os erros que viram resposta 5xx (erro do servidor):
 *    exceções não tratadas (TypeError, erro do Prisma...) e
 *    InternalServerErrorException/BadGatewayException lançadas pelo código.
 *    Erros 4xx (validação, 401, 404) são "esperados" e não vão para o Sentry,
 *    senão o painel enche de ruído.
 *    Sem SENTRY_DSN o Sentry não foi iniciado e captureException não faz nada.
 *
 * 2. Garante a linha de log para requisições que falharam ANTES de chegar ao
 *    interceptor (guards, rota inexistente).
 *
 * 3. Depois devolve a resposta exatamente como o Nest faria (BaseExceptionFilter),
 *    então o frontend não percebe diferença nenhuma.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('HTTP')

  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500

    if (status >= 500) {
      Sentry.captureException(exception)
    }

    if (host.getType() === 'http') {
      logRequest(this.logger, host.switchToHttp().getRequest(), status, undefined, exception)
    }

    super.catch(exception, host)
  }
}
