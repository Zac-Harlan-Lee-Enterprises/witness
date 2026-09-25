/** Player-facing wording for the chapter's hour counter (never a countdown timer). */
export function timeOfDayLabel(hour: number): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h < 5) return 'Night';
  if (h < 9) return 'Early morning';
  if (h < 11) return 'Morning';
  if (h < 13) return 'Midday';
  if (h < 16) return 'Afternoon';
  if (h < 18) return 'Late afternoon';
  if (h < 19) return 'Sunset';
  return 'Night';
}
