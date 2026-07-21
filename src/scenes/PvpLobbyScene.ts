import Phaser from 'phaser';
import { playLobbyMusic, preloadLobbyMusic } from '../game/audio';
import { t } from '../game/i18n';
import { pvpClient } from '../game/pvp/PvpClient';
import type { PvpPublicRoomState, PvpRoomSummary } from '../game/pvp/PvpTypes';

const COLORS = {
  bg: 0x101114,
  panel: 0x1b1d22,
  panelAlt: 0x252832,
  line: 0x3b3f4c,
  text: '#f2f2ed',
  muted: '#aeb4c0',
  accent: 0xe8cf73,
  accentText: '#e8cf73',
  green: '#78d18a',
  dangerText: '#ff4b5f',
  button: 0x303542,
  buttonHover: 0x41495b,
};

type FieldKey = 'serverUrl' | 'playerName' | 'roomId';

export class PvpLobbyScene extends Phaser.Scene {
  private fields: Record<FieldKey, string> = {
    serverUrl: 'ws://localhost:8787',
    playerName: '玩家',
    roomId: '',
  };
  private activeField: FieldKey = 'playerName';
  private connected = false;
  private status = '';
  private roomState?: PvpPublicRoomState;
  private roomList: PvpRoomSummary[] = [];
  private unsubscribers: Array<() => void> = [];
  private suppressBattleAutoOpen = false;
  private autoConnectStarted = false;

  constructor() {
    super('PvpLobbyScene');
  }

  init(data?: { suppressBattleAutoOpen?: boolean }): void {
    this.suppressBattleAutoOpen = data?.suppressBattleAutoOpen ?? false;
  }

  preload(): void {
    preloadLobbyMusic(this);
    if (!this.cache.audio.exists('buttonClick')) {
      this.load.audio('buttonClick', '/audio/switch28.ogg');
    }
  }

