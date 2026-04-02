export function getUserInitials(
  fullName: string | null | undefined,
  fallback = 'SR',
): string {
  const initials = (fullName ?? '')
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((token) => token.charAt(0).toUpperCase())
    .join('');

  return initials || fallback;
}
