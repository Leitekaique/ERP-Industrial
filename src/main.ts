// O Sentry precisa ser o PRIMEIRO import (ver src/instrument.ts). Ele também carrega o .env.
import './instrument'
import 'reflect-metadata';
import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { Logger, ValidationPipe } from '@nestjs/common'
import { json, urlencoded } from 'express'
import { TenantCompanyInterceptor } from './common/interceptors/tenant-company.interceptor'
import { createAppLogger } from './common/observability/logger'
import { HttpLoggingInterceptor } from './common/observability/http-logging.interceptor'
import { AllExceptionsFilter } from './common/observability/all-exceptions.filter'


async function bootstrap() {
  // logger: troca o logger padrão do Nest pelo winston (console + arquivo diário em LOG_DIR).
  // Todo `new Logger(...)` / `this.logger.log/warn/error` dos serviços passa a ir para o arquivo.
  const app = await NestFactory.create(AppModule, { logger: createAppLogger() })

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // HttpLoggingInterceptor vem primeiro para medir a duração da requisição inteira.
  app.useGlobalInterceptors(new HttpLoggingInterceptor(), new TenantCompanyInterceptor());
  // Filtro global: registra erros, manda 5xx ao Sentry e responde como o Nest responderia.
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter))

  // CORS: dev (Vite :5173) + prod (nginx :80) + rede local
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost',
      'http://localhost:80',
      /^http:\/\/192\.168\.\d+\.\d+$/,   // acesso via rede local
    ],
    credentials: false,
  })
  app.use(json({ limit: '10mb' }))
  app.use(urlencoded({ extended: true, limit: '10mb' }))

  // ... o resto do seu bootstrap (prefix, pipes, etc)
  const port = process.env.PORT || 3000
  await app.listen(port)
  new Logger('Bootstrap').log(
    `API escutando em http://localhost:${port} (Sentry ${process.env.SENTRY_DSN ? 'ativo' : 'desligado'})`,
  )
}
bootstrap()
