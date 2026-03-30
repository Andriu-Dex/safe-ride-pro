const ECUADORIAN_MOBILE_PHONE_PATTERN = /^09\d{8}$/;

export function isValidEcuadorianMobilePhone(phone: string): boolean {
  return ECUADORIAN_MOBILE_PHONE_PATTERN.test(phone.trim());
}
