import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import {
    RegisterDto,
    LoginDto,
    VerifyEmailDto,
    ResendVerificationDto,
    AUTH_PATTERNS,
} from '@org/shared-types';

@Controller()
export class AuthController {
    constructor(private authService: AuthService) { }

    @MessagePattern(AUTH_PATTERNS.REGISTER)
    register(@Payload() dto: RegisterDto) {
        return this.authService.register(dto.email, dto.password, dto.firstName, dto.lastName, dto.role);
    }

    @MessagePattern(AUTH_PATTERNS.VERIFY_EMAIL)
    verifyEmail(@Payload() dto: VerifyEmailDto) {
        return this.authService.verifyEmail(dto.email, dto.code);
    }

    @MessagePattern(AUTH_PATTERNS.RESEND_VERIFICATION)
    resendVerification(@Payload() dto: ResendVerificationDto) {
        return this.authService.resendVerification(dto.email);
    }

    @MessagePattern(AUTH_PATTERNS.LOGIN)
    login(@Payload() dto: LoginDto) {
        return this.authService.login(dto.email, dto.password);
    }
}
