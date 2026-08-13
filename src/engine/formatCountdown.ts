/** Format remaining milliseconds as `M:SS` (ceil to whole seconds). */
export function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Label for a deadline, or `null` when there is no active timer. */
export function countdownLabel(
  phaseEndsAt: number | null | undefined,
  now: number,
): string | null {
  if (phaseEndsAt == null) return null;
  return formatCountdown(phaseEndsAt - now);
}
