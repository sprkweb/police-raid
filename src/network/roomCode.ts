/** Normalize user input: trim, uppercase. */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase()
}
