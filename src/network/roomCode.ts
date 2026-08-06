/** Normalize user input: trim, uppercase, drop legacy "PR-" prefix if present. */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/^PR-/, '');
}
