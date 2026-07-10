import Phaser from 'phaser';
import { stopLobbyMusic } from '../game/audio';
import { getIntroSequence, type IntroSequenceConfig } from '../game/data/introSequences';
import { t } from '../game/i18n';

const COLORS = {
  bg: 0x020203,
  table: 0x4a3020,
  tableLine: 0x7b5737,
  card: 0xe8e1cc,
  cardLine: 0x5d4c3a,
  candle: 0xffd16a,
  candleCore: 0xfff2b0,
  bar: 0x151216,
  bartender: 0x2a2522,
  text: '#f2f2ed',
  muted: '#aeb4c0',
  accent: '#e8cf73',
};

interface ChapterIntroData {
  introId?: string;
  levelId?: string;
}

type IntroPhase = 'title' | 'narration' | 'transition' | 'dialogue' | 'readyToFinish' | 'finished';

const CARD_PACK_TAKE_OUT_KEY = 'cardPackTakeOut';

export class ChapterIntroScene extends Phaser.Scene {
  private intro?: IntroSequenceConfig;
  private levelId = 'chapter1_1';
  private timers: Phaser.Time.TimerEvent[] = [];
  private finished = false;
  private phase: IntroPhase = 'title';
  private stepIndex = 0;
  private narrationIndex = 0;
  private titleText?: Phaser.GameObjects.Text;
  private centerText?: Phaser.GameObjects.Text;

  constructor() {
    super('ChapterIntroScene');
  }

  init(data?: ChapterIntroData): void {
    this.levelId = data?.levelId ?? 'chapter1_1';
    this.intro = getIntroSequence(data?.introId ?? 'chapter1_opening');
    this.phase = 'title';
    this.stepIndex = 0;
    this.narrationIndex = 0;
    this.finished = false;
    this.timers = [];
  }

  preload(): void {
    if (!this.intro) {
      return;
    }

    if (!this.cache.audio.exists(this.intro.bgm.key)) {
      this.load.audio(this.intro.bgm.key, this.intro.bgm.path);
    }
    if (!this.cache.audio.exists(this.intro.shuffleSfx.key)) {
      this.load.audio(this.intro.shuffleSfx.key, this.intro.shuffleSfx.path);
    }
    if (!this.cache.audio.exists(CARD_PACK_TAKE_OUT_KEY)) {
      this.load.audio(CARD_PACK_TAKE_OUT_KEY, '/audio/cards-pack-take-out-1.ogg');
    }
  }

  create(): void {
    if (!this.intro) {
      this.finish();
      return;
    }

    this.cameras.main.setBackgroundColor(COLORS.bg);
    stopLobbyMusic(this);
    this.sound.play(this.intro.bgm.key, { loop: true, volume: this.intro.bgm.volume });
    this.timers.push(this.time.delayedCall(this.intro.shuffleSfx.delayMs, () => {
      this.sound.play(this.intro?.shuffleSfx.key ?? 'cardShuffle', { volume: this.intro?.shuffleSfx.volume ?? 0.7 });
    }));

    this.renderSkipHint();
    this.renderTableau();
    this.createTextObjects();
    this.bindSkipInput();
  }

  private renderSkipHint(): void {
    this.add.text(1166, 674, t('intro.skip'), {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: COLORS.muted,
    }).setOrigin(1, 0.5).setAlpha(0.68);
  }

