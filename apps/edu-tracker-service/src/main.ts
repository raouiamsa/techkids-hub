import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0', // Listen on all interfaces
        port: Number(process.env.EDU_SERVICE_PORT) || 3002, // Edu-Tracker exclusively uses 3002
      },
    }
  );
  await app.listen();
  console.log(' Edu-Tracker Microservice is listening on TCP port 3002');
}

bootstrap();
