import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CoursesController } from './courses.controller';
import { EnrollmentsController } from './enrollments.controller';
import { ProgressionController } from './progression.controller';

@Module({
  imports: [
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
  controllers: [
    CoursesController,
    EnrollmentsController,
    ProgressionController,
  ],
  exports: [ClientsModule],
})
export class EduTrackerModule { }

