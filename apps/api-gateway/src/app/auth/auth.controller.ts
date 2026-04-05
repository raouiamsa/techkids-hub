import { Controller, Post, Body } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import {
    RegisterDto,
    LoginDto,
    VerifyEmailDto,
    ResendVerificationDto,
    AUTH_PATTERNS,
} from '@org/shared-types';
import { throwRpcError } from '../shared/rpc-error.helper';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(@Inject('AUTH_SERVICE') private client: ClientProxy) { }

    @ApiOperation({ summary: 'Créer un compte' })
    @Post('register')
    async register(@Body() dto: RegisterDto) {
        try {
            return await firstValueFrom(this.client.send(AUTH_PATTERNS.REGISTER, dto));
        } catch (e) { throwRpcError(e); }
    }

    @ApiOperation({ summary: 'Vérifier le code email' })
    @Post('verify-email')
    async verifyEmail(@Body() dto: VerifyEmailDto) {
        try {
            return await firstValueFrom(this.client.send(AUTH_PATTERNS.VERIFY_EMAIL, dto));
        } catch (e) { throwRpcError(e); }
    }

    @ApiOperation({ summary: 'Renvoyer le code de vérification' })
    @Post('resend-verification')
    async resendVerification(@Body() dto: ResendVerificationDto) {
        try {
            return await firstValueFrom(this.client.send(AUTH_PATTERNS.RESEND_VERIFICATION, dto));
        } catch (e) { throwRpcError(e); }
    }

    @ApiOperation({ summary: 'Se connecter' })
    @Post('login')
    async login(@Body() dto: LoginDto) {
        try {
            return await firstValueFrom(this.client.send(AUTH_PATTERNS.LOGIN, dto));
        } catch (e) { throwRpcError(e); }
    }
}
