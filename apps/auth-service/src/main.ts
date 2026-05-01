import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const port = process.env.AUTH_SERVICE_PORT ? parseInt(process.env.AUTH_SERVICE_PORT) : 3001;
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '127.0.0.1',
        port: port,
      },
    }
  );
  await app.listen();
  Logger.log(` Auth Microservice is running on TCP port: ${port}`);
}

bootstrap();
