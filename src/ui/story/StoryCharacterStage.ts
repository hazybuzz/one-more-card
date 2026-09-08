import Phaser from 'phaser';
import type { EnemyId } from '../../game/types/enemy';
import type { IntroCastMember, IntroStagePreset, IntroStageSlot } from '../../game/data/introSequences';
import { getEnemyCharacterArt } from '../art/BattleArtRegistry';
import { getStoryPortraitAsset } from './StoryArtPreloader';
import { resolveStoryStageSlot } from './storyLayout';

interface StoryActorView {
  actorId: EnemyId;
  wrapper: Phaser.GameObjects.Container;
  portrait: Phaser.GameObjects.Image;
  focusGlow: Phaser.GameObjects.Ellipse;
  baseX: number;
  baseY: number;
  baseDepth: number;
  slot: IntroStageSlot;
  order: number;
  scriptedEntrance: boolean;
  revealed: boolean;
}

export class StoryCharacterStage {
  readonly container: Phaser.GameObjects.Container;
  private readonly actors = new Map<EnemyId, StoryActorView>();
  private readonly preset: IntroStagePreset;
  private entranceActive = false;
  private entranceTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, cast: IntroCastMember[], preset: IntroStagePreset = 'solo') {
    this.container = scene.add.container(0, 0);
    this.preset = preset;

    cast.forEach((member, order) => {
      const art = getEnemyCharacterArt(member.actorId);
      const storyPortrait = getStoryPortraitAsset(member.actorId);
      const textureKey = storyPortrait?.key ?? art?.asset.textureKey;
      if (!art || !textureKey || !scene.textures.exists(textureKey)) {
        return;
      }

      const slot = resolveStoryStageSlot(preset, member.slot);
      const height = slot.height * (member.scale ?? 1);
      const wrapper = scene.add.container(slot.x, slot.y)
        .setDepth(slot.depth)
        .setAlpha(0);
      const focusGlow = scene.add.ellipse(
        0,
        height * 0.02,
        height * 0.74,
        height * 0.84,
        0xd6a94f,
        0,
      ).setBlendMode(Phaser.BlendModes.ADD);
      const shadow = scene.add.ellipse(0, height * 0.34, height * 0.62, 34, 0x000000, 0.42);
      const frame = storyPortrait ? undefined : art.frames.idle;
      const sourceFrame = scene.textures.getFrame(textureKey, frame);
      const aspectRatio = sourceFrame ? sourceFrame.width / sourceFrame.height : 1;
      const portrait = scene.add.image(0, 0, textureKey, frame)
        .setDisplaySize(height * aspectRatio, height)
        .setOrigin(0.5);

      wrapper.add([focusGlow, shadow, portrait]);
      this.container.add(wrapper);
      this.actors.set(member.actorId, {
        actorId: member.actorId,
        wrapper,
        portrait,
        focusGlow,
        baseX: slot.x,
        baseY: slot.y,
        baseDepth: slot.depth,
        slot: member.slot,
        order,
        scriptedEntrance: member.entrance === 'scripted',
        revealed: member.entrance !== 'scripted',
      });

      scene.tweens.add({
        targets: portrait,
        y: -3,
        duration: 2600 + slot.depth * 140,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  playEntrance(): void {
    this.entranceActive = true;
    let latestEnd = 0;

    this.actors.forEach((actor) => {
      if (actor.scriptedEntrance) {
        return;
      }

      const entrance = this.getEntrance(actor);
      latestEnd = Math.max(latestEnd, entrance.delay + entrance.duration);
      this.animateEntrance(actor, entrance.delay);
    });

    this.entranceTimer?.remove(false);
    this.entranceTimer = this.container.scene.time.delayedCall(latestEnd || 1, () => {
      this.entranceActive = false;
      this.entranceTimer = undefined;
    });
  }

  revealActor(actorId: EnemyId, delay = 0): void {
    const actor = this.actors.get(actorId);
    if (!actor || actor.revealed) {
      return;
    }

    actor.revealed = true;
    this.animateEntrance(actor, delay);
  }

  revealActors(actorIds: EnemyId[], staggerMs = 180): void {
    actorIds.forEach((actorId, index) => {
      this.revealActor(actorId, index * staggerMs);
    });
  }

  focusTitle(): void {
    this.entranceActive = false;
    this.entranceTimer?.remove(false);
    this.entranceTimer = undefined;

    this.actors.forEach((actor) => {
      if (!actor.revealed) {
        return;
      }

      actor.wrapper.scene.tweens.killTweensOf(actor.wrapper);
      actor.wrapper.scene.tweens.killTweensOf(actor.focusGlow);
      actor.portrait.setTint(0x817b82);
      actor.wrapper.setDepth(actor.baseDepth);
      actor.wrapper.scene.tweens.add({
        targets: actor.wrapper,
        alpha: 0.44,
        scaleX: 0.985,
        scaleY: 0.985,
        x: actor.baseX,
        y: actor.baseY + 3,
        duration: 300,
        ease: 'Sine.easeOut',
      });
      actor.wrapper.scene.tweens.add({
        targets: actor.focusGlow,
        alpha: 0,
        duration: 220,
        ease: 'Sine.easeOut',
      });
    });

    this.container.sort('depth');
  }

  setSpeaker(speakerId?: EnemyId, immediate = false): void {
    if (!speakerId && this.entranceActive) {
      return;
    }

    if (speakerId && this.entranceActive) {
      this.entranceActive = false;
      this.entranceTimer?.remove(false);
      this.entranceTimer = undefined;
    }

    const hasSpeaker = Boolean(speakerId && this.actors.has(speakerId));

    this.actors.forEach((actor) => {
      if (!actor.revealed) {
        return;
      }

      const active = hasSpeaker && actor.actorId === speakerId;
      const targetAlpha = hasSpeaker ? (active ? 1 : 0.52) : 0.78;
      const targetScale = active ? 1.03 : hasSpeaker ? 0.99 : 1;
      const direction = actor.baseX < 640 ? 1 : -1;
      const targetX = actor.baseX + (active ? direction * 8 : 0);
      const targetY = actor.baseY + (active ? -2 : hasSpeaker ? 2 : 0);
      const glowAlpha = active ? 0.2 : 0;
      const glowScale = active ? 1.06 : 0.96;

      actor.portrait.setTint(active || !hasSpeaker ? 0xffffff : 0x85818b);
      actor.wrapper.setDepth(active ? 8 : actor.baseDepth);

      if (immediate) {
        actor.wrapper
          .setAlpha(targetAlpha)
          .setScale(targetScale)
          .setPosition(targetX, targetY);
        actor.focusGlow.setAlpha(glowAlpha).setScale(glowScale);
        return;
      }

      actor.wrapper.scene.tweens.killTweensOf(actor.wrapper);
      actor.wrapper.scene.tweens.killTweensOf(actor.focusGlow);
      actor.wrapper.scene.tweens.add({
        targets: actor.wrapper,
        alpha: targetAlpha,
        scaleX: targetScale,
        scaleY: targetScale,
        x: targetX,
        y: targetY,
        duration: 220,
        ease: 'Sine.easeOut',
      });
      actor.wrapper.scene.tweens.add({
        targets: actor.focusGlow,
        alpha: glowAlpha,
        scaleX: glowScale,
        scaleY: glowScale,
        duration: 260,
        ease: 'Sine.easeOut',
      });
    });

    this.container.sort('depth');
  }

  private animateEntrance(actor: StoryActorView, delay: number): void {
    const entrance = this.getEntrance(actor);
    actor.wrapper.scene.tweens.killTweensOf(actor.wrapper);
    actor.wrapper.setPosition(
      actor.baseX + entrance.offsetX,
      actor.baseY + entrance.offsetY,
    );
    actor.wrapper.setScale(entrance.startScale);
    actor.wrapper.setAlpha(0);
    actor.portrait.clearTint();

    actor.wrapper.scene.tweens.add({
      targets: actor.wrapper,
      x: actor.baseX,
      y: actor.baseY,
      scaleX: 1,
      scaleY: 1,
      alpha: 0.78,
      delay,
      duration: entrance.duration,
      ease: entrance.ease,
    });
  }

  private getEntrance(actor: StoryActorView): {
    offsetX: number;
    offsetY: number;
    startScale: number;
    delay: number;
    duration: number;
    ease: string;
  } {
    if (this.preset === 'bossEntrance') {
      const boss = actor.actorId === 'keeper';
      return {
        offsetX: boss ? 78 : -18,
        offsetY: boss ? 8 : 4,
        startScale: boss ? 0.96 : 0.99,
        delay: boss ? 760 : 140,
        duration: boss ? 980 : 620,
        ease: 'Sine.easeOut',
      };
    }

    if (this.preset === 'fullTable') {
      return {
        offsetX: 0,
        offsetY: 18,
        startScale: 0.97,
        delay: 100 + actor.order * 150,
        duration: 620,
        ease: 'Sine.easeOut',
      };
    }

    if (this.preset === 'duo') {
      const fromLeft = actor.slot.startsWith('left');
      return {
        offsetX: fromLeft ? -22 : 22,
        offsetY: 8,
        startScale: 0.98,
        delay: actor.slot.endsWith('Rear') ? 100 : 340,
        duration: 700,
        ease: 'Sine.easeOut',
      };
    }

    return {
      offsetX: actor.baseX < 640 ? -24 : 24,
      offsetY: 10,
      startScale: 0.98,
      delay: 180,
      duration: 760,
      ease: 'Sine.easeOut',
    };
  }
}
