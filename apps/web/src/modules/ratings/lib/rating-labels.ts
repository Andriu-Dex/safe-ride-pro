export function getRatingStars(score: number): string {
  const filledStars = '★'.repeat(Math.max(0, Math.min(score, 5)));
  const emptyStars = '☆'.repeat(Math.max(0, 5 - score));

  return `${filledStars}${emptyStars}`;
}