  create(): void {
    playLobbyMusic(this);
    this.connected = pvpClient.connected;
    this.roomState = pvpClient.currentState;
    this.roomList = pvpClient.roomList;
    this.status = this.connected ? t('pvp.connected') : t('pvp.disconnected');
    this.unsubscribers = [
      pvpClient.onConnection((connected) => {
        this.connected = connected;
        this.status = connected ? t('pvp.connected') : t('pvp.disconnected');
        if (connected) {
          pvpClient.requestRoomList();
        }
        this.render();
      }),
      pvpClient.onRoomList((rooms) => {
        this.roomList = rooms;
        this.render();
      }),
      pvpClient.onState((state) => {
        this.roomState = state;
        this.fields.roomId = state.roomId;
        if (!this.suppressBattleAutoOpen && state.phase !== 'waiting') {
          this.scene.start('PvpBattleScene');
          return;
        }
        this.render();
      }),
      pvpClient.onError((message) => {
        this.status = message;
        this.render();
      }),
    ];
    this.autoConnect();
    this.input.keyboard?.on('keydown', this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.handleKeyDown, this);
      this.unsubscribers.forEach((unsubscribe) => unsubscribe());
      this.unsubscribers = [];
    });
    this.render();
  }

  private render(): void {
    this.children.removeAll(true);
    this.addBackground();
    this.renderHeader();
    this.renderForm();
    this.renderRoomPanel();
    this.renderRoomListPanel();
  }

  private addBackground(): void {
    this.add.rectangle(640, 360, 1280, 720, COLORS.bg);
    this.add.circle(640, 360, 292, 0x191c22, 0.9).setStrokeStyle(2, COLORS.line);
    this.add.circle(640, 360, 188, 0x101114, 0.45).setStrokeStyle(1, 0x2b303c);
    this.add.rectangle(640, 360, 1280, 1, COLORS.line, 0.22);
  }

  private renderHeader(): void {
    this.add.text(640, 74, t('pvp.title'), {
      fontFamily: 'Arial',
      fontSize: '46px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accentText, 10, true, true);

    this.add.text(640, 122, t('pvp.subtitle'), {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: COLORS.muted,
    }).setOrigin(0.5);

    this.button(110, 50, 178, 44, t('pvp.returnLobby'), () => {
      this.scene.start('StartScene');
    }, '16px');
  }

  private renderForm(): void {
    const panel = this.add.container(330, 385);
    panel.add(this.add.rectangle(0, 0, 500, 420, COLORS.panel, 0.96).setStrokeStyle(2, COLORS.line));
    panel.add(this.add.text(-210, -174, t('pvp.connection'), {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: COLORS.text,
      fontStyle: 'bold',
    }));

    panel.add(this.inputField('serverUrl', -210, -118, t('pvp.serverUrl')));
    panel.add(this.inputField('playerName', -210, -42, t('pvp.playerName')));
    panel.add(this.inputField('roomId', -210, 34, t('pvp.roomId')));

    panel.add(this.button(-116, 126, 176, 48, t('pvp.connect'), () => this.connect()));
    panel.add(this.button(110, 126, 176, 48, t('pvp.createRoom'), () => this.createRoom(), '18px', this.connected));
    panel.add(this.button(-116, 188, 176, 48, t('pvp.joinRoom'), () => this.joinRoom(), '18px', this.connected));
    const selfReady = this.currentPlayerReady();
    panel.add(this.button(
      110,
      188,
      176,
      48,
      selfReady ? t('pvp.playerReady') : t('pvp.ready'),
      () => this.ready(),
      '18px',
      this.connected && !!this.roomState,
      selfReady ? 'success' : 'default',
    ));
  }

  private renderRoomPanel(): void {
    const panel = this.add.container(910, 268);
    panel.add(this.add.rectangle(0, 0, 560, 188, COLORS.panel, 0.96).setStrokeStyle(2, COLORS.line));
    panel.add(this.add.text(-236, -74, t('pvp.roomStatus'), {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: COLORS.text,
      fontStyle: 'bold',
    }));

    const statusColor = this.connected ? COLORS.green : COLORS.dangerText;
    const status = this.add.text(-236, -36, `${t('pvp.status')} ${this.status}`, {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: statusColor,
      wordWrap: { width: 472 },
    });
    status.setShadow(0, 0, statusColor, 8, true, true);
    panel.add(status);

    if (!this.roomState) {
      panel.add(this.add.text(-236, 14, t('pvp.noRoom'), {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: COLORS.muted,
        wordWrap: { width: 472 },
      }));
      return;
    }

    panel.add(this.add.text(-236, 0, `${t('pvp.room')} ${this.roomState.roomId}`, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: COLORS.accentText,
      fontStyle: 'bold',
    }).setShadow(0, 0, COLORS.accentText, 8, true, true));

    panel.add(this.add.text(42, 4, `${t('pvp.phase')} ${this.phaseLabel(this.roomState.phase)}`, {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: COLORS.text,
    }));

    this.roomState.players.forEach((player, index) => {
      const y = 48 + index * 42;
      const isSelf = player.id === this.roomState?.selfId;
      panel.add(this.add.rectangle(0, y + 8, 472, 34, isSelf ? 0x2a3027 : COLORS.panelAlt, 0.92).setStrokeStyle(1, isSelf ? 0x78d18a : COLORS.line));
      panel.add(this.add.text(-218, y - 2, `${player.name}${isSelf ? ` ${t('pvp.self')}` : ''}`, {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: COLORS.text,
        fontStyle: 'bold',
      }));
      panel.add(this.add.text(56, y - 2, player.ready ? t('pvp.playerReady') : t('pvp.playerWaiting'), {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: player.ready ? COLORS.green : COLORS.muted,
      }));
      panel.add(this.add.text(154, y - 2, player.connected ? t('pvp.online') : t('pvp.offline'), {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: player.connected ? COLORS.green : COLORS.dangerText,
      }));
    });

    if (this.roomState.phase === 'playing') {
      panel.add(this.button(180, 69, 150, 36, t('pvp.enterBattle'), () => {
        this.scene.start('PvpBattleScene');
      }, '15px'));
    }
  }

  private renderRoomListPanel(): void {
    const panel = this.add.container(910, 514);
    panel.add(this.add.rectangle(0, 0, 560, 284, COLORS.panel, 0.96).setStrokeStyle(2, COLORS.line));
    panel.add(this.add.text(-236, -118, t('pvp.roomList'), {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: COLORS.text,
      fontStyle: 'bold',
    }));
    panel.add(this.button(178, -116, 112, 32, t('pvp.refreshRooms'), () => pvpClient.requestRoomList(), '13px', this.connected));

    if (!this.connected) {
      panel.add(this.add.text(-236, -64, t('pvp.roomListOffline'), {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: COLORS.muted,
        wordWrap: { width: 472 },
      }));
      return;
    }

    if (this.roomList.length === 0) {
      panel.add(this.add.text(-236, -64, t('pvp.noRooms'), {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: COLORS.muted,
        wordWrap: { width: 472 },
      }));
      return;
    }

    this.roomList.slice(0, 5).forEach((room, index) => {
      const y = -66 + index * 46;
      const joinable = room.phase === 'waiting' && room.playerCount < room.maxPlayers;
      const isCurrent = room.roomId === this.roomState?.roomId;
      const fill = isCurrent ? 0x2a3027 : joinable ? 0x242936 : COLORS.panelAlt;
      const rect = this.add.rectangle(0, y + 16, 492, 38, fill, 0.94).setStrokeStyle(1, isCurrent ? 0x78d18a : joinable ? COLORS.accent : COLORS.line);
      panel.add(rect);
      panel.add(this.add.text(-226, y + 3, `${room.roomId} · ${room.hostName}`, {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: joinable ? COLORS.text : COLORS.muted,
        fontStyle: 'bold',
      }));
      panel.add(this.add.text(18, y + 4, t('pvp.roomPlayers', { count: room.playerCount, max: room.maxPlayers }), {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: COLORS.muted,
      }));
      panel.add(this.add.text(132, y + 4, this.roomJoinStatus(room), {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: joinable ? COLORS.green : COLORS.muted,
      }));
      if (joinable) {
        rect.setInteractive({ useHandCursor: true });
        rect.on('pointerover', () => rect.setFillStyle(COLORS.buttonHover));
        rect.on('pointerout', () => rect.setFillStyle(fill));
        rect.on('pointerdown', () => {
          this.playButtonClick();
          this.joinRoom(room.roomId);
        });
      }
    });
  }

  private inputField(key: FieldKey, x: number, y: number, label: string): Phaser.GameObjects.Container {
    const active = this.activeField === key;
    const field = this.add.container(x, y);
    field.add(this.add.text(0, 0, label, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: COLORS.muted,
    }));
    const rect = this.add.rectangle(210, 42, 420, 44, active ? 0x242936 : 0x20232a, 0.96).setStrokeStyle(2, active ? COLORS.accent : COLORS.line);
    const value = this.add.text(14, 30, this.fields[key] || t('pvp.emptyInput'), {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: this.fields[key] ? COLORS.text : COLORS.muted,
      fixedWidth: 390,
    });
    field.add([rect, value]);
    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerdown', () => {
      this.activeField = key;
      this.render();
    });
    return field;
  }

  private button(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    fontSize = '18px',
    enabled = true,
    variant: 'default' | 'success' = 'default',
  ): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const fill = enabled ? variant === 'success' ? 0x28633a : COLORS.button : 0x25272d;
    const hoverFill = variant === 'success' ? 0x347c49 : COLORS.buttonHover;
    const stroke = enabled ? variant === 'success' ? 0x78d18a : COLORS.line : 0x343741;
    const rect = this.add.rectangle(0, 0, width, height, fill).setStrokeStyle(2, stroke);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Arial',
      fontSize,
      color: enabled ? COLORS.text : COLORS.muted,
    }).setOrigin(0.5);
    if (enabled) {
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => rect.setFillStyle(hoverFill));
      rect.on('pointerout', () => rect.setFillStyle(fill));
      rect.on('pointerdown', () => {
        this.playButtonClick();
        onClick();
      });
    }
    button.add([rect, text]);
    return button;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      event.preventDefault();
      this.activeField = this.nextField();
      this.render();
      return;
    }

    if (event.key === 'Backspace') {
      this.fields[this.activeField] = this.fields[this.activeField].slice(0, -1);
      this.render();
      return;
    }

    if (event.key === 'Enter') {
      if (!this.connected) {
        this.connect();
      } else if (this.activeField === 'roomId') {
        this.joinRoom();
      }
      return;
    }

    if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const maxLength = this.activeField === 'serverUrl' ? 64 : this.activeField === 'playerName' ? 18 : 8;
    if (this.fields[this.activeField].length >= maxLength) {
      return;
    }

    this.fields[this.activeField] += event.key;
    this.render();
  }

  private nextField(): FieldKey {
    if (this.activeField === 'serverUrl') {
      return 'playerName';
    }

    if (this.activeField === 'playerName') {
      return 'roomId';
    }

    return 'serverUrl';
  }

  private connect(): void {
    if (this.connected) {
      pvpClient.requestRoomList();
      return;
    }

    this.status = t('pvp.connecting');
    this.render();
    pvpClient.connect(this.fields.serverUrl.trim()).catch((error: Error) => {
      this.status = error.message;
      this.render();
    });
  }

  private createRoom(): void {
    if (!this.connected) {
      this.status = t('pvp.needConnect');
      this.render();
      return;
    }

    pvpClient.createRoom(this.fields.playerName.trim());
  }

  private joinRoom(roomId = this.fields.roomId): void {
    if (!this.connected) {
      this.status = t('pvp.needConnect');
      this.render();
      return;
    }

    const normalizedRoomId = roomId.trim().toUpperCase();
    this.fields.roomId = normalizedRoomId;
    pvpClient.joinRoom(normalizedRoomId, this.fields.playerName.trim());
  }

  private ready(): void {
    if (!this.connected) {
      this.status = t('pvp.needConnect');
      this.render();
      return;
    }

    pvpClient.ready();
  }

  private currentPlayerReady(): boolean {
    return this.roomState?.players.find((player) => player.id === this.roomState?.selfId)?.ready ?? false;
  }

  private phaseLabel(phase: string): string {
    const key = `pvp.phase.${phase}`;
    return t(key);
  }

  private autoConnect(): void {
    if (this.connected || this.autoConnectStarted) {
      if (this.connected) {
        pvpClient.requestRoomList();
      }
      return;
    }

    this.autoConnectStarted = true;
    this.status = t('pvp.autoConnecting');
    this.render();
    pvpClient.connect(this.fields.serverUrl.trim()).catch((error: Error) => {
      this.status = error.message;
      this.render();
    });
  }

  private roomJoinStatus(room: PvpRoomSummary): string {
    if (room.phase === 'waiting' && room.playerCount < room.maxPlayers) {
      return t('pvp.roomJoinable');
    }

    if (room.phase === 'waiting') {
      return t('pvp.roomFull');
    }

    return this.phaseLabel(room.phase);
  }

  private playButtonClick(): void {
    this.sound.play('buttonClick', { volume: 0.42 });
  }
}
