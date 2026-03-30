export const AUTH_EMAIL_SERVICE = Symbol('AUTH_EMAIL_SERVICE');

export type AuthEmailDeliveryChannel = 'email' | 'development_preview';

export type SendVerificationCodeEmailInput = {
  email: string;
  fullName: string;
  code: string;
  expiresInMinutes: number;
};

export type SendPasswordResetCodeEmailInput = {
  email: string;
  fullName: string;
  code: string;
  expiresInMinutes: number;
};

export interface AuthEmailService {
  sendVerificationCodeEmail(
    input: SendVerificationCodeEmailInput,
  ): Promise<AuthEmailDeliveryChannel>;
  sendPasswordResetCodeEmail(
    input: SendPasswordResetCodeEmailInput,
  ): Promise<AuthEmailDeliveryChannel>;
}
