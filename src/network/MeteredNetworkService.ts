import { SignallingClient } from '@metered-ca/realtime';
import type { NetworkService, NetworkMessage } from '../types/network';

const CHANNEL_PREFIX = 'police-raid/';

function getApiKey(): string {
  const key = import.meta.env.VITE_METERED_API_KEY;
  if (!key || typeof key !== 'string') {
    throw new Error(
      'Missing VITE_METERED_API_KEY. Create a Metered Realtime publishable key (pk_live_…) and put it in .env',
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

export class MeteredNetworkService implements NetworkService {
  public isHost = false;
  public myId: string | null = null;
  /** Short lobby code (e.g. PR-ABCD), distinct from Metered peer id. */
  public roomId: string | null = null;

  private client: SignallingClient | null = null;
  private channel: string | null = null;
  private knownPeers = new Set<string>();

  private messageHandler: ((from: string, message: NetworkMessage) => void) | null = null;
  private connectionHandler: ((id: string) => void) | null = null;
  private disconnectHandler: ((id: string) => void) | null = null;

  private generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  private channelFor(roomCode: string): string {
    return `${CHANNEL_PREFIX}${roomCode}`;
  }

  private async connectToRoom(roomCode: string, asHost: boolean): Promise<string> {
    this.isHost = asHost;
    this.roomId = roomCode;
    this.channel = this.channelFor(roomCode);
    this.knownPeers.clear();

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
        if (peer.peerId === this.myId) continue;
        if (this.knownPeers.has(peer.peerId)) continue;
        this.knownPeers.add(peer.peerId);
        this.connectionHandler?.(peer.peerId);
      }

      for (const peer of left) {
        if (!this.knownPeers.delete(peer.peerId)) continue;
        this.disconnectHandler?.(peer.peerId);
      }
    });

    const peerIdPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for Metered peerId')),
        15_000,
      );
      client.once('connected', ({ peerId }) => {
        clearTimeout(timeout);
        resolve(peerId);
      });
    });

    await client.connect();
    this.myId = await peerIdPromise;
    await client.subscribe(this.channel);
    return this.myId;
  }

  private dispatchMessage(from: string, data: unknown) {
    if (!this.messageHandler) return;
    if (from === this.myId) return;
    if (!isNetworkMessage(data)) return;
    this.messageHandler(from, { ...data, senderId: data.senderId ?? from });
  }

  public initializeAsHost(): Promise<string> {
    const roomCode = `PR-${this.generateRoomCode()}`;
    return this.connectToRoom(roomCode, true).then(() => roomCode);
  }

  public initializeAsClient(roomId: string): Promise<string> {
    const normalized = roomId.trim().toUpperCase();
    return this.connectToRoom(normalized, false);
  }

  public sendMessage(to: string, message: NetworkMessage): void {
    if (!this.client || !this.channel || !this.myId) return;
    const enriched = { ...message, senderId: this.myId };

    if (this.isHost) {
      void this.client.send(to, enriched);
      return;
    }

    // Clients publish on the room channel; the host handles game actions.
    // `to` is ignored (same as the previous PeerJS client path).
    void this.client.publish(this.channel, enriched);
  }

  public broadcast(message: NetworkMessage): void {
    if (!this.isHost || !this.client || !this.channel || !this.myId) return;
    const enriched = { ...message, senderId: this.myId };
    void this.client.publish(this.channel, enriched);
  }

  public onMessage(handler: (from: string, message: NetworkMessage) => void): void {
    this.messageHandler = handler;
  }

  public onConnection(handler: (id: string) => void): void {
    this.connectionHandler = handler;
  }

  public onDisconnect(handler: (id: string) => void): void {
    this.disconnectHandler = handler;
  }
}
