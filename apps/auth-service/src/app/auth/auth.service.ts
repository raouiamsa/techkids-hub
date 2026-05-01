import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { EmailService } from './email.service';
import { RpcException } from '@nestjs/microservices';

const prisma = new PrismaClient();

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        private emailService: EmailService,
    ) { }

    async register(email: string, password: string, firstName: string, lastName: string, role?: 'PARENT' | 'STUDENT') {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) throw new RpcException({ statusCode: 409, message: 'Email déjà utilisé', error: 'Conflict' });

        const passwordHash = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        const expires = new Date(Date.now() + 15 * 60 * 1000);

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                role: role ?? 'STUDENT',
                isEmailVerified: false,
                emailVerificationToken: otp,
                emailVerificationExpires: expires,
                profile: { create: { firstName, lastName } },
            },
        });

        await this.emailService.sendVerificationCode(email, otp);
        return { message: 'Compte créé. Vérifiez votre email.', email: user.email };
    }

    async verifyEmail(email: string, code: string) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw new RpcException({ statusCode: 400, message: 'Utilisateur introuvable', error: 'Bad Request' });
        if (user.isEmailVerified) throw new RpcException({ statusCode: 400, message: 'Email déjà vérifié', error: 'Bad Request' });

        if (
            user.emailVerificationToken !== code ||
            !user.emailVerificationExpires ||
            user.emailVerificationExpires < new Date()
        ) {
            throw new RpcException({ statusCode: 400, message: 'Code incorrect ou expiré', error: 'Bad Request' });
        }

        await prisma.user.update({
            where: { email },
            data: {
                isEmailVerified: true,
                emailVerificationToken: null,
                emailVerificationExpires: null,
            },
        });

        return { message: 'Email vérifié avec succès !' };
    }

    async resendVerification(email: string) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw new RpcException({ statusCode: 400, message: 'Utilisateur introuvable', error: 'Bad Request' });
        if (user.isEmailVerified) throw new RpcException({ statusCode: 400, message: 'Email déjà vérifié', error: 'Bad Request' });

        const otp = generateOTP();
        const expires = new Date(Date.now() + 15 * 60 * 1000);

        await prisma.user.update({
            where: { email },
            data: { emailVerificationToken: otp, emailVerificationExpires: expires },
        });

        await this.emailService.sendVerificationCode(email, otp);
        return { message: 'Nouveau code envoyé' };
    }

    async login(email: string, password: string) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw new RpcException({ statusCode: 401, message: 'Identifiants invalides', error: 'Unauthorized' });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) throw new RpcException({ statusCode: 401, message: 'Identifiants invalides', error: 'Unauthorized' });

        if (!user.isEmailVerified) {
            throw new RpcException({ statusCode: 401, message: 'Veuillez vérifier votre email avant de vous connecter', error: 'Unauthorized' });
        }

        const payload = { sub: user.id, email: user.email, role: user.role };
        return {
            access_token: this.jwtService.sign(payload),
            user: { id: user.id, email: user.email, role: user.role },
        };
    }
}
