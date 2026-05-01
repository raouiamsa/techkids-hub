/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Active CORS pour le frontend Next.js (tous les origins en dev)
  app.enableCors({
    origin: true, // Autorise toutes les origines en développement
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Active la validation automatique des DTOs (class-validator)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // ─── Configuration Swagger ───────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('TechKids Hub API')
    .setDescription('API Gateway du projet TechKids Hub — PFE 2025')
    .setVersion('1.0')
    .addBearerAuth() // Permet de tester les routes protégées avec le token JWT
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document); // Accessible sur /api-docs
  // ─────────────────────────────────────────────────────────────────────────

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`API en ligne : http://localhost:${port}/${globalPrefix}`);
  Logger.log(`Swagger Docs : http://localhost:${port}/api-docs`);
}

bootstrap();
