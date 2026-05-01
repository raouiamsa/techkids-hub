import { Module } from '@nestjs/common';
import { AuthModule as SharedAuthModule } from '@org/auth';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';

@Module({
    imports: [SharedAuthModule],
    controllers: [AuthController],
    providers: [AuthService, EmailService],
})
export class AuthModule { }
