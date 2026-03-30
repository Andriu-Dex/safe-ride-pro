export const PASSWORD_RESET_CODE_LENGTH = 6;

export function generatePasswordResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
