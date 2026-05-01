import { Module } from '@nestjs/common';
import { ParentController } from './parent.controller';
import { DatabaseModule } from '@org/database';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    DatabaseModule,
    ClientsModule.register([
      {
        name: 'EDU_SERVICE',
        transport: Transport.TCP,
        options: {
          host: '127.0.0.1',
          port: Number(process.env.EDU_SERVICE_PORT) || 3002,
        },
      },
    ]),
  ],
  controllers: [ParentController],
})
export class ParentModule {}
