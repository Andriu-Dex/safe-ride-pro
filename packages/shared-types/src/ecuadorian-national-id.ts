export function isValidEcuadorianNationalId(value: string): boolean {
  const normalizedValue = value.trim();

  if (!/^\d{10}$/.test(normalizedValue)) {
    return false;
  }

  const provinceCode = Number.parseInt(normalizedValue.slice(0, 2), 10);
  const thirdDigit = Number.parseInt(normalizedValue.charAt(2), 10);

  if (provinceCode < 1 || provinceCode > 24) {
    return false;
  }

  if (thirdDigit < 0 || thirdDigit > 5) {
    return false;
  }

  const verifierDigit = Number.parseInt(normalizedValue.charAt(9), 10);
  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];

  const total = coefficients.reduce((sum, coefficient, index) => {
    let product = Number.parseInt(normalizedValue.charAt(index), 10) * coefficient;

    if (product >= 10) {
      product -= 9;
    }

    return sum + product;
  }, 0);

  const computedVerifier = total % 10 === 0 ? 0 : 10 - (total % 10);

  return computedVerifier === verifierDigit;
}
