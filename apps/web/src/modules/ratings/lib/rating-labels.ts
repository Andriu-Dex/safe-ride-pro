export function getRatingStars(score: number): string {
  const normalizedScore = Math.max(0, Math.min(score, 5));
  const filledStars = '★'.repeat(normalizedScore);
  const emptyStars = '☆'.repeat(5 - normalizedScore);

  return `${filledStars}${emptyStars}`;
}
