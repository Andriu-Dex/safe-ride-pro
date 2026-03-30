import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

import { EnvironmentService } from '../../../../shared/infrastructure/config/environment.service';
import {
  AuthEmailDeliveryChannel,
  AuthEmailService,
  SendPasswordResetCodeEmailInput,
  SendVerificationCodeEmailInput,
} from '../../application/ports/auth-email.service';

@Injectable()
export class SmtpAuthEmailService implements AuthEmailService {
  private readonly logger = new Logger(SmtpAuthEmailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly environmentService: EnvironmentService) {}

  async sendVerificationCodeEmail(
    input: SendVerificationCodeEmailInput,
  ): Promise<AuthEmailDeliveryChannel> {
    return this.sendEmail({
      to: input.email,
      subject: 'Verifica tu correo en SafeRidePro',
      html: this.buildVerificationEmailHtml(input.fullName, input.code, input.expiresInMinutes),
      text: this.buildVerificationEmailText(input.code, input.expiresInMinutes),
      developmentLogLabel: 'verification',
      developmentCode: input.code,
    });
  }

  async sendPasswordResetCodeEmail(
    input: SendPasswordResetCodeEmailInput,
  ): Promise<AuthEmailDeliveryChannel> {
    return this.sendEmail({
      to: input.email,
      subject: 'Restablece tu contrasena en SafeRidePro',
      html: this.buildPasswordResetEmailHtml(input.fullName, input.code, input.expiresInMinutes),
      text: this.buildPasswordResetEmailText(input.code, input.expiresInMinutes),
      developmentLogLabel: 'password-reset',
      developmentCode: input.code,
    });
  }

  private async sendEmail(input: {
    to: string;
    subject: string;
    html: string;
    text: string;
    developmentLogLabel: string;
    developmentCode: string;
  }): Promise<AuthEmailDeliveryChannel> {
    const smtpHost = this.environmentService.smtpHost;
    const smtpUser = this.environmentService.smtpUser ?? this.environmentService.smtpFromEmail;
    const smtpPassword = this.environmentService.smtpPassword;
    const fromEmail = this.environmentService.smtpFromEmail;

    if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
      this.logger.warn(
        `SMTP is not configured. Using development preview for ${input.developmentLogLabel} email to ${input.to}. Code: ${input.developmentCode}`,
      );

      return 'development_preview';
    }

    const transporter = this.getTransporter();

    await transporter.sendMail({
      from: `${this.environmentService.smtpFromName} <${fromEmail}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    return 'email';
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const smtpUser = this.environmentService.smtpUser ?? this.environmentService.smtpFromEmail;

    this.transporter = nodemailer.createTransport({
      host: this.environmentService.smtpHost ?? undefined,
      port: this.environmentService.smtpPort,
      secure: this.environmentService.smtpSecure,
      auth:
        smtpUser && this.environmentService.smtpPassword
          ? {
              user: smtpUser,
              pass: this.environmentService.smtpPassword,
            }
          : undefined,
    });

    return this.transporter;
  }

  private buildVerificationEmailHtml(
    fullName: string,
    code: string,
    expiresInMinutes: number,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; background: #071c1d; padding: 32px 20px; color: #eafdf8;">
        <div style="max-width: 560px; margin: 0 auto; border-radius: 24px; overflow: hidden; background: linear-gradient(180deg, rgba(14, 55, 57, 0.96), rgba(7, 28, 29, 0.98)); border: 1px solid rgba(102, 217, 202, 0.24); box-shadow: 0 18px 42px rgba(0, 0, 0, 0.32);">
          <div style="padding: 28px 28px 20px; background: radial-gradient(circle at top left, rgba(102, 217, 202, 0.22), transparent 46%);">
            <p style="margin: 0 0 10px; color: #89efdd; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;">Verificacion de cuenta</p>
            <h1 style="margin: 0; font-size: 30px; line-height: 1.08; color: #ffffff;">Activa tu cuenta en SafeRidePro</h1>
            <p style="margin: 16px 0 0; color: #c7ebe5; line-height: 1.7;">Hola, ${fullName}. Usa este codigo para verificar tu correo institucional y habilitar tu acceso.</p>
          </div>
          <div style="padding: 0 28px 28px;">
            <div style="margin-top: 8px; border-radius: 22px; padding: 22px 20px; background: linear-gradient(135deg, rgba(19, 183, 170, 0.2), rgba(243, 255, 251, 0.08)); border: 1px solid rgba(155, 247, 223, 0.24); text-align: center;">
              <p style="margin: 0 0 12px; color: #a7f3e4; font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;">Codigo de verificacion</p>
              <p style="margin: 0; color: #ffffff; font-size: 38px; font-weight: 800; letter-spacing: 10px;">${code}</p>
            </div>
            <p style="margin: 18px 0 0; color: #c7ebe5; line-height: 1.65;">Este codigo estara disponible durante ${expiresInMinutes} minutos. Si no solicitaste este registro, puedes ignorar este mensaje.</p>
          </div>
        </div>
      </div>
    `;
  }

  private buildVerificationEmailText(code: string, expiresInMinutes: number): string {
    return `Tu codigo de verificacion de SafeRidePro es ${code}. Expira en ${expiresInMinutes} minutos.`;
  }

  private buildPasswordResetEmailHtml(
    fullName: string,
    code: string,
    expiresInMinutes: number,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; background: #071c1d; padding: 32px 20px; color: #eafdf8;">
        <div style="max-width: 560px; margin: 0 auto; border-radius: 24px; overflow: hidden; background: linear-gradient(180deg, rgba(14, 55, 57, 0.96), rgba(7, 28, 29, 0.98)); border: 1px solid rgba(102, 217, 202, 0.24); box-shadow: 0 18px 42px rgba(0, 0, 0, 0.32);">
          <div style="padding: 28px 28px 20px; background: radial-gradient(circle at top left, rgba(102, 217, 202, 0.22), transparent 46%);">
            <p style="margin: 0 0 10px; color: #89efdd; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;">Recuperacion de acceso</p>
            <h1 style="margin: 0; font-size: 30px; line-height: 1.08; color: #ffffff;">Restablece tu contraseña</h1>
            <p style="margin: 16px 0 0; color: #c7ebe5; line-height: 1.7;">Hola, ${fullName}. Usa este codigo para definir una nueva contraseña en SafeRidePro.</p>
          </div>
          <div style="padding: 0 28px 28px;">
            <div style="margin-top: 8px; border-radius: 22px; padding: 22px 20px; background: linear-gradient(135deg, rgba(19, 183, 170, 0.2), rgba(243, 255, 251, 0.08)); border: 1px solid rgba(155, 247, 223, 0.24); text-align: center;">
              <p style="margin: 0 0 12px; color: #a7f3e4; font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;">Codigo de recuperacion</p>
              <p style="margin: 0; color: #ffffff; font-size: 38px; font-weight: 800; letter-spacing: 10px;">${code}</p>
            </div>
            <p style="margin: 18px 0 0; color: #c7ebe5; line-height: 1.65;">Este codigo estara disponible durante ${expiresInMinutes} minutos. Si no solicitaste el cambio, puedes ignorar este mensaje.</p>
          </div>
        </div>
      </div>
    `;
  }

  private buildPasswordResetEmailText(code: string, expiresInMinutes: number): string {
    return `Tu codigo para restablecer la contrasena en SafeRidePro es ${code}. Expira en ${expiresInMinutes} minutos.`;
  }
}
