import Phaser from 'phaser';
import { Battle, DamageEvent } from '../game/battle';
import { formatCard } from '../game/card';
import { EconomyChange, settleBattleEconomy } from '../game/economy';
import { EnemyState } from '../game/enemy';
import { enemyName, enemyPersonality, t } from '../game/i18n';
import { ScoreResult, scoreHand } from '../game/scoring';

const COLORS = {
  bg: 0x101114,
  panel: 0x1b1d22,
  panelAlt: 0x252832,
  line: 0x3b3f4c,
  text: '#f2f2ed',
  muted: '#aeb4c0',
  accent: 0xe8cf73,
  red: '#ef6f6c',
  heat: '#ff4b5f',
  resonance: '#ffd86b',
  green: '#78d18a',
  button: 0x303542,
  buttonHover: 0x41495b,
  danger: 0x734143,
};

const SKILL_COLORS = {
  player: 0xffb84d,
  goblin: 0x65d46e,
  gambler: 0xf25f9a,
  werewolf: 0x73c7ff,
};

const SEATS = {
  player: { x: 640, y: 568, width: 420, height: 140 },
  enemy: [
    { x: 178, y: 318, width: 292, height: 146 },
    { x: 640, y: 108, width: 336, height: 168 },
    { x: 1102, y: 318, width: 292, height: 146 },
  ],
};

export class BattleScene extends Phaser.Scene {
  private battle!: Battle;
  private battleEconomySettled = false;
  private economyResult?: EconomyChange;
  private resultModalReady = true;
  private ui: Phaser.GameObjects.Container[] = [];
  private seatContainers = new Map<string, Phaser.GameObjects.Container>();

  constructor() {
    super('BattleScene');
  }

  create(): void {
    this.battle = new Battle();
    this.battleEconomySettled = false;
    this.economyResult = undefined;
    this.resultModalReady = true;
    this.render();
  }

  private render(): void {
    this.settleEconomyIfNeeded();
    this.children.removeAll(true);
    this.ui.forEach((item) => item.destroy(true));
    this.ui = [];
    this.seatContainers.clear();

    this.addBackground();
    this.renderEnemies();
    this.renderCenterInfo();
    this.renderPlayer();
    this.renderLog();
    this.renderActions();
    this.renderResultModal();
  }

  private addBackground(): void {
    this.add.rectangle(640, 360, 1280, 720, COLORS.bg);
    this.add.rectangle(640, 360, 1280, 720, 0x14161a);
    this.add.circle(640, 350, 205, 0x191c22, 0.95).setStrokeStyle(2, COLORS.line);
    this.add.circle(640, 350, 145, 0x101114, 0.5).setStrokeStyle(1, 0x2b303c);
  }

  private renderEnemies(): void {
    this.battle.enemies.forEach((enemy, index) => {
      const seat = SEATS.enemy[index];
      const container = this.add.container(seat.x, seat.y);
      this.ui.push(container);
      this.seatContainers.set(enemy.id, container);
      const active = this.battle.currentEnemyIndex === index && this.battle.phase === 'enemy-turn';
      const defeatedColor = enemy.defeated ? 0x24262b : COLORS.panel;
      container.add(this.add.rectangle(0, 0, seat.width, seat.height, active ? COLORS.panelAlt : defeatedColor).setStrokeStyle(2, active ? COLORS.accent : COLORS.line));
      container.add(this.add.text(-seat.width / 2 + 18, -seat.height / 2 + 18, enemyName(enemy.id), { fontFamily: 'Arial', fontSize: '22px', color: enemy.defeated ? COLORS.muted : COLORS.text }));
      container.add(this.hpText(seat.width / 2 - 118, -seat.height / 2 + 18, t('common.hp', { hp: enemy.hp, maxHp: enemy.maxHp }), enemy.defeated));
      container.add(this.add.text(-seat.width / 2 + 18, -seat.height / 2 + 48, enemy.defeated ? t('common.defeated') : enemyPersonality(enemy.id), { fontFamily: 'Arial', fontSize: '15px', color: enemy.defeated ? COLORS.green : COLORS.muted }));
      container.add(this.cardsText(-seat.width / 2 + 18, -seat.height / 2 + 82, this.enemyCardsText(enemy), this.enemyHasResonance(enemy), enemy.defeated));

      if (this.shouldShowEnemyScore(enemy)) {
        this.renderScoreBadge(container, seat.width / 2 - 82, 24, this.scoreEnemy(enemy).point);
        container.add(this.resonanceLabel(-seat.width / 2 + 18, seat.height / 2 - 22, this.scoreEnemy(enemy)));
      }

      const inviteText = this.enemyInviteText(enemy);
      if (inviteText) {
        container.add(this.add.text(-seat.width / 2 + 18, seat.height / 2 - 42, inviteText.text, { fontFamily: 'Arial', fontSize: '15px', color: inviteText.color }));
      }

      container.add(this.enemyPassiveIcon(enemy, index, seat));
    });
  }

