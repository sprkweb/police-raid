import { Peer } from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { NetworkService, NetworkMessage } from '../types/network';

export class PeerNetworkService implements NetworkService {
  public isHost: boolean = false;
  public myId: string | null = null;
  private peer: Peer | null = null;

  private connections: Map<string, DataConnection> = new Map();

  private hostConnection: DataConnection | null = null;

  private messageHandler: ((from: string, message: NetworkMessage) => void) | null = null;
  private connectionHandler: ((id: string) => void) | null = null;
  private disconnectHandler: ((id: string) => void) | null = null;

  private generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  public initializeAsHost(): Promise<string> {
    this.isHost = true;
    return new Promise((resolve, reject) => {
      const roomCode = 'PR-' + this.generateRoomCode();
      this.peer = new Peer(roomCode);

      this.peer.on('open', (id) => {
        this.myId = id;
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        reject(err);
      });
    });
  }

  public initializeAsClient(roomId: string): Promise<string> {
    this.isHost = false;
    return new Promise((resolve, reject) => {
      this.peer = new Peer();

      this.peer.on('open', (id) => {
        this.myId = id;
        const conn = this.peer!.connect(roomId, { reliable: true });

        conn.on('open', () => {
          this.hostConnection = conn;
          this.setupConnection(conn);
          resolve(id);
        });

        conn.on('error', (err) => {
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        reject(err);
      });
    });
  }

  private setupConnection(conn: DataConnection) {
    if (this.isHost) {
      this.connections.set(conn.peer, conn);
      this.connectionHandler?.(conn.peer);
    }

    conn.on('data', (data: unknown) => {
      if (this.messageHandler) {
        this.messageHandler(conn.peer, data as NetworkMessage);
      }
    });

    conn.on('close', () => {
      if (this.isHost) {
        this.connections.delete(conn.peer);
        this.disconnectHandler?.(conn.peer);
      } else {
        this.hostConnection = null;
        this.disconnectHandler?.(conn.peer);
      }
    });
  }

  public sendMessage(to: string, message: NetworkMessage): void {
    const enrichedMessage = { ...message, senderId: this.myId };
    if (this.isHost) {
      const conn = this.connections.get(to);
      if (conn && conn.open) {
        conn.send(enrichedMessage);
      }
    } else {
      if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send(enrichedMessage);
      }
    }
  }

  public broadcast(message: NetworkMessage): void {
    if (!this.isHost) return;
    const enrichedMessage = { ...message, senderId: this.myId };
    this.connections.forEach(conn => {
      if (conn.open) {
        conn.send(enrichedMessage);
      }
    });
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
