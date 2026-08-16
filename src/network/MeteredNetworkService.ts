import { SignallingClient } from '@metered-ca/realtime';
import type { PlayerId } from '../types/game';
import type { NetworkService, NetworkMessage } from '../types/network';
import { normalizeRoomCode } from './roomCode';

/** Provider-specific channel namespace; not part of the public NetworkService API. */
const CHANNEL_PREFIX = 'police-raid/';

function getApiKey(): string {
  const key = import.meta.env.VITE_METERED_API_KEY;
  if (!key || typeof key !== 'string') {
    throw new Error(
      'Missing VITE_METERED_API_KEY. Set it in .env (see .env.example).',
    );
  }
  return key;
}

function isNetworkMessage(data: unknown): data is NetworkMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    typeof (data as NetworkMessage).type === 'string'
  );
}

/**
 * NetworkService implementation using Metered Realtime Messaging over `wss://rms.metered.ca`. 
 * Requires outbound internet and a publishable key (`pk_live_…`) 
 * with `publish`, `subscribe`, `presence`, and `send`, plus channel pattern `*` or `police-raid/*`. 
 * Game traffic is server-routed: room channel for presence / join, Metered
 * direct `send` for per-player state and client actions (so peers cannot read
 * each other's secrets on the channel).
 * Room = Metered channel `police-raid/{XXXX}`.
 * Metered assigns a transport `peerId`; the game seat id is issued by the host.
 */
export class MeteredNetworkService implements NetworkService {
  public isHost = false;
  public playerId: PlayerId | null = null;
  public roomCode: string | null = null;

  private client: SignallingClient | null = null;
  private channel: string | null = null;
  private knownPlayers = new Set<PlayerId>();

  private messageHandler: ((from: PlayerId, message: NetworkMessage) => void) | null = null;
  private connectionHandler: ((playerId: PlayerId) => void) | null = null;
  private disconnectHandler: ((playerId: PlayerId) => void) | null = null;

  private generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  private channelFor(roomCode: string): string {
    return `${CHANNEL_PREFIX}${roomCode}`;
  }

  private async connectToRoom(roomCode: string, asHost: boolean): Promise<PlayerId> {
    this.isHost = asHost;
    this.roomCode = roomCode;
    this.channel = this.channelFor(roomCode);
    this.knownPlayers.clear();

    const client = new SignallingClient({ apiKey: getApiKey() });
    this.client = client;

    client.on('message', ({ from, data }) => {
      this.dispatchMessage(from, data);
    });

    client.on('direct', ({ from, data }) => {
      this.dispatchMessage(from, data);
    });

    client.on('presence', ({ channel, joined, left }) => {
      if (channel !== this.channel) return;

      for (const peer of joined) {
        const id = peer.peerId as PlayerId;
        if (id === this.playerId) continue;
        if (this.knownPlayers.has(id)) continue;
        this.knownPlayers.add(id);
        this.connectionHandler?.(id);
      }

      for (const peer of left) {
        const id = peer.peerId as PlayerId;
        if (!this.knownPlayers.delete(id)) continue;
        this.disconnectHandler?.(id);
      }
    });

    const playerIdPromise = new Promise<PlayerId>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for network player id')),
        15_000,
      );
      // Metered names this `peerId`; we treat it as our `playerId`.
      client.once('connected', ({ peerId }) => {
        clearTimeout(timeout);
        resolve(peerId as PlayerId);
      });
    });

    await client.connect();
    this.playerId = await playerIdPromise;
    await client.subscribe(this.channel);
    return this.playerId;
  }

  private dispatchMessage(from: string, data: unknown) {
    if (!this.messageHandler) return;
    if (from === this.playerId) return;
    if (!isNetworkMessage(data)) return;
    const fromPlayerId = from as PlayerId;
    this.messageHandler(fromPlayerId, { ...data, senderId: data.senderId ?? fromPlayerId });
  }

  public initializeAsHost(): Promise<string> {
    const roomCode = this.generateRoomCode();
    return this.connectToRoom(roomCode, true).then(() => roomCode);
  }

  public initializeAsClient(roomCode: string): Promise<PlayerId> {
    return this.connectToRoom(normalizeRoomCode(roomCode), false);
  }

  public async disconnect(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.channel = null;
    this.playerId = null;
    this.roomCode = null;
    this.isHost = false;
    this.knownPlayers.clear();
    await client?.close();
  }

  public sendMessage(to: PlayerId, message: NetworkMessage): void {
    if (!this.client || !this.channel || !this.playerId) return;
    const enriched = { ...message, senderId: this.playerId };

    if (this.isHost) {
      void this.client.send(to, enriched);
      return;
    }

    // Prefer Metered direct `send` so other room subscribers cannot read
    // PLAYER_ACTION payloads (votes / raid picks). Fall back to channel publish
    // only when `to` is ourselves — enterRoom uses that before hostPeerId is known.
    if (to !== this.playerId) {
      void this.client.send(to, enriched);
      return;
    }
    void this.client.publish(this.channel, enriched);
  }

  public broadcast(message: NetworkMessage): void {
    if (!this.isHost || !this.client || !this.channel || !this.playerId) return;
    const enriched = { ...message, senderId: this.playerId };
    void this.client.publish(this.channel, enriched);
  }

  public onMessage(handler: (from: PlayerId, message: NetworkMessage) => void): void {
    this.messageHandler = handler;
  }

  public onConnection(handler: (playerId: PlayerId) => void): void {
    this.connectionHandler = handler;
  }

  public onDisconnect(handler: (playerId: PlayerId) => void): void {
    this.disconnectHandler = handler;
  }
}