  private renderCenterInfo(): void {
    const container = this.add.container(640, 342);
    this.ui.push(container);

    container.add(this.add.text(0, -86, t('battle.title', { round: this.battle.round }), { fontFamily: 'Arial', fontSize: '28px', color: COLORS.text }).setOrigin(0.5));
    container.add(this.add.text(0, -44, this.phaseText(), { fontFamily: 'Arial', fontSize: '17px', color: COLORS.muted, align: 'center', wordWrap: { width: 430 } }).setOrigin(0.5));

    const currentEnemy = this.battle.currentEnemy;
    const targetText = t('battle.target', { target: currentEnemy && this.battle.phase === 'enemy-turn' ? enemyName(currentEnemy.id) : t('battle.targetNone') });
    container.add(this.add.text(0, 18, targetText, { fontFamily: 'Arial', fontSize: '21px', color: '#e8cf73' }).setOrigin(0.5));

    const heatRisk = this.battle.heat >= 5 ? t('battle.heatRiskActive') : t('battle.heatRiskPending');
    const playerRisk = this.battle.player.incomingDamageBonus > 0 ? t('battle.playerRisk') : '';
    const heatText = this.add.text(0, 58, t('battle.heat', { heat: this.battle.heat, stage: this.battle.heatStage, risk: heatRisk, playerRisk }), {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: COLORS.heat,
    }).setOrigin(0.5);
    heatText.setShadow(0, 0, COLORS.heat, 12, true, true);
    container.add(heatText);

    const aliveText = t('battle.aliveInfo', { alive: this.battle.aliveEnemies.length, total: this.battle.enemies.length });
    container.add(this.add.text(0, 90, aliveText, { fontFamily: 'Arial', fontSize: '14px', color: COLORS.muted }).setOrigin(0.5));
  }

  private renderPlayer(): void {
    const seat = SEATS.player;
    const container = this.add.container(seat.x, seat.y);
    this.ui.push(container);
    this.seatContainers.set('player', container);

    container.add(this.add.rectangle(0, 0, seat.width, seat.height, COLORS.panel).setStrokeStyle(2, COLORS.line));
    container.add(this.add.text(-seat.width / 2 + 20, -seat.height / 2 + 18, t('common.playerDealer'), { fontFamily: 'Arial', fontSize: '24px', color: COLORS.text }));
    container.add(this.hpText(seat.width / 2 - 132, -seat.height / 2 + 18, t('common.hp', { hp: this.battle.player.hp, maxHp: this.battle.player.maxHp })));
    container.add(this.cardsText(-seat.width / 2 + 20, -seat.height / 2 + 58, this.playerCardsText(), this.playerHasResonance(), false, '32px'));

    if (this.battle.phase !== 'choice') {
      const score = this.battle.playerScore();
      this.renderScoreBadge(container, seat.width / 2 - 82, 18, score.point);
      container.add(this.resonanceLabel(-seat.width / 2 + 20, -seat.height / 2 + 106, score, '18px'));
    } else {
      container.add(this.add.text(-seat.width / 2 + 20, -seat.height / 2 + 106, t('battle.handHidden'), { fontFamily: 'Arial', fontSize: '18px', color: COLORS.muted }));
    }

    container.add(this.skillSlot('shift', seat.width / 2 + 54, -38));
    container.add(this.skillSlot('summon', seat.width / 2 + 54, 38));
    container.add(this.playerPassiveIcon(seat));
  }

