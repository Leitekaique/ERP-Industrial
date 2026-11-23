import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { safeErrorMessage } from './sanitize'

/** Marca colocada no `req` para o filtro de exceções saber que a linha já foi escrita. */
export const HTTP_LOGGED = Symbol('httpLogged')

/**
 * Registra UMA linha por requisição HTTP:
 *   método, rota, usuário, status, duração e (se der erro) a mensagem.
 *
 * O que NUNCA registramos: corpo da requisição, corpo da resposta, query
 * string e headers. Eles têm nomes de clientes, CNPJs, valores e o token JWT.
 *
 * A "rota" é o PADRÃO declarado no controller (ex.: /customers/:id), e não a
 * URL real. Assim nenhum valor digitado (CNPJ, chave de NF-e, termo de busca)
 * entra no log, e fica fácil agrupar ("quantos erros em /billing/:id?").
 */
@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle()

    const http = context.switchToHttp()
    const req = http.getRequest()
    const res = http.getResponse()
    const start = Date.now()

    return next.handle().pipe(
      tap(() => {
        logRequest(this.logger, req, res.statusCode, Date.now() - start)
      }),
      catchError((err) => {
        const status = err instanceof HttpException ? err.getStatus() : 500
        logRequest(this.logger, req, status, Date.now() - start, err)
        return throwError(() => err)
      }),
    )
  }
}

/**
 * Função compartilhada com o filtro de exceções, que usa para requisições
 * barradas ANTES do interceptor (ex.: 401 do JwtAuthGuard, 404 de rota inexistente).
 */
export function logRequest(logger: Logger, req: any, status: number, durationMs?: number, err?: unknown) {
  if (req[HTTP_LOGGED]) return
  req[HTTP_LOGGED] = true

  const entry: Record<string, unknown> = {
    method: req.method,
    route: routePattern(req),
    user: req.user?.email ?? null,
    status,
  }
  if (durationMs !== undefined) entry.durationMs = durationMs
  if (err) entry.error = safeErrorMessage(err)

  // Texto curto para o console + objeto estruturado que vira campos no JSON do arquivo.
  const summary = `${entry.method} ${entry.route} ${status}${durationMs !== undefined ? ` ${durationMs}ms` : ''}`

  if (status >= 500) logger.error({ message: summary, ...entry })
  else if (status >= 400) logger.warn({ message: summary, ...entry })
  else logger.log({ message: summary, ...entry })
}

function routePattern(req: any): string {
  // req.route só existe quando o Express encontrou a rota.
  if (req.route?.path) return `${req.baseUrl ?? ''}${req.route.path}`
  // Rota inexistente (404): usamos o caminho sem query string.
  // Trocamos sequências de dígitos por ":n" para não registrar CNPJ/chave por engano.
  const path = String(req.path ?? req.url ?? '').split('?')[0]
  return path.replace(/\d{3,}/g, ':n')
}
