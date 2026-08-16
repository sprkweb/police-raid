import { describe, expect, it } from 'vitest';
import { roomCodeFromSearch, urlWithRoom, urlWithoutRoom } from '../roomUrl';

describe('roomUrl', () => {
  it('reads a room code from the query string', () => {
    expect(roomCodeFromSearch('?room=ab12')).toBe('AB12');
    expect(roomCodeFromSearch('room=zz')).toBe('ZZ');
    expect(roomCodeFromSearch('?foo=1')).toBeNull();
    expect(roomCodeFromSearch('?room=')).toBeNull();
  });

  it('writes and clears the room query param without dropping other params', () => {
    const href = 'https://example.test/play?lang=en#hash';
    const withRoom = urlWithRoom(href, 'ab12');
    expect(withRoom).toContain('room=AB12');
    expect(withRoom).toContain('lang=en');
    expect(withRoom).toContain('#hash');
    expect(urlWithoutRoom(withRoom)).not.toContain('room=');
    expect(urlWithoutRoom(withRoom)).toContain('lang=en');
  });
});
