import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule as LocalAuthModule } from './auth/auth.module';
import { EduTrackerModule } from './edu-tracker/edu-tracker.module';
import { AuthModule as SharedAuthModule } from '@org/auth';
import { ParentModule } from './parent/parent.module';
import { AiController } from './ai/ai.controller';
import { AiGateway } from './ai/ai.gateway';
import { MessagingModule } from '@org/messaging';

@Module({
  imports: [
    HttpModule,
    LocalAuthModule,
    EduTrackerModule,
    SharedAuthModule,
    ParentModule,
    MessagingModule,   // ← Enregistre RABBITMQ_CLIENT pour AiController
  ],
  controllers: [AppController, AiController],
  providers: [AppService, AiGateway],
})
export class AppModule { }

