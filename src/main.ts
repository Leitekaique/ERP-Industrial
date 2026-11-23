import 'dotenv/config'
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'
import { json, urlencoded } from 'express'
import { TenantCompanyInterceptor } from './common/interceptors/tenant-company.interceptor'


async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new TenantCompanyInterceptor());

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
  console.log(`[BOOT] API escutando em http://localhost:${port}`)
}
bootstrap()
