import { normalizeRoomCode } from './roomCode';

export function roomCodeFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const raw = params.get('room');
  if (!raw) return null;
  const code = normalizeRoomCode(raw);
  return code.length > 0 ? code : null;
}

export function roomCodeFromLocation(loc: Pick<Location, 'search'> = window.location): string | null {
  return roomCodeFromSearch(loc.search);
}

export function urlWithRoom(href: string, roomCode: string): string {
  const url = new URL(href);
  url.searchParams.set('room', normalizeRoomCode(roomCode));
  return url.toString();
}

export function urlWithoutRoom(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('room');
  return url.toString();
}

export function syncRoomUrl(roomCode: string): void {
  const next = urlWithRoom(window.location.href, roomCode);
  if (next !== window.location.href) {
    window.history.replaceState(window.history.state, '', next);
  }
}

export function clearRoomUrl(): void {
  const next = urlWithoutRoom(window.location.href);
  if (next !== window.location.href) {
    window.history.replaceState(window.history.state, '', next);
  }
}
