import type { PvpClientMessage, PvpPublicRoomState, PvpRoomSummary, PvpServerMessage } from './PvpTypes';

type StateListener = (state: PvpPublicRoomState) => void;
type ErrorListener = (message: string) => void;
type ConnectionListener = (connected: boolean) => void;
type RoomListListener = (rooms: PvpRoomSummary[]) => void;

export class PvpClient {
  private socket?: WebSocket;
  private stateListeners = new Set<StateListener>();
  private errorListeners = new Set<ErrorListener>();
  private connectionListeners = new Set<ConnectionListener>();
  private roomListListeners = new Set<RoomListListener>();

  clientId?: string;
  currentState?: PvpPublicRoomState;
  roomList: PvpRoomSummary[] = [];

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(url: string): Promise<void> {
    this.disconnect();

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.addEventListener('open', () => {
        this.emitConnection(true);
        resolve();
      }, { once: true });

      socket.addEventListener('error', () => {
        const message = '无法连接 PvP 服务器。';
        this.emitError(message);
        reject(new Error(message));
      }, { once: true });

      socket.addEventListener('close', () => {
        if (this.socket === socket) {
          this.socket = undefined;
        }
        this.roomList = [];
        this.emitRoomList();
        this.emitConnection(false);
      });

      socket.addEventListener('message', (event) => {
        this.handleMessage(String(event.data));
      });
    });
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = undefined;
  }

  createRoom(playerName: string): void {
    this.send({ type: 'create-room', playerName });
  }

  joinRoom(roomId: string, playerName: string): void {
    this.send({ type: 'join-room', roomId, playerName });
  }

  requestRoomList(): void {
    this.send({ type: 'list-rooms' });
  }

  ready(): void {
    this.send({ type: 'ready' });
  }

  rematch(): void {
    this.send({ type: 'rematch' });
  }

  surrender(): void {
    this.send({ type: 'surrender' });
  }

  draw(): void {
    this.send({ type: 'draw' });
  }

  stand(): void {
    this.send({ type: 'stand' });
  }

  useSkill(skillId: string, targetId?: string): void {
    this.send({ type: 'use-skill', skillId, targetId });
  }

  useItem(itemId: string, targetId?: string): void {
    this.send({ type: 'use-item', itemId, targetId });
  }

  onState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    if (this.currentState) {
      listener(this.currentState);
    }
    return () => this.stateListeners.delete(listener);
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  onConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.connected);
    return () => this.connectionListeners.delete(listener);
  }

  onRoomList(listener: RoomListListener): () => void {
    this.roomListListeners.add(listener);
    listener(this.roomList);
    return () => this.roomListListeners.delete(listener);
  }

  private send(message: PvpClientMessage): void {
    if (!this.connected || !this.socket) {
      this.emitError('尚未连接 PvP 服务器。');
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  private handleMessage(raw: string): void {
    let message: PvpServerMessage;
    try {
      message = JSON.parse(raw) as PvpServerMessage;
    } catch {
      this.emitError('服务器消息格式错误。');
      return;
    }

    if (message.type === 'connected') {
      this.clientId = message.clientId;
      return;
    }

    if (message.type === 'room-state') {
      this.currentState = message.state;
      this.stateListeners.forEach((listener) => listener(message.state));
      return;
    }

    if (message.type === 'room-list') {
      this.roomList = message.rooms;
      this.emitRoomList();
      return;
    }

    if (message.type === 'error') {
      this.emitError(message.message);
    }
  }

  private emitError(message: string): void {
    this.errorListeners.forEach((listener) => listener(message));
  }

  private emitConnection(connected: boolean): void {
    this.connectionListeners.forEach((listener) => listener(connected));
  }

  private emitRoomList(): void {
    this.roomListListeners.forEach((listener) => listener(this.roomList));
  }
}

export const pvpClient = new PvpClient();
