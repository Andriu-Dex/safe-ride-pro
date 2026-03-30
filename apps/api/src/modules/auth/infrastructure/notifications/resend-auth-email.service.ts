import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from '../../../../shared/infrastructure/config/environment.service';
import {
  AuthEmailDeliveryChannel,
  AuthEmailService,
  SendPasswordResetCodeEmailInput,
  SendVerificationCodeEmailInput,
} from '../../application/ports/auth-email.service';

@Injectable()
export class ResendAuthEmailService implements AuthEmailService {
  private readonly logger = new Logger(ResendAuthEmailService.name);

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
    const apiKey = this.environmentService.resendApiKey;
    const fromEmail = this.environmentService.resendFromEmail;

    if (!apiKey || !fromEmail) {
      this.logger.warn(
        `Resend is not configured. Using development preview for ${input.developmentLogLabel} email to ${input.to}. Code: ${input.developmentCode}`,
      );

      return 'development_preview';
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${this.environmentService.resendFromName} <${fromEmail}>`,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      this.logger.error(`Resend email delivery failed: ${errorBody}`);
      throw new Error('No fue posible enviar el correo transaccional.');
    }

    return 'email';
  }

  private buildVerificationEmailHtml(
    fullName: string,
    code: string,
    expiresInMinutes: number,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #172033;">
        <h1 style="margin-bottom: 16px;">Verifica tu correo en SafeRidePro</h1>
        <p>Hola, ${fullName}.</p>
        <p>Tu codigo de verificacion es:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${code}</p>
        <p>Este codigo estara disponible durante ${expiresInMinutes} minutos.</p>
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
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #172033;">
        <h1 style="margin-bottom: 16px;">Restablece tu contrasena</h1>
        <p>Hola, ${fullName}.</p>
        <p>Tu codigo para restablecer la contrasena es:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${code}</p>
        <p>Este codigo estara disponible durante ${expiresInMinutes} minutos.</p>
      </div>
    `;
  }

  private buildPasswordResetEmailText(code: string, expiresInMinutes: number): string {
    return `Tu codigo para restablecer la contrasena en SafeRidePro es ${code}. Expira en ${expiresInMinutes} minutos.`;
  }
}