  private renderLog(): void {
    const container = this.add.container(24, 520);
    this.ui.push(container);

    container.add(this.add.text(0, 0, t('battle.logTitle'), { fontFamily: 'Arial', fontSize: '20px', color: COLORS.text }));
    this.battle.log.slice(0, 4).forEach((message, index) => {
      container.add(this.add.text(0, 30 + index * 26, message, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: index === 0 ? '#f4df91' : COLORS.muted,
        wordWrap: { width: 330 },
      }));
    });
  }

  private renderActions(): void {
    const container = this.add.container(448, 648);
    this.ui.push(container);

    if (this.battle.phase === 'choice') {
      container.add(this.button(0, 0, 190, 48, t('battle.button.viewHand'), () => {
        this.battle.chooseViewHand();
        this.render();
      }));
      return;
    }

    if (this.battle.phase === 'enemy-turn') {
      const currentEnemy = this.battle.currentEnemy;
      if (currentEnemy?.invited === undefined) {
        container.add(this.button(0, 0, 190, 48, t('battle.button.inviteOne'), () => {
          this.battle.inviteCurrentEnemy();
          this.render();
        }));
      }

      container.add(this.button(currentEnemy?.invited === undefined ? 210 : 0, 0, 170, 48, t('battle.button.compare'), () => {
        this.runAction(() => this.battle.compareCurrentEnemy());
      }));
      return;
    }

    if (this.battle.phase === 'player-turn') {
      container.add(this.button(0, 0, 180, 48, t('battle.button.stand'), () => {
        this.runAction(() => this.battle.playerStand());
      }));
      if (!this.battle.player.drawLocked && this.battle.player.drawCountThisRound < 2) {
        const isSecondDraw = this.battle.player.drawCountThisRound === 1;
        container.add(this.button(200, 0, isSecondDraw ? 236 : 200, 48, isSecondDraw ? t('battle.button.drawRisk') : t('battle.button.draw'), () => {
          this.runAction(() => this.battle.playerDraw());
        }, isSecondDraw ? COLORS.danger : COLORS.button));
      }
      return;
    }

    if (this.battle.phase === 'round-result') {
      container.add(this.button(0, 0, 190, 48, t('battle.button.nextRound'), () => {
        this.battle.nextRound();
        this.render();
      }));
      return;
    }
  }

  private settleEconomyIfNeeded(): void {
    if (this.battleEconomySettled || this.battle.phase !== 'battle-result' || !this.battle.battleOutcome) {
      return;
    }

    this.battleEconomySettled = true;
    const economy = settleBattleEconomy(this.battle.battleOutcome, this.battle.player.hp);
    this.economyResult = economy;
    this.battle.log.unshift(this.battle.battleOutcome === 'victory'
      ? t('log.economyVictory', { amount: economy.amount, total: economy.total })
      : t('log.economyDefeat', { total: economy.total }));
  }

  private renderResultModal(): void {
    if (!this.resultModalReady || this.battle.phase !== 'battle-result' || !this.battle.battleOutcome || !this.economyResult) {
      return;
    }

    const isVictory = this.battle.battleOutcome === 'victory';
    const container = this.add.container(640, 360).setDepth(100);
    this.ui.push(container);

    container.add(this.add.rectangle(0, 0, 1280, 720, 0x050608, 0.68));
    container.add(this.add.rectangle(0, 0, 420, 282, COLORS.panel, 0.98).setStrokeStyle(2, isVictory ? 0x78d18a : 0xff4b5f));

    const titleColor = isVictory ? COLORS.green : COLORS.heat;
    const title = this.add.text(0, -88, isVictory ? t('battle.result.victory') : t('battle.result.defeat'), {
      fontFamily: 'Arial',
      fontSize: '46px',
      color: titleColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 0, titleColor, 12, true, true);

    const goldText = this.add.text(0, -24, t('battle.result.goldGained', { amount: this.economyResult.amount }), {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#e8cf73',
    }).setOrigin(0.5);
    goldText.setShadow(0, 0, '#e8cf73', 8, true, true);

    container.add([
      title,
      goldText,
      this.add.text(0, 18, t('battle.result.totalGold', { total: this.economyResult.total }), {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: COLORS.muted,
      }).setOrigin(0.5),
      this.button(-110, 68, 220, 50, t('battle.result.returnLobby'), () => {
        this.scene.start('StartScene');
      }),
    ]);
  }

  private button(x: number, y: number, width: number, height: number, label: string, onClick: () => void, fill = COLORS.button): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const rect = this.add.rectangle(width / 2, height / 2, width, height, fill).setStrokeStyle(2, COLORS.line);
    const text = this.add.text(width / 2, height / 2, label, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: COLORS.text,
    }).setOrigin(0.5);

    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerover', () => rect.setFillStyle(COLORS.buttonHover));
    rect.on('pointerout', () => rect.setFillStyle(fill));
    rect.on('pointerdown', onClick);

    button.add([rect, text]);
    return button;
  }

  private skillSlot(kind: 'shift' | 'summon', x: number, y: number): Phaser.GameObjects.Container {
    const isShift = kind === 'shift';
    const available = this.battle.phase === 'player-turn'
      && (isShift ? this.battle.canUseResonanceShift() : !this.battle.player.resonanceSummonUsed && this.battle.playerScore().resonance !== 'none');
    const title = isShift ? t('skill.resonanceShift.name') : t('skill.resonanceSummon.name');
    const iconGlyph = isShift ? '◇' : '✦';
    const tooltip = isShift ? t('skill.resonanceShift.tooltip') : t('skill.resonanceSummon.tooltip');
    const slot = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, 78, 64, available ? 0x2a2e38 : 0x20232a).setStrokeStyle(2, available ? 0xffd86b : COLORS.line);
    const iconGlow = this.add.circle(0, -10, 19, 0xffd86b, available ? 0.22 : 0.08);
    const icon = this.add.text(0, -12, iconGlyph, {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: available ? COLORS.resonance : COLORS.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const label = this.add.text(0, 20, title, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: available ? COLORS.text : COLORS.muted,
    }).setOrigin(0.5);

    if (available) {
      icon.setShadow(0, 0, COLORS.resonance, 10, true, true);
    }

    rect.setInteractive({ useHandCursor: available });
    rect.on('pointerover', () => {
      rect.setFillStyle(0x343947);
      this.showSkillTooltip(SEATS.player.x + x + 70, SEATS.player.y + y - 98, title, tooltip);
    });
    rect.on('pointerout', () => {
      rect.setFillStyle(available ? 0x2a2e38 : 0x20232a);
      this.hideSkillTooltip();
    });
    rect.on('pointerdown', () => {
      if (!available) {
        return;
      }

      this.runAction(() => {
        const result = isShift ? this.battle.useResonanceShift() : this.battle.useResonanceSummon();
        if (!result.used) {
          // The log only records real skill attempts; surface invalid use in-place.
          this.showSkillTooltip(SEATS.player.x + x + 70, SEATS.player.y + y - 98, title, result.message);
        }
      });
    });

    slot.add([rect, iconGlow, icon, label]);
    return slot;
  }

  private playerPassiveIcon(seat: { width: number; height: number }): Phaser.GameObjects.Container {
    const active = !this.battle.player.soulRedeemUsed;
    const x = -seat.width / 2 - 42;
    const y = -34;
    const icon = this.add.container(x, y);
    const color = 0xffd86b;
    const textColor = active ? COLORS.resonance : COLORS.muted;
    const rect = this.add.rectangle(0, 0, 54, 44, active ? 0x332c20 : 0x20232a).setStrokeStyle(2, active ? color : COLORS.line);
    const glyph = this.add.text(0, -5, '✚', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: textColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const label = this.add.text(0, 14, t('common.passive'), {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: active ? COLORS.text : COLORS.muted,
    }).setOrigin(0.5);

    if (active) {
      glyph.setShadow(0, 0, COLORS.resonance, 10, true, true);
    }

    rect.setInteractive({ useHandCursor: false });
    rect.on('pointerover', () => {
      rect.setFillStyle(0x343947);
      this.showSkillTooltip(SEATS.player.x + x - 190, SEATS.player.y + y - 94, t('skill.soulRedeem.name'), t('skill.soulRedeem.tooltip'));
    });
    rect.on('pointerout', () => {
      rect.setFillStyle(active ? 0x332c20 : 0x20232a);
      this.hideSkillTooltip();
    });

    icon.add([rect, glyph, label]);
    return icon;
  }

  private enemyPassiveIcon(enemy: EnemyState, index: number, seat: { width: number; height: number }): Phaser.GameObjects.Container {
    const passive = this.enemyPassiveInfo(enemy);
    const x = index === 1 ? -seat.width / 2 - 34 : -seat.width / 2 + 34;
    const y = index === 1 ? -seat.height / 2 + 34 : -seat.height / 2 - 32;
    const active = this.enemyPassiveActive(enemy);
    const icon = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, 54, 44, active ? 0x33262b : 0x20232a).setStrokeStyle(2, active ? passive.color : COLORS.line);
    const glyph = this.add.text(0, -5, passive.icon, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: active ? passive.textColor : COLORS.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const label = this.add.text(0, 14, t('common.passive'), {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: active ? COLORS.text : COLORS.muted,
    }).setOrigin(0.5);

    if (active) {
      glyph.setShadow(0, 0, passive.textColor, 10, true, true);
    }

    rect.setInteractive({ useHandCursor: false });
    rect.on('pointerover', () => {
      rect.setFillStyle(0x343947);
      const worldX = SEATS.enemy[index].x + x + (index === 1 ? -170 : 150);
      const worldY = SEATS.enemy[index].y + y + (index === 1 ? 104 : -62);
      this.showSkillTooltip(worldX, worldY, passive.name, passive.description);
    });
    rect.on('pointerout', () => {
      rect.setFillStyle(active ? 0x33262b : 0x20232a);
      this.hideSkillTooltip();
    });

    icon.add([rect, glyph, label]);
    return icon;
  }

  private enemyPassiveInfo(enemy: EnemyState): { name: string; icon: string; description: string; color: number; textColor: string } {
    if (enemy.id === 'goblin') {
      return {
        name: t('skill.goblinInstinct.name'),
        icon: '!',
        description: t('skill.goblinInstinct.tooltip'),
        color: 0x65d46e,
        textColor: '#78d18a',
      };
    }

    if (enemy.id === 'gambler') {
      return {
        name: t('skill.gamblerBlessing.name'),
        icon: '♢',
        description: t('skill.gamblerBlessing.tooltip'),
        color: 0xf25f9a,
        textColor: '#f25f9a',
      };
    }

    return {
      name: t('skill.werewolfLifesteal.name'),
      icon: 'V',
      description: t('skill.werewolfLifesteal.tooltip'),
      color: 0x73c7ff,
      textColor: '#73c7ff',
    };
  }

  private enemyPassiveActive(enemy: EnemyState): boolean {
    if (enemy.id === 'goblin') {
      return enemy.hp < 3 && !enemy.defeated;
    }

    if (enemy.id === 'gambler') {
      return enemy.hp < 3 && !enemy.defeated;
    }

    return enemy.hp < 3 && !enemy.defeated;
  }

  private showSkillTooltip(x: number, y: number, title: string, body: string): void {
    this.hideSkillTooltip();
    const tooltip = this.add.container(x, y).setDepth(50).setName('skill-tooltip');
    const width = 320;
    const bodyText = this.add.text(-width / 2 + 16, -18, body, {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: COLORS.text,
      lineSpacing: 4,
      wordWrap: { width: width - 32 },
    });
    const height = Math.max(104, bodyText.height + 58);
    tooltip.add(this.add.rectangle(0, 0, width, height, 0x101114, 0.96).setStrokeStyle(2, 0xffd86b));
    tooltip.add(this.add.text(-width / 2 + 16, -height / 2 + 14, title, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: COLORS.resonance,
      fontStyle: 'bold',
    }));
    bodyText.setY(-height / 2 + 42);
    tooltip.add(bodyText);
  }

  private hideSkillTooltip(): void {
    this.children.getByName('skill-tooltip')?.destroy();
  }

  private hpText(x: number, y: number, label: string, muted = false): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: muted ? COLORS.muted : COLORS.heat,
    });
    if (!muted) {
      text.setShadow(0, 0, COLORS.heat, 10, true, true);
    }

    return text;
  }

  private renderScoreBadge(container: Phaser.GameObjects.Container, x: number, y: number, point: number): void {
    const color = this.pointColor(point);
    const badge = this.add.container(x, y);
    badge.add(this.add.circle(0, 0, 31, color.fill, 0.18).setStrokeStyle(2, color.stroke, 0.95));
    badge.add(this.add.circle(0, 0, 22, color.fill, 0.26));
    const pointText = this.add.text(0, -3, `${point}`, {
      fontFamily: 'Arial',
      fontSize: '31px',
      color: color.text,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    pointText.setShadow(0, 0, color.glow, 14, true, true);

    if (point >= 7) {
      pointText.setTint(0xcaff8a, 0x55ff9e, 0x1fd97a, 0x079b5a);
    }

    badge.add(pointText);
    badge.add(this.add.text(0, 20, t('common.pointUnit'), {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: color.text,
    }).setOrigin(0.5));
    container.add(badge);
  }

  private pointColor(point: number): { fill: number; stroke: number; text: string; glow: string } {
    if (point >= 1 && point <= 3) {
      return { fill: 0xff4058, stroke: 0xff6f7f, text: '#ff6f7f', glow: '#ff4058' };
    }

    if (point >= 4 && point <= 6) {
      return { fill: 0xffd45c, stroke: 0xffe58a, text: '#ffdf7a', glow: '#ffd45c' };
    }

    if (point >= 7) {
      return { fill: 0x35e582, stroke: 0x98ff9f, text: '#98ff9f', glow: '#35e582' };
    }

    return { fill: 0x8b96aa, stroke: 0xb5c0d0, text: '#b5c0d0', glow: '#8b96aa' };
  }

  private resonanceText(score: ScoreResult): string {
    if (score.resonance === 'strong') {
      return t('score.strongResonance', { multiplier: score.multiplier });
    }

    if (score.resonance === 'resonance') {
      return t('score.resonance', { multiplier: score.multiplier });
    }

    return t('score.noResonance');
  }

  private cardsText(x: number, y: number, label: string, resonant: boolean, muted = false, fontSize = '24px'): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize,
      color: muted ? COLORS.muted : COLORS.text,
      stroke: resonant ? COLORS.resonance : undefined,
      strokeThickness: resonant ? 3 : 0,
    });

    if (resonant) {
      text.setShadow(0, 0, COLORS.resonance, 12, true, true);
    }

    return text;
  }

  private resonanceLabel(x: number, y: number, score: ScoreResult, fontSize = '14px'): Phaser.GameObjects.Text {
    const resonant = score.resonance !== 'none';
    const text = this.add.text(x, y, this.resonanceText(score), {
      fontFamily: 'Arial',
      fontSize,
      color: resonant ? COLORS.resonance : COLORS.muted,
    });

    if (resonant) {
      text.setShadow(0, 0, COLORS.resonance, 12, true, true);
    }

    return text;
  }

  private enemyHasResonance(enemy: EnemyState): boolean {
    return this.shouldShowEnemyScore(enemy) && this.scoreEnemy(enemy).resonance !== 'none';
  }

  private playerHasResonance(): boolean {
    return this.battle.phase !== 'choice' && this.battle.playerScore().resonance !== 'none';
  }

  private runAction(action: () => void): void {
    action();
    const damageEvents = [...this.battle.damageEvents];
    const shouldDelayResultModal = this.battle.phase === 'battle-result' && damageEvents.length > 0;
    this.resultModalReady = !shouldDelayResultModal;
    this.render();
    this.playDamageAnimations(damageEvents, () => {
      if (!shouldDelayResultModal) {
        return;
      }

      this.resultModalReady = true;
      this.render();
    });
  }

  private playDamageAnimations(events: DamageEvent[], onComplete?: () => void): void {
    if (events.length === 0) {
      onComplete?.();
      return;
    }

    events.forEach((event, index) => {
      this.time.delayedCall(index * 820, () => this.playCombatAnimation(event));
    });
    const totalDuration = (events.length - 1) * 820 + 640 + 760 + 120;
    this.time.delayedCall(totalDuration, () => onComplete?.());
  }

  private playCombatAnimation(event: DamageEvent): void {
    const enemy = this.battle.enemies.find((item) => item.id === event.enemyId);
    if (!enemy) {
      return;
    }

    const positions = this.combatPositions(enemy);
    if (event.type === 'clash') {
      this.playClashAnimation(positions.player, positions.enemy, enemy);
      return;
    }

    if (!event.attacker) {
      return;
    }

    const from = event.attacker === 'player' ? positions.player : positions.enemy;
    const to = event.attacker === 'player' ? positions.enemy : positions.player;
    const color = event.attacker === 'player' ? SKILL_COLORS.player : SKILL_COLORS[enemy.id];
    const label = event.attacker === 'player' ? t('common.player') : enemyName(enemy.id);

    this.playProjectile(from, to, color, label, () => {
      this.playImpactBurst(to.x, to.y, color);
      this.playDamageText(to.x, to.y - 42, event.amount);
      this.shakeSeat(event.attacker === 'player' ? enemy.id : 'player');
    });
  }

  private combatPositions(enemy: EnemyState): { player: Phaser.Math.Vector2; enemy: Phaser.Math.Vector2 } {
    const enemyIndex = this.battle.enemies.indexOf(enemy);
    const enemySeat = SEATS.enemy[enemyIndex];
    return {
      enemy: new Phaser.Math.Vector2(enemySeat.x, enemySeat.y),
      player: new Phaser.Math.Vector2(SEATS.player.x, SEATS.player.y),
    };
  }

  private playProjectile(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number, label: string, onHit: () => void): void {
    let lastTrailAt = 0;
    const projectile = this.add.container(from.x, from.y).setDepth(20);
    projectile.add(this.add.circle(0, 0, 28, color, 0.16));
    projectile.add(this.add.circle(0, 0, 18, color, 0.34));
    projectile.add(this.add.circle(0, 0, 9, 0xffffff, 0.92));
    const rune = this.add.text(0, 0, label.slice(0, 2), {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: COLORS.text,
    }).setOrigin(0.5);
    rune.setShadow(0, 0, '#ffffff', 8, true, true);
    projectile.add(rune);

    this.tweens.add({
      targets: projectile,
      x: to.x,
      y: to.y,
      scaleX: 1.16,
      scaleY: 1.16,
      duration: 640,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (this.time.now - lastTrailAt < 48) {
          return;
        }

        lastTrailAt = this.time.now;
        this.spawnTrail(projectile.x, projectile.y, color);
      },
      onComplete: () => {
        projectile.destroy(true);
        onHit();
      },
    });
  }

  private playClashAnimation(playerPosition: Phaser.Math.Vector2, enemyPosition: Phaser.Math.Vector2, enemy: EnemyState): void {
    const midpoint = new Phaser.Math.Vector2((playerPosition.x + enemyPosition.x) / 2, (playerPosition.y + enemyPosition.y) / 2);
    let arrived = 0;
    const onArrive = () => {
      arrived += 1;
      if (arrived < 2) {
        return;
      }

      this.playImpactBurst(midpoint.x, midpoint.y, 0xffffff);
      this.playClashText(midpoint.x, midpoint.y - 34);
    };

    this.playProjectile(playerPosition, midpoint, SKILL_COLORS.player, t('common.player'), onArrive);
    this.playProjectile(enemyPosition, midpoint, SKILL_COLORS[enemy.id], enemyName(enemy.id), onArrive);
  }

  private spawnTrail(x: number, y: number, color: number): void {
    const trail = this.add.circle(x, y, 13, color, 0.28).setDepth(18);
    this.tweens.add({
      targets: trail,
      scale: 0.24,
      alpha: 0,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => trail.destroy(),
    });
  }

  private playImpactBurst(x: number, y: number, color: number): void {
    const outer = this.add.circle(x, y, 8, color, 0.36).setDepth(19);
    const inner = this.add.circle(x, y, 4, 0xffffff, 0.9).setDepth(20);
    this.tweens.add({
      targets: outer,
      scale: 5,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => outer.destroy(),
    });
    this.tweens.add({
      targets: inner,
      scale: 3,
      alpha: 0,
      duration: 280,
      ease: 'Quad.easeOut',
      onComplete: () => inner.destroy(),
    });
  }

  private playDamageText(x: number, y: number, amount: number): void {
    const text = this.add.text(x, y, `-${amount} HP`, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: COLORS.red,
      stroke: '#101114',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(21);

    this.tweens.add({
      targets: text,
      y: y - 42,
      alpha: 0,
      duration: 760,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private playClashText(x: number, y: number): void {
    const text = this.add.text(x, y, t('battle.clashText'), {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: '#d9f4ff',
      stroke: '#101114',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(21);
    text.setShadow(0, 0, '#73c7ff', 10, true, true);

    this.tweens.add({
      targets: text,
      y: y - 34,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private shakeSeat(id: string): void {
    const container = this.seatContainers.get(id);
    if (!container) {
      return;
    }

    const startX = container.x;
    this.tweens.add({
      targets: container,
      x: startX + 9,
      duration: 44,
      yoyo: true,
      repeat: 5,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        container.x = startX;
      },
    });
  }

  private enemyCardsText(enemy: EnemyState): string {
    if (enemy.defeated && enemy.hand.length === 0) {
      return t('battle.notParticipating');
    }

    if (enemy.revealed || (this.battle.roundRevealed && this.battle.results.some((result) => result.enemy === enemy))) {
      return enemy.hand.map(formatCard).join(' ');
    }

    return [formatCard(enemy.hand[0]), ...enemy.hand.slice(1).map(() => '??')].join(' ');
  }

  private enemyInviteText(enemy: EnemyState): { text: string; color: string } | undefined {
    if (enemy.invited === undefined) {
      return undefined;
    }

    if (!enemy.invited) {
      return { text: t('battle.invite.notInvited'), color: COLORS.muted };
    }

    return enemy.acceptedInvite
      ? { text: t('battle.invite.accepted'), color: COLORS.green }
      : { text: t('battle.invite.rejected'), color: COLORS.red };
  }

  private playerCardsText(): string {
    if (this.battle.phase === 'choice') {
      return this.battle.player.hand.map(() => '??').join(' ');
    }

    if (this.battle.player.fateMode && !this.battle.roundRevealed) {
      return this.battle.player.hand.map(() => '??').join(' ');
    }

    return this.battle.player.hand.map(formatCard).join(' ');
  }

  private phaseText(): string {
    if (this.battle.phase === 'choice') {
      return t('battle.phase.choice');
    }

    if (this.battle.phase === 'enemy-turn') {
      return t('battle.phase.enemyTurn');
    }

    if (this.battle.phase === 'player-turn') {
      const remainingDraws = 2 - this.battle.player.drawCountThisRound;
      const risk = this.battle.player.incomingDamageBonus > 0 ? t('battle.phase.playerRiskActive') : t('battle.phase.playerRiskPending');
      return t('battle.phase.playerTurn', { remaining: remainingDraws, risk });
    }

    if (this.battle.phase === 'round-result') {
      return t('battle.phase.roundResult');
    }

    return this.battle.battleOutcome === 'victory'
      ? t('battle.phase.victory')
      : t('battle.phase.defeat');
  }

  private scoreEnemy(enemy: EnemyState) {
    return this.battle.results.find((result) => result.enemy === enemy)?.enemyScore ?? scoreHand(enemy.hand);
  }

  private shouldShowEnemyScore(enemy: EnemyState): boolean {
    return (enemy.revealed || this.battle.roundRevealed) && this.battle.results.some((result) => result.enemy === enemy);
  }

  private isResultPhase(): boolean {
    return this.battle.phase === 'round-result' || this.battle.phase === 'battle-result';
  }
}
