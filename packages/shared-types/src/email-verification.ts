export const EMAIL_VERIFICATION_CODE_LENGTH = 6;

export function generateEmailVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
