/**
 * Inicialização do Sentry (monitoramento de erros).
 *
 * Este arquivo PRECISA ser importado antes de qualquer outro em main.ts:
 * o Sentry se "pendura" nos módulos do Node (http, express...) no momento
 * em que eles são carregados.
 *
 * Só liga se existir SENTRY_DSN no ambiente. Sem DSN, nada acontece e a API
 * funciona exatamente como antes.
 *
 * Privacidade (o repositório é público e o ERP guarda dados de clientes):
 *  - dataCollection (o antigo sendDefaultPii: false) → não coleta usuário,
 *    cookies, corpos, query string nem variáveis locais;
 *  - beforeSend remove corpo da requisição, query string, cookies e headers
 *    de autorização, e mascara CNPJ/CPF nas mensagens de erro;
 *  - breadcrumbs de console são descartados (os logs dos serviços podem
 *    citar clientes).
 */
import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import * as Sentry from '@sentry/nestjs'
import { maskDocuments, truncate } from './common/observability/sanitize'

function readVersion(): string | undefined {
  // dist/instrument.js → ../package.json  |  em último caso, a pasta atual
  for (const file of [path.resolve(__dirname, '..', 'package.json'), path.resolve(process.cwd(), 'package.json')]) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')).version
    } catch {
      /* tenta o próximo */
    }
  }
  return undefined
}

const dsn = process.env.SENTRY_DSN

if (dsn) {
  const version = readVersion()

  Sentry.init({
    dsn,
    environment: process.env.SEFAZ_ENV || process.env.NODE_ENV || 'development',
    release: version ? `erp-api@${version}` : undefined,
    // No Sentry 11, `sendDefaultPii: false` virou `dataCollection` (controle por categoria).
    // O padrão novo coleta MUITA coisa (corpos, headers e até variáveis locais
    // dos stack frames — que teriam dados de clientes). Desligamos tudo:
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ['user-agent', 'content-type'] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      graphQL: { document: false, variables: false },
    },
    // Só erros; sem monitoramento de desempenho (economiza a cota grátis).
    tracesSampleRate: 0,

    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'console') return null
      // Requisições que a API faz (SEFAZ, IBPT): mantém só o endereço, sem query string.
      if (breadcrumb.data?.url) breadcrumb.data.url = String(breadcrumb.data.url).split('?')[0]
      return breadcrumb
    },

    beforeSend(event) {
      if (event.request) {
        delete event.request.data
        delete event.request.cookies
        delete event.request.query_string
        if (event.request.url) event.request.url = event.request.url.split('?')[0]
        if (event.request.headers) {
          for (const h of Object.keys(event.request.headers)) {
            if (/^(authorization|cookie|set-cookie|x-api-key)$/i.test(h)) delete event.request.headers[h]
          }
        }
      }
      delete event.user

      if (event.message) event.message = truncate(maskDocuments(event.message))
      for (const ex of event.exception?.values ?? []) {
        if (!ex.value) continue
        // Erro do Prisma pode trazer a query inteira com dados de clientes.
        ex.value = ex.type?.startsWith('PrismaClient') ? '[mensagem do Prisma removida]' : truncate(maskDocuments(ex.value))
      }
      return event
    },
  })
}
