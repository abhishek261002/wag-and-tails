import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { ABSOLUTE_MAX_BYTES } from './files/upload-rules.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';
import { isAllowedOrigin, parseAllowedOrigins } from './common/cors.js';
import * as path from 'path';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true }
  );

  // Without this, FilesController's `req.file()` is always undefined —
  // every upload (pet avatars, documents, etc.) silently "succeeds" with
  // no file ever saved, since the handler just falls through its
  // no-file branch rather than throwing.
  // The default per-file limit is the server's 1 MiB body limit, which silently cut off any photo larger than
  // that. The real limits (per kind) are enforced in FilesController; this one only has to be high enough not
  // to truncate a valid upload.
  await app.register(fastifyMultipart as any, {
    limits: { fileSize: ABSOLUTE_MAX_BYTES, files: 1, fields: 10, parts: 20 },
  });

  // FilesService (local storage provider) writes uploads to disk and hands
  // back a "/uploads/<file>" URL, but nothing was ever registered to
  // actually serve that path — uploads "succeeded" yet every resulting URL
  // 404'd when an <Image>/<img> tried to load it. Served at the bare
  // "/uploads" prefix (not under the api/v1 prefix below, since that only
  // applies to controller routes) to match the URLs FilesService returns.
  const localUploadPath = process.env['STORAGE_LOCAL_PATH'] ?? './uploads';
  await app.register(fastifyStatic as any, {
    root: path.resolve(process.cwd(), localUploadPath),
    prefix: '/uploads/',
    // Uploads are user content: never let a browser guess a type for them.
    setHeaders: (res: any) => { res.setHeader('X-Content-Type-Options', 'nosniff'); },
  });

  // Bad ids and missing records become 400 / 404, not a bare 500.
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS
  // In dev, requests come from wherever Metro/Expo happens to be serving —
  // a localhost port that changes run to run, a LAN IP when testing on a
  // physical device via Expo Go, a tunnel URL, etc. Reflecting the request's
  // own Origin back (rather than pattern-matching or listing specific hosts)
  // allows literally anything without needing to predict the origin ahead
  // of time. Production still uses an explicit, fixed CORS_ORIGINS list.
  // CORS Configuration
  const isDev = process.env['NODE_ENV'] !== 'production';
  
  // Clean up trailing slashes from environment origins
  const rawOrigins = process.env['CORS_ORIGINS'] ?? 'http://localhost:8081,http://localhost:8082,http://localhost:3002,http://localhost:3003,http://localhost:3004';
  const allowedOrigins = parseAllowedOrigins(rawOrigins);

  // Enable CORS with full method support & wildcard origin resolution for dev
  // Enable CORS with full method support
  app.enableCors({
    origin: (origin, cb) => {
      // Allow requests with no origin or any origin in development
      if (!origin || isDev) {
        return cb(null, true);
      }
      if (isAllowedOrigin(origin, allowedOrigins)) {
        return cb(null, true);
      }
      // No CORS headers: the browser blocks the response. (An Error here would turn into a 500.)
      cb(null, false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-HTTP-Method-Override',
    ],
    credentials: true,
    optionsSuccessStatus: 204,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  // Swagger
  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Wag & Tails API')
      .setDescription('Pet grooming, walking & products platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger docs available at /api/docs');
  }

  const port = parseInt(process.env['API_PORT'] ?? '3001', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`🐾 Wag & Tails API running on http://localhost:${port}/api/v1`);
}

bootstrap();
