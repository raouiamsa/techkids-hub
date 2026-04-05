import * as nodemailer from 'nodemailer';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private transporter?: nodemailer.Transporter;

    constructor() {
        const host = process.env.SMTP_HOST;

        if (host) {
            this.transporter = nodemailer.createTransport({
                host,
                port: parseInt(process.env.SMTP_PORT || '587'),
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
            this.logger.log(`📧  SMTP configuré : ${host}`);
        } else {
            this.logger.warn('⚠️  SMTP non configuré — OTPs affichés dans le terminal');
        }
    }

    async sendVerificationCode(email: string, code: string): Promise<void> {
        if (!this.transporter) {
            // Mode développement sans SMTP : affiche dans le terminal
            this.logger.log(`📧  [DEV] OTP pour ${email} : ${code}  (valable 15 min)`);
            return;
        }

        await this.transporter.sendMail({
            from: `"TechKids Hub" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to: email,
            subject: '🔐 Votre code de vérification TechKids',
            html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto;
                    padding: 32px; background: #f8f8ff; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #6366f1; margin: 0;">🚀 TechKids Hub</h2>
            <p style="color: #555; margin-top: 8px;">Vérification de votre adresse email</p>
          </div>

          <p style="color: #333;">Voici votre code de vérification :</p>

          <div style="font-size: 40px; font-weight: 900; letter-spacing: 12px;
                      text-align: center; padding: 20px;
                      background: #fff; border-radius: 12px;
                      border: 2px solid #6366f1; color: #6366f1;
                      margin: 20px 0; box-shadow: 0 4px 12px rgba(99,102,241,0.15);">
            ${code}
          </div>

          <p style="color: #666; font-size: 14px; text-align: center;">
            ⏱ Ce code expire dans <strong>15 minutes</strong>.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">

          <p style="color: #aaa; font-size: 12px; text-align: center;">
            Si vous n'avez pas créé de compte sur TechKids Hub, ignorez cet email.
          </p>
        </div>
      `,
        });

        this.logger.log(`📧  Email OTP envoyé à ${email}`);
    }
}
