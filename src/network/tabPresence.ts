import { normalizeRoomCode } from './roomCode';
import type { StorageLike } from './seatSession';

export const TAB_ID_KEY = 'police-raid.tabId';
export const CLAIM_STORAGE_PREFIX = 'police-raid.seatClaim.';
export const JOIN_LOCK_PREFIX = 'police-raid.joinLock.';
export const TAB_CHANNEL_NAME = 'police-raid.tabs';

const JOIN_LOCK_TTL_MS = 8_000;
const JOIN_ELECT_MS = 100;

export interface SeatClaim {
  roomCode: string;
  seatId: string;
  tabId: string;
}

export interface ClaimBus {
  post: (claim: SeatClaim) => void;
  listen: (handler: (claim: SeatClaim) => void) => () => void;
}

function defaultLocalStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function defaultSessionStorage(): StorageLike | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

let memoryTabId: string | null = null;
let sharedBus: ClaimBus | null | undefined;

function newTabId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function getTabId(store: StorageLike | null = defaultSessionStorage()): string {
  if (store) {
    try {
      const existing = store.getItem(TAB_ID_KEY);
      if (existing) return existing;
      const id = newTabId();
      store.setItem(TAB_ID_KEY, id);
      return id;
    } catch {
      // fall through to process memory
    }
  }
  if (!memoryTabId) memoryTabId = newTabId();
  return memoryTabId;
}

export function claimTakesOverSeat(
  incoming: SeatClaim,
  current: { roomCode: string; seatId: string; tabId: string },
): boolean {
  return (
    incoming.tabId !== current.tabId &&
    incoming.seatId === current.seatId &&
    normalizeRoomCode(incoming.roomCode) === normalizeRoomCode(current.roomCode)
  );
}

export function isSeatClaim(value: unknown): value is SeatClaim {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as SeatClaim;
  return (
    typeof v.roomCode === 'string' &&
    typeof v.seatId === 'string' &&
    typeof v.tabId === 'string' &&
    v.roomCode.length > 0 &&
    v.seatId.length > 0 &&
    v.tabId.length > 0
  );
}

export function claimStorageKey(roomCode: string): string {
  return `${CLAIM_STORAGE_PREFIX}${normalizeRoomCode(roomCode)}`;
}

function joinLockKey(roomCode: string): string {
  return `${JOIN_LOCK_PREFIX}${normalizeRoomCode(roomCode)}`;
}

export function createBroadcastClaimBus(name = TAB_CHANNEL_NAME): ClaimBus | null {
  try {
    if (typeof BroadcastChannel === 'undefined') return null;
    const channel = new BroadcastChannel(name);
    return {
      post: (claim) => {
        channel.postMessage(claim);
      },
      listen: (handler) => {
        const onMessage = (event: MessageEvent) => {
          if (isSeatClaim(event.data)) handler(event.data);
        };
        channel.addEventListener('message', onMessage);
        return () => {
          channel.removeEventListener('message', onMessage);
        };
      },
    };
  } catch {
    return null;
  }
}

function defaultClaimBus(): ClaimBus | null {
  if (sharedBus !== undefined) return sharedBus;
  sharedBus = createBroadcastClaimBus();
  return sharedBus;
}

export function announceSeatClaim(
  claim: SeatClaim,
  options: { storage?: StorageLike | null; bus?: ClaimBus | null } = {},
): void {
  const normalized: SeatClaim = {
    roomCode: normalizeRoomCode(claim.roomCode),
    seatId: claim.seatId,
    tabId: claim.tabId,
  };
  const storage = options.storage === undefined ? defaultLocalStorage() : options.storage;
  if (storage) {
    try {
      storage.setItem(claimStorageKey(normalized.roomCode), JSON.stringify(normalized));
    } catch {
      // ignore
    }
  }
  const bus = options.bus === undefined ? defaultClaimBus() : options.bus;
  bus?.post(normalized);
}

export function subscribeSeatClaims(
  handler: (claim: SeatClaim) => void,
  options: { storage?: StorageLike | null; bus?: ClaimBus | null } = {},
): () => void {
  const bus = options.bus === undefined ? defaultClaimBus() : options.bus;
  const unsubBus = bus?.listen(handler);

  const storage = options.storage === undefined ? defaultLocalStorage() : options.storage;
  const onStorage = (event: StorageEvent) => {
    if (!event.key || !event.key.startsWith(CLAIM_STORAGE_PREFIX) || !event.newValue) return;
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      if (isSeatClaim(parsed)) handler(parsed);
    } catch {
      // ignore
    }
  };
  if (storage && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  return () => {
    unsubBus?.();
    if (storage && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Same-browser join race: two tabs without a seat session would otherwise each
 * send JOIN_REQUEST and occupy two seats. Write a lock, wait, re-read — the
 * last writer is the leader and may JOIN_REQUEST; the other waits to reclaim.
 */
export async function electJoinLeader(options: {
  roomCode: string;
  tabId: string;
  storage?: StorageLike | null;
  delayMs?: number;
  ttlMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<'leader' | 'follower'> {
  const storage = options.storage === undefined ? defaultLocalStorage() : options.storage;
  if (!storage) return 'leader';

  const key = joinLockKey(options.roomCode);
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? JOIN_LOCK_TTL_MS;
  const sleep = options.sleep ?? delay;
  const waitMs = options.delayMs ?? JOIN_ELECT_MS;

  try {
    const raw = storage.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof (parsed as { tabId?: unknown }).tabId === 'string' &&
        typeof (parsed as { ts?: unknown }).ts === 'number'
      ) {
        const lock = parsed as { tabId: string; ts: number };
        if (lock.tabId !== options.tabId && now() - lock.ts < ttlMs) {
          return 'follower';
        }
      }
    }
    storage.setItem(key, JSON.stringify({ tabId: options.tabId, ts: now() }));
  } catch {
    return 'leader';
  }

  await sleep(waitMs);

  try {
    const raw = storage.getItem(key);
    if (!raw) return 'leader';
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { tabId?: unknown }).tabId === 'string'
    ) {
      return (parsed as { tabId: string }).tabId === options.tabId ? 'leader' : 'follower';
    }
  } catch {
    return 'leader';
  }
  return 'leader';
}