  private renderTableau(): void {
    const group = this.add.container(640, 360).setAlpha(0);

    const bar = this.add.rectangle(0, -170, 860, 108, COLORS.bar, 0.72).setStrokeStyle(1, 0x28232a);
    const shelf = this.add.rectangle(0, -204, 700, 14, 0x24202a, 0.75);
    const bartenderBody = this.add.rectangle(0, -124, 104, 124, COLORS.bartender, 0.92).setStrokeStyle(2, 0x4a3d35);
    const bartenderHead = this.add.circle(0, -214, 34, 0x4b3b32, 0.92).setStrokeStyle(2, 0x6b5548);
    const bartenderArm = this.add.rectangle(-46, -80, 128, 18, 0x3a302b, 0.9).setRotation(-0.16);

    const table = this.add.rectangle(0, 162, 980, 248, COLORS.table, 0.98).setStrokeStyle(3, COLORS.tableLine);
    const tableGlow = this.add.ellipse(0, 70, 760, 180, 0x261812, 0.7);
    const candleGlow = this.add.circle(280, -4, 86, COLORS.candle, 0.15);
    const candle = this.add.rectangle(280, 42, 26, 76, 0xf0d8a6, 0.95).setStrokeStyle(1, 0x8c774f);
    const flame = this.add.circle(280, -8, 18, COLORS.candle, 0.88);
    const flameCore = this.add.circle(280, -10, 8, COLORS.candleCore, 0.9);

    const cards = this.add.container(-78, 124);
    for (let i = 0; i < 5; i += 1) {
      cards.add(this.add.rectangle(i * 18, i % 2 === 0 ? 0 : -5, 66, 92, COLORS.card, 0.96)
        .setStrokeStyle(2, COLORS.cardLine)
        .setRotation(-0.16 + i * 0.08));
    }

    group.add([bar, shelf, bartenderBody, bartenderHead, bartenderArm, tableGlow, table, candleGlow, candle, flame, flameCore, cards]);
    this.tweens.add({
      targets: group,
      alpha: 1,
      duration: 1800,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: [candleGlow, flame],
      alpha: { from: 0.15, to: 0.33 },
      scale: { from: 0.96, to: 1.08 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createTextObjects(): void {
    if (!this.intro) {
      return;
    }

    this.titleText = this.add.text(640, 246, t(this.intro.titleKey), {
      fontFamily: 'Arial',
      fontSize: '56px',
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    this.titleText.setShadow(0, 0, COLORS.accent, 16, true, true);

    this.centerText = this.add.text(640, 332, '', {
      fontFamily: 'Arial',
      fontSize: '25px',
      color: COLORS.text,
      align: 'center',
      lineSpacing: 14,
      wordWrap: { width: 760 },
    }).setOrigin(0.5).setAlpha(0);

    this.timers.push(this.time.delayedCall(650, () => this.showOpeningStep()));
  }

  private fadeOutNarration(onComplete?: () => void): void {
    let pending = 0;
    [this.titleText, this.centerText].forEach((text) => {
      if (!text) {
        return;
      }
      pending += 1;
      this.tweens.killTweensOf(text);
      this.tweens.add({
        targets: text,
        alpha: 0,
        duration: 520,
        ease: 'Sine.easeIn',
        onComplete: () => {
          pending -= 1;
          if (pending <= 0) {
            onComplete?.();
          }
        },
      });
    });

    if (pending === 0) {
      onComplete?.();
    }
  }

  private startDialogue(): void {
    if (!this.intro || !this.centerText || this.finished) {
      return;
    }

    this.phase = 'dialogue';
    this.stepIndex = 0;
    this.showCurrentStep();
  }

  private advance(): void {
    if (this.phase === 'title') {
      this.showOpeningStep();
      return;
    }

    if (this.phase === 'narration') {
      this.narrationIndex += 1;
      if (this.narrationIndex < (this.intro?.narrationKeys.length ?? 0)) {
        this.showNarrationStep();
        return;
      }

      this.phase = 'transition';
      this.fadeOutNarration(() => this.startDialogue());
      return;
    }

    if (this.phase === 'dialogue') {
      this.stepIndex += 1;
      this.showCurrentStep();
      return;
    }

    if (this.phase === 'readyToFinish') {
      this.finish();
    }
  }

  private showOpeningStep(): void {
    if (!this.intro || this.finished || this.phase !== 'title') {
      return;
    }

    if (this.intro.showTitle !== false) {
      this.phase = 'narration';
      this.narrationIndex = this.intro.narrationKeys.length;
      this.fadeText(this.titleText, t(this.intro.titleKey));
      this.centerText?.setStyle({
        fontSize: '25px',
        color: COLORS.text,
        fontStyle: '',
        lineSpacing: 14,
      });
      this.centerText?.setShadow(0, 0, '#000000', 6, true, true);
      this.fadeText(this.centerText, this.intro.narrationKeys.map((key) => t(key)).join('\n'), 420);
      return;
    }

    this.phase = 'narration';
    this.narrationIndex = this.intro.narrationKeys.length;
    this.centerText?.setStyle({
      fontSize: '25px',
      color: COLORS.text,
      fontStyle: '',
      lineSpacing: 14,
    });
    this.centerText?.setShadow(0, 0, '#000000', 6, true, true);
    this.fadeText(this.centerText, this.intro.narrationKeys.map((key) => t(key)).join('\n'), 420);
  }

  private showNarrationStep(): void {
    if (!this.intro || !this.centerText || this.finished) {
      return;
    }

    this.phase = 'narration';
    this.centerText.setStyle({
      fontSize: '25px',
      color: COLORS.text,
      fontStyle: '',
      lineSpacing: 14,
    });
    this.centerText.setShadow(0, 0, '#000000', 6, true, true);
    this.fadeText(this.centerText, t(this.intro.narrationKeys[this.narrationIndex] ?? ''), 300);
  }

  private showCurrentStep(): void {
    if (!this.intro || !this.centerText) {
      return;
    }

    const step = this.intro.steps[this.stepIndex];
    if (!step) {
      this.finish();
      return;
    }

    if (step.type === 'dialogue') {
      this.centerText.setStyle({
        fontSize: '30px',
        color: COLORS.accent,
        fontStyle: 'bold',
        lineSpacing: 12,
      });
      this.centerText.setShadow(0, 0, COLORS.accent, 10, true, true);
      this.fadeText(this.centerText, t(step.textKey), 240);
    } else if (step.type === 'narration') {
      this.centerText.setStyle({
        fontSize: '26px',
        color: COLORS.text,
        fontStyle: '',
        lineSpacing: 12,
      });
      this.centerText.setShadow(0, 0, '#000000', 6, true, true);
      this.fadeText(this.centerText, t(step.textKey), 240);
      if (step.textKey === 'intro.chapter1.pushCards') {
        this.time.delayedCall(260, () => {
          if (!this.finished) {
            this.sound.play(CARD_PACK_TAKE_OUT_KEY, { volume: 0.72 });
          }
        });
      }
    } else {
      this.centerText.setStyle({
        fontSize: '34px',
        color: COLORS.text,
        fontStyle: 'bold',
        lineSpacing: 14,
      });
      this.centerText.setShadow(0, 0, COLORS.accent, 14, true, true);
      const subtitle = step.subtitleKey ? `\n${t(step.subtitleKey)}` : '';
      this.fadeText(this.centerText, `${t(step.titleKey)}${subtitle}`, 300);
    }

    if (this.stepIndex >= this.intro.steps.length - 1) {
      this.phase = 'readyToFinish';
    }
  }

  private fadeText(text: Phaser.GameObjects.Text | undefined, content: string, duration = 420): void {
    if (!text) {
      return;
    }

    text.setText(content);
    this.tweens.killTweensOf(text);
    text.setAlpha(0);
    this.tweens.add({
      targets: text,
      alpha: 1,
      duration,
      ease: 'Sine.easeOut',
    });
  }

  private bindSkipInput(): void {
    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.once('keydown-ESC', () => this.finish());
  }

  private finish(): void {
    if (this.finished) {
      return;
    }

    this.finished = true;
    this.phase = 'finished';
    this.timers.forEach((timer) => timer.remove(false));
    this.timers = [];
    this.tweens.killAll();
    if (this.intro) {
      this.sound.stopByKey(this.intro.bgm.key);
    }
    this.scene.start('BattleScene', { levelId: this.levelId });
  }
}
