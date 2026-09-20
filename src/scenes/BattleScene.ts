import { EndlessRunController } from '../game/endless/EndlessRunController';
import { playEndlessEnemyEntranceVfx } from '../ui/effects/EndlessEnemyEntranceVfx';
import { summarizeEndlessRun, type EndlessSettlementSummary, type EndlessSettlementReceipt } from '../game/endless/EndlessSettlement';
import { settleEndlessEconomy } from '../game/economy';
import { renderEndlessBattleHud } from '../ui/components/EndlessBattleHud';
import { renderEndlessResultModal } from '../ui/components/EndlessResultModal';
import { ENDLESS_CONFIG } from '../game/endless/EndlessConfig';
import { renderEndlessShopModal } from '../ui/components/EndlessShopModal';
import { MAX_BATTLE_ITEM_USES, remainingBattleItemUses, battleItemUseLimitReached, battleItemDescriptionKey } from '../game/battleItemPolicy';
import Phaser from 'phaser';
import { ENDLESS_NPC_ART_IDS } from '../game/data/npcOrigins';
import { playResonanceGather, playResonanceBloom } from '../ui/effects/ResonanceWeaponAccent';
import { playHanamiDanceVfx, type HanamiEffect } from '../ui/effects/passives/HanamiDanceVfx';
import { NinjaSmokeVfx } from '../ui/effects/passives/NinjaSmokeVfx';
import { GAME_FONT_FAMILY } from '../ui/themes/typography';
import { BattleEngine, type BattleCombatPresentationEvent, type BattlePresentationEvent } from '../game/engine';
import { preloadCardImages } from '../game/assets';
import { playBattleMusic, preloadBattleMusic, stopBattleMusic, stopLobbyMusic } from '../game/audio';
import { Card, formatCard } from '../game/card';
import { DEFAULT_ENEMY_IDS } from '../game/data/enemies';
import { chooseEnemySpeechKey } from '../game/data/enemySpeech';
import { getLevelById } from '../game/data/levelRegistry';
import { introIdForLevel } from '../game/data/levelIntros';
import { getTableThemeById } from '../game/data/tableThemes';
import { EconomyChange, settleBattleEconomy, settleReliefBattleEconomy, settleStoryBattleEconomy } from '../game/economy';
import { EnemyState, type EnemyType } from '../game/enemy';
import { enemyName, t } from '../game/i18n';
import { useBattleItem } from '../game/itemEffects';
import { ITEMS, ItemDefinition } from '../game/items';
import { consumeItem, getProgress, isStoryLevelCompleted } from '../game/progress';
import { ScoreResult, scoreHand } from '../game/scoring';
import { completeStoryLevelAndUnlockNext, getNextStoryLevel } from '../game/storyProgress';
import type { BattleState } from '../game/core/BattleState';
import type { BattleMechanicId } from '../game/types/level';
import type { ItemId } from '../game/types/item';
import type { EntryStakeMultiplier, TableThemeId, TableThemeVisualConfig } from '../game/types/tableTheme';
import { ActionPanel } from '../ui/components/ActionPanel';
import { BattleTutorialOverlay, type TutorialFocusArea } from '../ui/components/BattleTutorialOverlay';
import { AbilityOrbit } from '../ui/components/AbilityOrbit';
import { AbilitySlot } from '../ui/components/AbilitySlot';
import { BlockingMessageModal } from '../ui/components/BlockingMessageModal';
import { CharacterFrame } from '../ui/components/CharacterFrame';
import { EnemySpeechBubble, type EnemySpeechDirection } from '../ui/components/EnemySpeechBubble';
import { HandView, resolveHandItemPose } from '../ui/components/HandView';
import { SoulStoneMeter } from '../ui/components/SoulStoneMeter';
import { SoulCoinDisplay } from '../ui/components/SoulCoinDisplay';
import { ItemBar } from '../ui/components/ItemBar';
import { ItemPickerModal } from '../ui/components/items/ItemPickerModal';
import type { BattleItemCardState } from '../ui/components/items/BattleItemCardState';
import { MedievalButton, type MedievalButtonVariant } from '../ui/components/MedievalButton';
import { MedievalPanel } from '../ui/components/MedievalPanel';
import { MedievalTooltip } from '../ui/components/MedievalTooltip';
import { SkillBar } from '../ui/components/SkillBar';
import { StatusIconRow, type StatusIconState } from '../ui/components/StatusIconRow';
import { ScrollableGrid } from '../ui/catalog';
import {
  configureBattleArtTextures,
  configureBattleIconTextures,
  getBattleIconArt,
  getBattleIconArtByResourceKey,
  getBattleThemeArt,
  ITEM_CARD_FRAME_ART,
  getEnemyCharacterArt,
  getPortraitBackdrop,
  preloadBattleArt,
  preloadBattleIcons,
  SOUL_STONE_ART,
  type BattleArtSelection,
  type BattleIconId,
  type CharacterArtPose,
} from '../ui/art';
import { resolveBattleLayout, type BattleLayoutConfig } from '../ui/layout';
import { playDefaultFateAttackEffect, preloadDefaultFateAttackEffect } from '../ui/effects/DefaultFateAttackEffect';
import { playDragonGateEnemyAttackEffect } from '../ui/effects/DragonGateEnemyAttackEffect';
import { playEdoEnemyAttackEffect, preloadEdoEnemyAttackEffects } from '../ui/effects/EdoEnemyAttackEffect';
import { playEvernightEnemyAttackEffect, preloadEvernightEnemyAttackEffects } from '../ui/effects/EvernightEnemyAttackEffect';
import { playNorthernEnemyAttackEffect } from '../ui/effects/NorthernEnemyAttackEffect';
import { playSoulRedeemVfx } from '../ui/effects/SoulRedeemVfx';
import { playThunderHammerEffect, preloadThunderHammerEffect } from '../ui/effects/ThunderHammerEffect';
import { ItemEffectPresenter } from '../ui/effects/items/ItemEffectPresenter';
import {
  PassiveVfxDirector,
  playEinherjarSummonVfx,
  playGamblerBlessingVfx,
  playGoblinInstinctVfx,
  playHeavenlyInsightVfx,
  playDriftingParticleAura,
  playRedSilkToastVfx,
  playRuneBlessingVfx,
  playTalismanBurnVfx,
  playWarHornVfx,
  playWerewolfLifestealVfx,
} from '../ui/effects/passives';
import { createCardView } from '../ui/presentation/CardView';
import { applyCharacterPortraitPose, createCharacterPortrait } from '../ui/presentation/CharacterPortrait';
import { createCharacterPortraitBackdrop } from '../ui/presentation/CharacterPortraitBackdrop';
import {
  applyPlayerPortraitPose,
  createPlayerPortrait,
  type PlayerPortraitPose,
} from '../ui/presentation/PlayerPortrait';
import { createScoreBadge } from '../ui/presentation/ScoreBadge';
import { ProceduralTavernBackdrop } from '../ui/presentation/ProceduralTavernBackdrop';
import { renderBattleTableTheme, resolveTableThemeVisual } from '../ui/presentation/TableThemeRenderer';
import { canUseBattleItemFromState, createBattleUIState, type BattleActionButtonState, type BattleUIState } from '../ui/state/UIState';
import {
  createBattleStatusState,
  reconcileBattleStatusStates,
  type BattleStatusId,
} from '../ui/state/BattleStatusState';
import { getSelectedBattleVisualProfile, MEDIEVAL_UI_COLORS, type BattleVisualProfile } from '../ui/themes';

interface BattleUIColorSet {
  bg: number;
  panel: number;
  panelAlt: number;
  line: number;
  text: string;
  muted: string;
  accent: number;
  accentText: string;
  red: string;
  dangerText: string;
  resonance: string;
  green: string;
  button: number;
  buttonHover: number;
  danger: number;
}

const COLORS: BattleUIColorSet = {
  bg: 0x101114,
  panel: 0x1b1d22,
  panelAlt: 0x252832,
  line: 0x3b3f4c,
  text: '#f2f2ed',
  muted: '#aeb4c0',
  accent: 0xe8cf73,
  accentText: '#e8cf73',
  red: '#ef6f6c',
  dangerText: '#ff4b5f',
  resonance: '#ffd86b',
  green: '#78d18a',
  button: 0x303542,
  buttonHover: 0x41495b,
  danger: 0x734143,
};

const SKILL_COLORS = {
  player: 0xffb84d,
  bartender: 0xe8cf73,
  goblin: 0x65d46e,
  gambler: 0xf25f9a,
  werewolf: 0x73c7ff,
  paladin: 0xf4e7b0,
  merchant: 0xe2c16b,
  keeper: 0xd7b56d,
  viking_warrior: 0xff8a3d,
  rune_shaman: 0x79c9ff,
  valkyrie: 0xf7d889,
  einherjar: 0xaeb9c9,
  swordsman: 0xf05f42,
  songstress: 0xf29bc2,
  taoist: 0x72d8b3,
  shogun_samurai: 0xe15f58,
  ninja: 0x8e78bb,
  oiran: 0xf09ab5,
};

const PASSIVE_EFFECT_TIMING = {
  stepGap: 150,
  flashIn: 190,
  flashHold: 430,
  flashOut: 760,
  standardTotal: 1400,
  goblinTotal: 1520,
  shockwave: 1040,
  insightLine: 1080,
  shuffleCard: 1040,
  bloodReturn: 920,
};

const REVEAL_SHADE_ALPHA = 0.24;
const JADE_SWORD_TEXTURE_KEY = 'effect-player-jade-sword';
const JADE_SWORD_TEXTURE_PATH = '/image/battle/effects/player/jade-sword.png';
const SAKURA_KATANA_TEXTURE_KEY = 'effect-player-sakura-katana';
const SAKURA_KATANA_TEXTURE_PATH = '/image/battle/effects/player/sakura-katana.png';

export class BattleScene extends Phaser.Scene {
  private graduationTutorialStep = 0;
  private graduationTargets = new Map<string, TutorialFocusArea>();
  private battleLayout: BattleLayoutConfig = resolveBattleLayout({ width: 1280, height: 720, target: 'pc' });
  private battleArtSelection: BattleArtSelection = {
    themeId: 'evernight_tavern',
    enemyIds: DEFAULT_ENEMY_IDS,
  };
  private battle!: BattleEngine;
  private ninjaSmoke?: NinjaSmokeVfx;
  private ninjaSmokeInstanceId?: string;
  private battleEconomySettled = false;
  private economyResult?: EconomyChange;
  private resultModalReady = true;
  private itemModalOpen = false;
  private endlessShopMessage?: string;
  private endlessController?: EndlessRunController;
  private endlessSaveError?: string;
  private confirmExitEndless = false;
  private endlessSettlementPending = false;
  private endlessSettlementError?: string;
  private endlessSettlementSummary?: EndlessSettlementSummary;
  private endlessSettlementReceipt?: EndlessSettlementReceipt;
  private selectedBattleItemId?: ItemId;
  private itemModalPage = 0;
  private itemModalHasAnimated = false;
  private battleLogOpen = false;
  private cleanMode = false;
  private battleLogGrid?: ScrollableGrid<{ message: string; empty?: boolean }>;
  private confirmReturnToStorySelect = false;
  private confirmExitFormalGame = false;
  private itemFeedback?: { title: string; message: string; success: boolean };
  private temporaryItems: Partial<Record<ItemId, number>> = {};
  private battleItemUses = 0;
  private battleItemUseCounts: Partial<Record<ItemId, number>> = {};
  private grantedItemRoundIds = new Set<string>();
  private dealing = false;
  private playerRedealing = false;
  private actionDealing = false;
  private lastResonanceImpactAt = -Infinity;
  private autoAdvancingRound = false;
  private stageBannerPlaying = false;
  private actionAnimationPlaying = false;
  private presentationSequencePlaying = false;
  private revealFocusPlaying = false;
  private revealFocusPendingEnemyIds = new Set<string>();
  private dealingRound = 0;
  private dealtPlayerCards = 0;
  private dealtEnemyCards = [0, 0, 0];
  private observedPlayerResonanceRound = 0;
  private observedPlayerResonanceMultiplier = 1;
  private pendingPlayerResonanceFeedback?: { label: string; multiplier: number; strong: boolean; boom: boolean };
  private playerResonancePopup?: Phaser.GameObjects.Container;
  private playerResonanceShade?: Phaser.GameObjects.Rectangle;
  private resonanceShakeKeys = new Set<string>();
  private visualHpOverride?: { player: number; enemies: number[] };
  private visualEnemyDefeated?: boolean[];
  private visualPlayerShieldChargesOverride?: number;
  private itemEffectPlayerHandHidden = false;
  private itemEffectPlayerHandRevealed = false;
  private hiddenRoundAttackBonusEnemyIds = new Set<string>();
  private hiddenPermanentAttackBonusEnemyIds = new Set<string>();
  private hiddenSummonedEnemyIds = new Set<string>();
  private enteringEnemyInstances = new Map<string, { alpha: number; offsetY: number }>();
  private hiddenHanamiFanTargetIds = new Set<string>();
  private hiddenTaoistTalismanTargetIds = new Set<string>();
  private statusSnapshots = new Map<string, Map<BattleStatusId, StatusIconState>>();
  private lastEnemySpeechKeys = new Map<string, string>();
  private enemySpeechBubble?: EnemySpeechBubble;
  private playerSoulStoneMeter?: SoulStoneMeter;
  private playerFrameContainer?: Phaser.GameObjects.Container;
  private playerPortrait?: Phaser.GameObjects.Image;
  private playerPortraitPose: PlayerPortraitPose = 'idle';
  private playerPortraitResetTimer?: Phaser.Time.TimerEvent;
  private enemyPortraits = new Map<number, Phaser.GameObjects.Image>();
  private enemyFrameContainers = new Map<number, Phaser.GameObjects.Container>();
  private enemyPortraitPoses = new Map<number, CharacterArtPose>();
  private enemyPortraitResetTimers = new Map<number, Phaser.Time.TimerEvent>();
  private enemyPortraitEnemyIds = new Map<number, string>();
  private enemySoulStoneMeters = new Map<string, SoulStoneMeter>();
  private ui: Phaser.GameObjects.Container[] = [];
  private seatContainers = new Map<string, Phaser.GameObjects.Container>();
  private blockingMessage?: { title: string; body: string; buttonLabel: string; onClose?: () => void };
  private shownLessonRoundIds = new Set<string>();
  private shownCompareHintKeys = new Set<string>();
  private shownRevealDialogueRoundIds = new Set<string>();
  private shownInviteDialogueIds = new Set<string>();
  private shownPlayerTurnLessonRoundIds = new Set<string>();
  private shownLevelIntroLesson = false;
  private shownResultStory = false;
  private chapter3TauntIndex = 0;
  private chapter3ConsecutiveLosses = 0;
  private chapter3LossHintShown = false;
  private shownChapter4ResonanceFeedbackIds = new Set<string>();
  private battleLevelId?: string;
  private tableThemeId?: TableThemeId;
  private battleMode?: 'story' | 'formal' | 'endless';
  private initialEnemyIds?: EnemyType[];
  private endlessRunId?: string;
  private endlessSeed?: number;
  private stakeMultiplier: EntryStakeMultiplier = 1;
  private reliefMode = false;
  private battleVisualProfile: BattleVisualProfile = getSelectedBattleVisualProfile();
  private proceduralTavernBackdrop?: ProceduralTavernBackdrop;
  private readonly passiveVfxDirector = new PassiveVfxDirector();
  private itemEffectPresenter!: ItemEffectPresenter;

  constructor() {
    super('BattleScene');
    this.passiveVfxDirector.register('goblin_instinct', playGoblinInstinctVfx);
    this.passiveVfxDirector.register('gambler_blessing', playGamblerBlessingVfx);
    this.passiveVfxDirector.register('werewolf_lifesteal', playWerewolfLifestealVfx);
    this.passiveVfxDirector.register('war_horn', playWarHornVfx);
    this.passiveVfxDirector.register('rune_blessing', playRuneBlessingVfx);
    this.passiveVfxDirector.register('einherjar_summon', playEinherjarSummonVfx);
  }

  preload(): void {
    preloadBattleMusic(this);
    preloadCardImages(this);
    preloadBattleIcons(this);
    preloadDefaultFateAttackEffect(this);
    preloadThunderHammerEffect(this);
    if (!this.textures.exists(JADE_SWORD_TEXTURE_KEY)) {
      this.load.image(JADE_SWORD_TEXTURE_KEY, JADE_SWORD_TEXTURE_PATH);
    }
    if (!this.textures.exists(SAKURA_KATANA_TEXTURE_KEY)) {
      this.load.image(SAKURA_KATANA_TEXTURE_KEY, SAKURA_KATANA_TEXTURE_PATH);
    }
    preloadEvernightEnemyAttackEffects(this);
    preloadEdoEnemyAttackEffects(this);
    this.battleArtSelection = this.resolveBattleArtSelection();
    SoulCoinDisplay.preload(this, this.battleArtSelection.themeId !== 'evernight_tavern');
    preloadBattleArt(this, this.battleArtSelection);
    if (this.battleMode === 'endless' && !this.textures.exists(ENDLESS_CONFIG.backgroundTextureKey)) {
      this.load.image(ENDLESS_CONFIG.backgroundTextureKey, ENDLESS_CONFIG.backgroundPath);
    }

    if (!this.cache.audio.exists('cardSlide')) {
      this.load.audio('cardSlide', '/audio/card-slide-2.ogg');
    }

    if (!this.cache.audio.exists('buttonClick')) {
      this.load.audio('buttonClick', '/audio/switch28.ogg');
    }

    if (!this.cache.audio.exists('cardPlace')) {
      this.load.audio('cardPlace', '/audio/card-place-1.ogg');
    }

    if (!this.cache.audio.exists('attackFire')) {
      this.load.audio('attackFire', '/audio/fire-ball.wav');
    }

    if (!this.cache.audio.exists('attackWind')) {
      this.load.audio('attackWind', '/audio/wind-attack.wav');
    }

    if (!this.cache.audio.exists('damageExplosion')) {
      this.load.audio('damageExplosion', '/audio/explosion.wav');
    }

    if (!this.cache.audio.exists('resonanceEcho')) {
      this.load.audio('resonanceEcho', '/audio/echo.wav');
    }

    if (!this.cache.audio.exists('healSound')) {
      this.load.audio('healSound', '/audio/poison.wav');
    }

    if (!this.cache.audio.exists('beerBubble')) {
      this.load.audio('beerBubble', '/audio/bubble.wav');
    }

    if (!this.cache.audio.exists('fateHorn')) {
      this.load.audio('fateHorn', '/audio/horn.wav');
    }
  }

  init(data?: { levelId?: string; tableThemeId?: TableThemeId; stakeMultiplier?: EntryStakeMultiplier; reliefMode?: boolean; mode?: 'story' | 'formal' | 'endless'; enemyIds?: EnemyType[]; runId?: string; seed?: number }): void {
    this.battleMode = data?.mode;
    this.initialEnemyIds = data?.enemyIds;
    this.endlessRunId = data?.runId;
    this.endlessSeed = data?.seed;
    this.battleLevelId = data?.levelId;
    this.tableThemeId = data?.tableThemeId;
    this.stakeMultiplier = data?.stakeMultiplier ?? 1;
    this.reliefMode = data?.reliefMode ?? false;
    this.battleVisualProfile = getSelectedBattleVisualProfile();
  }

  create(): void {
    this.endlessSaveError = undefined;
    if (this.battleMode !== 'endless') { this.createBattle(); return; }
    this.add.text(640, 360, t('endless.save.loading'), { fontFamily: GAME_FONT_FAMILY, fontSize: '22px', color: '#edbd80' }).setOrigin(0.5);
    void EndlessRunController.acquire(this.endlessRunId ?? '').then((result) => {
      if (!this.sys.isActive()) { if (result.status === 'acquired') result.controller.release(); return; }
      this.children.removeAll(true);
      if (result.status !== 'acquired') { this.showEndlessLoadError(result.status); return; }
      this.endlessController = result.controller;
      this.createBattle(result.controller);
    }).catch(() => this.showEndlessLoadError('storage-unavailable'));
  }

  private showEndlessLoadError(reason: string): void {
    this.children.removeAll(true);
    this.add.text(640, 310, t(`endless.save.${reason}`), { fontFamily: GAME_FONT_FAMILY, fontSize: '22px', color: '#edbd80',
      align: 'center', wordWrap: { width: 660, useAdvancedWrap: true } }).setOrigin(0.5);
    MedievalButton.render(this, { x: 510, y: 390, width: 260, height: 48, label: t('battle.result.returnLobby'),
      onActivate: () => this.scene.start('StartScene') });
  }

  private createBattle(controller?: EndlessRunController): void {
    this.resetTransientPresentationState();
    this.lastResonanceImpactAt = -Infinity;
    this.battleLayout = resolveBattleLayout({
      width: Number(this.scale.gameSize.width),
      height: Number(this.scale.gameSize.height),
      target: 'auto',
    });
    stopLobbyMusic(this);
    playBattleMusic(this);
    configureBattleArtTextures(this, this.battleArtSelection);
    configureBattleIconTextures(this);
    this.itemEffectPresenter = new ItemEffectPresenter(this);
    const release = () => controller?.release();
    if (controller && typeof window !== 'undefined') window.addEventListener('pagehide', release);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', release);
      release();
      this.ninjaSmoke?.destroy();
      this.ninjaSmoke = undefined;
      this.enemySpeechBubble?.destroy();
      this.enemySpeechBubble = undefined;
      this.itemEffectPresenter.destroy();
      this.proceduralTavernBackdrop?.destroy();
      this.proceduralTavernBackdrop = undefined;
      stopBattleMusic(this);
    });
    const restoringEndless = !!controller?.session.snapshot;
    const tableThemeConfig = this.tableThemeId ? getTableThemeById(this.tableThemeId) : undefined;
    this.battle = new BattleEngine({
      mode: this.battleMode, enemyIds: this.initialEnemyIds, runId: this.endlessRunId, endlessSeed: controller?.session.seed ?? this.endlessSeed, endlessSnapshot: controller?.session.snapshot,
      startingSupplyCoins: controller?.session.startingSupplyCoins ?? 0,
      levelId: this.battleLevelId,
      tableThemeConfig,
      stakeMultiplier: tableThemeConfig ? this.stakeMultiplier : undefined,
    });
    if (controller) {
      this.battle.configureEndlessPersistence({ before: controller.before, commit: controller.commit,
        onError: (error) => { this.endlessSaveError = error instanceof Error ? error.message : 'storage-unavailable'; } });
      try { if (!controller.session.snapshot) controller.commit(this.battle.exportEndlessSnapshot()); }
      catch { controller.release(); this.showEndlessLoadError('storage-unavailable'); return; }
      this.time.addEvent({ delay: 5000, loop: true, callback: () => {
        if (!this.battleEconomySettled && !controller.renew()) {
          this.endlessSaveError = 'stale'; this.render();
        }
      } });
    }
    this.dealing = false; this.playerRedealing = false; this.actionDealing = false;
    this.stageBannerPlaying = false; this.actionAnimationPlaying = false; this.revealFocusPlaying = false;
    this.visualHpOverride = undefined;
    this.battleEconomySettled = false;
    this.economyResult = undefined;
    this.resultModalReady = true;
    this.autoAdvancingRound = false;
    this.presentationSequencePlaying = false;
    this.itemEffectPlayerHandHidden = false;
    this.itemEffectPlayerHandRevealed = false;
    this.confirmReturnToStorySelect = false;
    this.confirmExitFormalGame = false;
    this.battleLogOpen = false;
    this.selectedBattleItemId = undefined;
    this.itemModalPage = 0;
    this.itemModalHasAnimated = false;
    this.battleLogGrid?.destroy();
    this.battleLogGrid = undefined;
    this.blockingMessage = undefined;
    this.temporaryItems = {};
    this.endlessShopMessage = undefined;
    this.confirmExitEndless = false;
    this.endlessSettlementPending = false;
    this.endlessSettlementError = undefined;
    this.endlessSettlementSummary = undefined;
    this.endlessSettlementReceipt = undefined;
    this.battleItemUses = 0;
    this.battleItemUseCounts = {};
    this.grantedItemRoundIds.clear();
    this.resonanceShakeKeys.clear();
    this.observedPlayerResonanceRound = 0;
    this.observedPlayerResonanceMultiplier = 1;
    this.pendingPlayerResonanceFeedback = undefined;
    this.playerResonancePopup?.destroy(true);
    this.playerResonancePopup = undefined;
    this.playerResonanceShade?.destroy();
    this.playerResonanceShade = undefined;
    this.shownLessonRoundIds.clear();
    this.shownCompareHintKeys.clear();
    this.shownRevealDialogueRoundIds.clear();
    this.shownInviteDialogueIds.clear();
    this.shownPlayerTurnLessonRoundIds.clear();
    this.shownLevelIntroLesson = false;
    this.graduationTutorialStep = 0;
    this.shownResultStory = false;
    this.chapter3TauntIndex = 0;
    this.chapter3ConsecutiveLosses = 0;
    this.chapter3LossHintShown = false;
    this.shownChapter4ResonanceFeedbackIds.clear();
    this.hiddenRoundAttackBonusEnemyIds.clear();
    this.hiddenPermanentAttackBonusEnemyIds.clear();
    this.hiddenSummonedEnemyIds.clear();
    this.hiddenHanamiFanTargetIds.clear();
    this.hiddenTaoistTalismanTargetIds.clear();
    this.statusSnapshots.clear();
    this.lastEnemySpeechKeys.clear();
    this.enemySpeechBubble?.destroy();
    this.enemySpeechBubble = undefined;
    this.playerPortraitPose = 'idle';
    this.playerPortraitResetTimer?.remove(false);
    this.playerPortraitResetTimer = undefined;
    this.enemyPortraitResetTimers.forEach((timer) => timer.remove(false));
    this.enemyPortraitResetTimers.clear();
    this.enemyPortraitPoses.clear();
    this.enemyPortraits.clear();
    this.enemyPortraitEnemyIds.clear();
    if (this.battle.endlessLedger?.shop.isOpeningVisit) this.render();
    else if (restoringEndless) this.resumeEndlessPresentation();
    else this.playRoundStartBannerThenDeal();
  }

  private resumeEndlessPresentation(): void {
    this.battle.clearPendingPresentationEvents();
    this.dealtPlayerCards = this.battle.player.hand.length;
    this.dealtEnemyCards = this.battle.enemies.map(enemy => enemy.hand.length);
    const ninjaIndex = this.battle.enemies.findIndex(enemy => enemy.id === 'ninja' && enemy.smokeScreenArmed && !enemy.defeated);
    if (ninjaIndex >= 0) {
      const source = this.enemySeatCenter(ninjaIndex), hud = this.enemyHudLayout(ninjaIndex);
      this.ninjaSmoke = new NinjaSmokeVfx(this, source.x, source.y, Math.min(hud.portrait.width, hud.portrait.height) / 2);
      this.ninjaSmokeInstanceId = this.battle.enemies[ninjaIndex].instanceId;
    }
    if (this.battle.pendingItemReveal) this.battle.execute({ type: 'reveal-by-item' });
    this.battle.clearPendingPresentationEvents();
    if (this.endlessSaveError) { this.render(); return; }
    if (this.hasPendingSoulRedeem()) { this.playPendingSoulRedeemBannerThen(); return; }
    this.render();
  }

  private resetTransientPresentationState(): void {
    this.enteringEnemyInstances.clear();
    this.itemModalOpen = false;
    this.itemFeedback = undefined;
    this.visualHpOverride = undefined;
    this.visualEnemyDefeated = undefined;
    this.visualPlayerShieldChargesOverride = undefined;
    this.revealFocusPendingEnemyIds.clear();
    this.dealingRound = 0;
    this.dealtPlayerCards = 0;
    this.dealtEnemyCards = [0, 0, 0];
    this.ninjaSmokeInstanceId = undefined;
    this.ui = [];
    this.seatContainers.clear();
    this.enemyFrameContainers.clear();
    this.enemySoulStoneMeters.clear();
    this.playerSoulStoneMeter = undefined;
    this.playerFrameContainer = undefined;
    this.playerPortrait = undefined;
  }

  private render(): void {
    if (this.ninjaSmoke && (!this.battle.enemies.some((enemy) => enemy.instanceId === this.ninjaSmokeInstanceId)
      || !this.actionAnimationPlaying && !this.presentationSequencePlaying
        && (this.battle.phase === 'battle-result' || !this.battle.enemies.some((enemy) => enemy.instanceId === this.ninjaSmokeInstanceId && !enemy.defeated)))) {
      this.ninjaSmoke.destroy();
      this.ninjaSmoke = undefined;
    }
    this.settleEconomyIfNeeded();
    this.grantFixedRoundItemsIfNeeded();
    this.battleLogGrid?.destroy();
    this.battleLogGrid = undefined;
    this.ui.forEach((item) => {
      if (item.scene) {
        item.destroy(true);
      }
    });
    this.ui = [];
    [...this.children.getChildren()].forEach((item) => {
      if (
        item !== this.proceduralTavernBackdrop?.container
        && !item.getData('statusFloatingText')
        && item !== this.playerResonancePopup
        && item !== this.playerResonanceShade
        && item !== this.ninjaSmoke?.container
        && item !== this.enemySpeechBubble?.container
        && item.scene
      ) {
        item.destroy();
      }
    });
    this.seatContainers.clear();
    const statusOwners = new Set(['player', ...this.battle.enemies.map((enemy) => `enemy:${enemy.instanceId}`)]);
    for (const owner of this.statusSnapshots.keys()) if (!statusOwners.has(owner)) this.statusSnapshots.delete(owner);
    this.graduationTargets.clear();
    this.playerSoulStoneMeter = undefined;
    this.playerFrameContainer = undefined;
    this.playerPortrait = undefined;
    this.enemyPortraits.clear();
    this.enemyFrameContainers.clear();
    this.enemySoulStoneMeters.clear();

    this.addBackground();
    if (this.battle.mode === 'endless') this.renderEndlessHud();
    else SoulCoinDisplay.render(this, { x: 1122, y: 48, value: getProgress().soulCoins, depth: 45 });
    this.renderEnemies();
    this.renderCenterInfo();
    this.renderPlayer();
    this.renderBattleLogButton();
    this.renderStoryReturnButton();
    this.renderFormalExitButton();
    this.renderPlayerCommandBar();
    this.renderItemModal();
    this.renderEndlessShop();
    this.renderItemFeedback();
    this.renderResultModal();
    this.renderStoryReturnConfirmModal();
    this.renderFormalExitConfirmModal();
    this.renderEndlessExitConfirm();
    this.renderBlockingMessage();
    this.flushPlayerResonanceFeedback();
    this.renderEndlessSaveError();
    this.renderBattleLogModal();
    this.renderGraduationTutorial();
  }

  private renderEndlessSaveError(): void {
    if (!this.endlessSaveError) return;
    const root = this.add.container(640, 360).setDepth(220);
    root.add(this.add.rectangle(0, 0, 1280, 720, 0x030304, 0.9).setInteractive());
    root.add(this.add.text(0, -70, t(`endless.save.${this.endlessSaveError}`), {
      fontFamily: GAME_FONT_FAMILY, fontSize: '22px', color: '#edbd80', align: 'center',
      wordWrap: { width: 700, useAdvancedWrap: true } }).setOrigin(0.5));
    root.add(MedievalButton.render(this, { x: -270, y: 20, width: 250, height: 48, label: t('endless.save.retry'),
      onActivate: () => this.scene.restart({ mode: 'endless', runId: this.endlessRunId, seed: this.endlessSeed }) }));
    root.add(MedievalButton.render(this, { x: 20, y: 20, width: 250, height: 48, label: t('battle.result.returnLobby'),
      onActivate: () => this.scene.start('StartScene') }));
    this.ui.push(root);
  }

  private addBackground(): void {
    if (this.battle.mode === 'endless') {
      this.add.image(640, 360, ENDLESS_CONFIG.backgroundTextureKey).setDisplaySize(1280, 720).setDepth(-10);
      this.add.rectangle(640, 360, 1280, 720, 0x000000, ENDLESS_CONFIG.backgroundShadeOpacity).setDepth(-9);
      return;
    }
    if (this.battleVisualProfile.renderer === 'procedural_tavern' && this.battleVisualProfile.tavern) {
      this.proceduralTavernBackdrop ??= new ProceduralTavernBackdrop(
        this,
        this.battleLayout,
        this.battleVisualProfile.tavern,
        this.battle.enemies.length,
      );
      return;
    }

    renderBattleTableTheme(
      this,
      this.battle.tableThemeConfig?.visual,
      getBattleThemeArt(this.battleArtSelection.themeId),
    );
  }

  private currentThemeVisual(): TableThemeVisualConfig {
    const visual = resolveTableThemeVisual(this.battle.tableThemeConfig?.visual);
    const tavern = this.battleVisualProfile.tavern;
    if (this.battleVisualProfile.renderer !== 'procedural_tavern' || !tavern) {
      return visual;
    }

    return {
      ...visual,
      accentColor: tavern.resonance,
      enemyFrameColor: tavern.woodLight,
      glowColor: '#ffb45f',
      backgroundColor: tavern.background,
      panelColor: tavern.panel,
      panelAltColor: tavern.panelAlt,
      lineColor: tavern.woodLight,
      tableColor: tavern.cloth,
      tableRingColor: tavern.clothEdge,
    };
  }

  private currentUIColors(): BattleUIColorSet {
    const tavern = this.battleVisualProfile.tavern;
    if (this.battleVisualProfile.renderer !== 'procedural_tavern' || !tavern) {
      return COLORS;
    }

    return {
      ...COLORS,
      bg: tavern.background,
      panel: tavern.panel,
      panelAlt: tavern.panelAlt,
      line: tavern.woodLight,
      text: '#f5ead9',
      muted: '#b8a795',
      accent: tavern.resonance,
      accentText: '#f2d98a',
      button: 0x35241f,
      buttonHover: 0x51352a,
      danger: 0x6a3030,
    };
  }

  private resolveBattleArtSelection(): BattleArtSelection {
    const tableTheme = this.tableThemeId ? getTableThemeById(this.tableThemeId) : undefined;
    const level = this.battleLevelId ? getLevelById(this.battleLevelId) : undefined;
    return {
      themeId: tableTheme?.id ?? 'evernight_tavern',
      enemyIds: [...(this.battleMode === 'endless' ? ENDLESS_NPC_ART_IDS : level?.enemyIds ?? tableTheme?.enemyIds ?? DEFAULT_ENEMY_IDS)],
      preloadAllNpcArt: this.battleMode === 'endless',
    };
  }

  private renderEnemies(): void {
    const visual = this.currentThemeVisual();
    this.battle.enemies.forEach((enemy, index) => {
      const themeArt = getBattleThemeArt(enemy.sourceThemeId);
      const seat = this.enemySeatForIndex(index);
      const hud = this.enemyHudLayout(index);
      const container = this.add.container(seat.x, seat.y);
      const entrance = this.enteringEnemyInstances.get(enemy.instanceId);
      if (entrance) container.setAlpha(entrance.alpha).setY(seat.y + entrance.offsetY);
      const summonConcealed = this.hiddenSummonedEnemyIds.has(enemy.id);
      if (summonConcealed) {
        container.setAlpha(0);
      }
      this.ui.push(container);
      this.seatContainers.set(enemy.id, container);
      const active = this.battle.currentEnemyIndex === index && this.battle.phase === 'enemy-turn';
      const displayDefeated = this.enemyDisplayDefeated(index);
      const portraitArt = getEnemyCharacterArt(enemy.id);
      const portraitBackdrop = getPortraitBackdrop(enemy.sourceThemeId, enemy.id);
      const frame = new CharacterFrame(this, {
        x: hud.portrait.x,
        y: hud.portrait.y,
        width: hud.portrait.width,
        height: hud.portrait.height,
        accentColor: visual.enemyFrameColor,
        backgroundColor: this.battleVisualProfile.renderer === 'procedural_tavern'
          ? this.battleVisualProfile.tavern?.panel
          : undefined,
        skin: this.battleVisualProfile.renderer === 'procedural_tavern' ? undefined : themeArt.enemyFrame,
        shape: 'circle',
        backdrop: this.battleVisualProfile.renderer === 'procedural_tavern' ? 'none' : 'diamond',
        active,
        muted: displayDefeated,
      });
      container.add(frame.container);
      this.enemyFrameContainers.set(index, frame.container);

      let portraitRendered = false;
      if (portraitBackdrop) {
        frame.addPortraitBackdrop(createCharacterPortraitBackdrop(
          this,
          portraitBackdrop,
          0,
          0,
          hud.portrait.width - 8,
          hud.portrait.height - 8,
        ));
      }
      if (portraitArt) {
        if (this.enemyPortraitEnemyIds.get(index) !== enemy.instanceId) {
          this.enemyPortraitResetTimers.get(index)?.remove(false);
          this.enemyPortraitResetTimers.delete(index);
          this.enemyPortraitPoses.set(index, 'idle');
          this.enemyPortraitEnemyIds.set(index, enemy.instanceId);
        }
        const portraitPose = displayDefeated ? 'hurt' : (this.enemyPortraitPoses.get(index) ?? 'idle');
        const portrait = createCharacterPortrait(
          this,
          portraitArt,
          portraitPose,
          0,
          0,
          portraitBackdrop,
        );
        if (portrait) {
          portrait.setAlpha(1);
          this.enemyPortraits.set(index, portrait);
          frame.addPortrait(portrait);
          portraitRendered = true;
        }
      }

      if (!portraitRendered) {
        const fallback = this.add.text(0, 0, enemyName(enemy.id).slice(0, 1), {
          fontFamily: GAME_FONT_FAMILY,
          fontSize: '40px',
          color: displayDefeated ? this.currentUIColors().muted : visual.glowColor,
          fontStyle: 'bold',
        }).setOrigin(0.5);
        if (!displayDefeated) {
          fallback.setShadow(0, 0, visual.glowColor, 10, true, true);
        }
        frame.addPortrait(fallback);
      }

      const name = this.add.text(hud.name.x, hud.name.y, enemyName(enemy.id), {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '14px',
        color: displayDefeated ? this.currentUIColors().muted : visual.glowColor,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      if (!displayDefeated) {
        name.setShadow(0, 0, visual.glowColor, 6, true, true);
      }
      container.add(name);

      const soulStoneMeter = new SoulStoneMeter(this, {
        x: hud.portrait.x,
        y: hud.portrait.y,
        hp: this.enemyDisplayHp(index),
        maxHp: enemy.maxHp,
        stoneSize: 30,
        spacing: 25,
        arcRadius: 84,
        muted: displayDefeated,
        onShowTooltip: () => this.showSkillTooltip(
          seat.x + hud.portrait.x,
          seat.y + hud.portrait.y - 108,
          t('common.health'),
          t('common.hp', { hp: this.enemyDisplayHp(index), maxHp: enemy.maxHp }),
        ),
        onHideTooltip: () => this.hideSkillTooltip(),
      });
      this.enemySoulStoneMeters.set(enemy.id, soulStoneMeter);
      container.add(soulStoneMeter.container);

      const handX = this.enemyHandCenterX(index, enemy.hand.length);
      const hand = this.renderEnemyCardRow(container, enemy, index, handX, hud.hand.y);

      if (this.shouldShowEnemyScore(enemy)) {
        const direction = hud.scoreSide === 'right' ? 1 : -1;
        const scoreX = handX + direction * ((hand?.rightEdge ?? 0) + hud.scoreGap);
        this.renderScoreBadge(container, scoreX, hud.hand.y, this.scoreEnemy(enemy), true, this.hasMechanic('resonance'));
      }

      if (this.hasMechanic('enemy_passives') && this.enemyHasPassiveInfo(enemy)) {
        this.graduationTargets.set(`passive:${enemy.id}`, {
          x: seat.x + hud.portrait.x + (hud.passivePosition.endsWith('left') ? -hud.orbitRadiusX : hud.orbitRadiusX),
          y: seat.y + hud.portrait.y + (hud.passivePosition.startsWith('top') ? -hud.orbitRadiusY : hud.orbitRadiusY),
          width: 54, height: 54,
        });
        const orbit = new AbilityOrbit(this, {
          x: hud.portrait.x,
          y: hud.portrait.y,
          radiusX: hud.orbitRadiusX,
          radiusY: hud.orbitRadiusY,
        });
        orbit.addContainer(hud.passivePosition, this.enemyPassiveIcon(enemy, index, hud));
        container.add(orbit.container);
      }
      this.renderEnemyStatusBadges(container, enemy, index, hud);
    });
  }

  private renderEnemyStatusBadges(
    container: Phaser.GameObjects.Container,
    enemy: EnemyState,
    index: number,
    layout: BattleLayoutConfig['enemyHud']['left'],
  ): void {
    if (enemy.defeated) {
      return;
    }

    const statuses: StatusIconState[] = [];
    if (enemy.id === 'shogun_samurai' && enemy.iaijutsuStacks > 0) {
      statuses.push(createBattleStatusState('iaijutsu', {
        title: t('battle.status.iaijutsu', { amount: enemy.iaijutsuStacks }),
        description: t('skill.iaijutsuCharge.tooltip'),
        stacks: enemy.iaijutsuStacks,
      }));
    }

    if (enemy.id === 'ninja' && enemy.smokeScreenArmed) {
      statuses.push(createBattleStatusState('smoke-evasion', {
        title: t('battle.status.smokeScreen'),
        description: t('skill.smokeSubstitution.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
      }));
    }

    const oiran = this.battle.enemies.find((candidate) => candidate.id === 'oiran' && !candidate.defeated);
    if (oiran?.hanamiFanTargetInstanceId === enemy.instanceId && !this.hiddenHanamiFanTargetIds.has(enemy.id)) {
      statuses.push(createBattleStatusState('hanami-fan', {
        title: t('battle.status.hanamiFan'),
        description: t('skill.hanamiDance.tooltip'),
      }));
    }

    if (enemy.taoistTalismaned && !this.hiddenTaoistTalismanTargetIds.has(enemy.id)) {
      statuses.push(createBattleStatusState('taoist-talisman', {
        title: t('battle.passive.talismaned'),
        description: t('skill.heavenlyInsight.tooltip'),
      }));
    }

    const visibleRoundAttackBonus = this.hiddenRoundAttackBonusEnemyIds.has(enemy.id) ? 0 : enemy.roundAttackBonus;
    const visiblePermanentAttackBonus = Math.max(
      0,
      enemy.attackBonus - (this.hiddenPermanentAttackBonusEnemyIds.has(enemy.id) ? 1 : 0),
    );
    const attackBonus = Math.max(0, visiblePermanentAttackBonus + visibleRoundAttackBonus);
    if (attackBonus > 0) {
      const title = t('battle.status.attackBonus', { amount: attackBonus });
      statuses.push(createBattleStatusState('attack-bonus', {
        title,
        description: title,
        stacks: attackBonus,
      }));
    }

    const presentedStatuses = this.statusStatesForPresentation(`enemy:${enemy.instanceId}`, statuses);
    if (presentedStatuses.length === 0) {
      return;
    }

    const seat = this.enemySeatForIndex(index);
    const row = new StatusIconRow(this, {
      x: layout.statuses.x,
      y: layout.statuses.y,
      statuses: presentedStatuses,
      variant: 'compact',
      onShowTooltip: (x, y, title, description) => this.showSkillTooltip(seat.x + x, seat.y + y, title, description),
      onHideTooltip: () => this.hideSkillTooltip(),
    });
    container.add(row.container);
  }

  private renderCenterInfo(): void {
    const visual = this.currentThemeVisual();
    const battleState = this.battle.getState();
    const container = this.add.container(this.battleLayout.centerInfo.x, this.battleLayout.centerInfo.y);
    this.ui.push(container);

    const lineLeft = this.add.rectangle(-108, 0, 70, 1, visual.accentColor, 0.48);
    const lineRight = this.add.rectangle(108, 0, 70, 1, visual.accentColor, 0.48);
    const round = this.add.text(0, 0, t(battleState.mode === 'endless' && battleState.round === 0 ? 'endless.opening.preparing' : 'battle.roundLabel', { round: battleState.round }), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '16px',
      color: visual.glowColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    round.setShadow(0, 0, visual.glowColor, 6, true, true);
    container.add([lineLeft, lineRight, round]);
  }

  private renderPlayer(): void {
    const seat = this.battleLayout.seats.player;
    const hud = this.battleLayout.playerHud;
    const visual = this.currentThemeVisual();
    const container = this.add.container(seat.x, seat.y).setDepth(12);
    this.ui.push(container);
    this.seatContainers.set('player', container);
    const frame = new CharacterFrame(this, {
      x: hud.portrait.x,
      y: hud.portrait.y,
      width: hud.portrait.width,
      height: hud.portrait.height,
      accentColor: visual.accentColor,
      backgroundColor: this.battleVisualProfile.renderer === 'procedural_tavern'
        ? this.battleVisualProfile.tavern?.panel
        : undefined,
      skin: this.battleVisualProfile.renderer === 'procedural_tavern'
        ? undefined
        : getBattleThemeArt(this.battleArtSelection.themeId).playerFrame,
      shape: 'circle',
      backdrop: this.battleVisualProfile.renderer === 'procedural_tavern' ? 'none' : 'diamond',
      active: this.battle.phase === 'player-turn',
      muted: this.playerDisplayHp() <= 0,
    });
    container.add(frame.container);
    this.playerFrameContainer = frame.container;
    const visiblePose: PlayerPortraitPose = this.playerDisplayHp() <= 0 ? 'hurt' : this.playerPortraitPose;
    const portraitBackdrop = getPortraitBackdrop(this.battleArtSelection.themeId, 'player');
    if (portraitBackdrop) {
      frame.addPortraitBackdrop(createCharacterPortraitBackdrop(
        this,
        portraitBackdrop,
        0,
        0,
        hud.portrait.width - 8,
        hud.portrait.height - 8,
      ));
    }
    this.playerPortrait = createPlayerPortrait(this, visiblePose, 0, 0, portraitBackdrop);
    frame.addPortrait(this.playerPortrait);

    const name = this.add.text(hud.name.x, hud.name.y, t('common.playerDealer'), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '14px',
      color: visual.glowColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    name.setShadow(0, 0, visual.glowColor, 6, true, true);
    container.add(name);

    this.playerSoulStoneMeter = new SoulStoneMeter(this, {
      x: hud.portrait.x,
      y: hud.portrait.y,
      hp: this.playerDisplayHp(),
      maxHp: this.battle.player.maxHp,
      stoneSize: 30,
      spacing: 25,
      arcRadius: 85,
      onShowTooltip: () => this.showSkillTooltip(
        seat.x + hud.portrait.x,
        seat.y + hud.portrait.y - 108,
        t('common.health'),
        t('common.hp', { hp: this.playerDisplayHp(), maxHp: this.battle.player.maxHp }),
      ),
      onHideTooltip: () => this.hideSkillTooltip(),
    });
    container.add(this.playerSoulStoneMeter.container);

    const handX = this.playerHandCenterX(this.battle.player.hand.length);
    const statuses = this.statusStatesForPresentation('player', this.playerStatusStates());
    if (statuses.length > 0) {
      const statusRow = new StatusIconRow(this, {
        x: handX + hud.statuses.x,
        y: hud.statuses.y,
        statuses,
        variant: 'compact',
        onShowTooltip: (x, y, title, description) => this.showSkillTooltip(seat.x + x, seat.y + y, title, description),
        onHideTooltip: () => this.hideSkillTooltip(),
      });
      container.add(statusRow.container);
    }

    const hand = this.renderPlayerCardRow(container, handX, hud.hand.y);
    const shieldCharges = this.playerDisplayShieldCharges();
    if (shieldCharges > 0) {
      container.add(this.holyShieldAura(shieldCharges).setPosition(hud.portrait.x, hud.portrait.y));
    }

    const scoreX = handX + hand.rightEdge + hud.scoreGap;
    if (
      (this.battle.phase !== 'choice' || this.itemEffectPlayerHandRevealed)
      && !this.playerRedealing
      && !this.itemEffectPlayerHandHidden
    ) {
      const score = this.battle.playerScore();
      this.renderScoreBadge(container, scoreX, hud.hand.y, score, true, this.hasMechanic('resonance'));
    }
  }

  private setPlayerPortraitPose(pose: PlayerPortraitPose, resetAfterMs?: number): void {
    this.playerPortraitResetTimer?.remove(false);
    this.playerPortraitResetTimer = undefined;
    this.playerPortraitPose = pose;
    if (this.playerPortrait?.active) {
      applyPlayerPortraitPose(
        this.playerPortrait,
        pose,
        getPortraitBackdrop(this.battleArtSelection.themeId, 'player'),
      );
    }

    if (resetAfterMs === undefined) {
      return;
    }

    this.playerPortraitResetTimer = this.time.delayedCall(resetAfterMs, () => {
      this.playerPortraitResetTimer = undefined;
      const nextPose: PlayerPortraitPose = this.playerDisplayHp() <= 0 ? 'hurt' : 'idle';
      this.playerPortraitPose = nextPose;
      if (this.playerPortrait?.active) {
        applyPlayerPortraitPose(
          this.playerPortrait,
          nextPose,
          getPortraitBackdrop(this.battleArtSelection.themeId, 'player'),
        );
      }
    });
  }

  private setEnemyPortraitPose(enemyIndex: number, pose: CharacterArtPose, resetAfterMs?: number): void {
    const enemy = this.battle.enemies[enemyIndex];
    const portraitArt = enemy ? getEnemyCharacterArt(enemy.id) : undefined;
    if (!enemy || !portraitArt) {
      return;
    }

    this.enemyPortraitResetTimers.get(enemyIndex)?.remove(false);
    this.enemyPortraitResetTimers.delete(enemyIndex);
    const visiblePose: CharacterArtPose = this.enemyDisplayDefeated(enemyIndex) ? 'hurt' : pose;
    this.enemyPortraitPoses.set(enemyIndex, visiblePose);
    const portrait = this.enemyPortraits.get(enemyIndex);
    if (portrait?.active) {
      applyCharacterPortraitPose(
        portrait,
        portraitArt,
        visiblePose,
        getPortraitBackdrop(enemy.sourceThemeId, enemy.id),
      );
    }

    if (resetAfterMs === undefined || (visiblePose === 'hurt' && this.enemyDisplayDefeated(enemyIndex))) {
      return;
    }

    const timer = this.time.delayedCall(resetAfterMs, () => {
      this.enemyPortraitResetTimers.delete(enemyIndex);
      const nextEnemy = this.battle.enemies[enemyIndex];
      const nextArt = nextEnemy ? getEnemyCharacterArt(nextEnemy.id) : undefined;
      if (!nextEnemy || !nextArt) {
        return;
      }

      const nextPose: CharacterArtPose = this.enemyDisplayDefeated(enemyIndex) ? 'hurt' : 'idle';
      this.enemyPortraitPoses.set(enemyIndex, nextPose);
      const currentPortrait = this.enemyPortraits.get(enemyIndex);
      if (currentPortrait?.active) {
        applyCharacterPortraitPose(
          currentPortrait,
          nextArt,
          nextPose,
          getPortraitBackdrop(nextEnemy.sourceThemeId, nextEnemy.id),
        );
      }
    });
    this.enemyPortraitResetTimers.set(enemyIndex, timer);
  }

  private playPlayerFrameAttackMotion(onRelease: () => void): void {
    const frame = this.playerFrameContainer;
    if (!frame?.active) {
      onRelease();
      return;
    }

    const startY = frame.y;
    const soulStones = this.playerSoulStoneMeter?.container;
    const soulStoneStartY = soulStones?.y;
    let released = false;
    const release = () => {
      if (released) {
        return;
      }
      released = true;
      this.setPlayerPortraitPose('attack');
      onRelease();
    };
    this.tweens.killTweensOf(frame);
    if (soulStones?.active) {
      this.tweens.killTweensOf(soulStones);
      this.tweens.add({
        targets: soulStones,
        y: (soulStoneStartY ?? soulStones.y) + 2,
        duration: 260,
        ease: 'Sine.easeInOut',
      });
    }
    this.tweens.add({
      targets: frame,
      y: startY + 5,
      duration: 260,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!frame.active) {
          release();
          return;
        }
        this.time.delayedCall(60, () => {
          if (!frame.active) {
            release();
            return;
          }
          if (soulStones?.active) {
            this.tweens.add({
              targets: soulStones,
              y: (soulStoneStartY ?? soulStones.y) - 5,
              duration: 150,
              ease: 'Cubic.easeIn',
            });
          }
          this.tweens.add({
            targets: frame,
            y: startY - 11,
            duration: 150,
            ease: 'Cubic.easeIn',
            onStart: () => this.time.delayedCall(112, release),
            onComplete: () => {
              if (!frame.active) {
                release();
                return;
              }
              release();
              this.tweens.add({
                targets: frame,
                y: startY,
                duration: 300,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                  if (frame.active) {
                    frame.setY(startY);
                  }
                },
              });
              if (soulStones?.active) {
                this.tweens.add({
                  targets: soulStones,
                  y: soulStoneStartY ?? soulStones.y,
                  duration: 300,
                  ease: 'Cubic.easeOut',
                });
              }
            },
          });
        });
      },
    });
  }

  private playEnemyPortraitAttackMotion(enemyIndex: number, onRelease: () => void): void {
    const frame = this.enemyFrameContainers.get(enemyIndex);
    if (!frame?.active) {
      this.setEnemyPortraitPose(enemyIndex, 'attack');
      onRelease();
      return;
    }

    const enemy = this.battle.enemies[enemyIndex];
    const soulStones = enemy ? this.enemySoulStoneMeters.get(enemy.id)?.container : undefined;
    const startY = frame.y;
    const soulStoneStartY = soulStones?.y;
    let released = false;
    const release = () => {
      if (released) {
        return;
      }
      released = true;
      this.setEnemyPortraitPose(enemyIndex, 'attack');
      onRelease();
    };

    this.tweens.killTweensOf(frame);
    if (soulStones?.active) {
      this.tweens.killTweensOf(soulStones);
      this.tweens.add({
        targets: soulStones,
        y: (soulStoneStartY ?? soulStones.y) - 2,
        duration: 260,
        ease: 'Sine.easeInOut',
      });
    }
    this.tweens.add({
      targets: frame,
      y: startY - 5,
      duration: 260,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!frame.active) {
          release();
          return;
        }
        this.time.delayedCall(60, () => {
          if (!frame.active) {
            release();
            return;
          }
          if (soulStones?.active) {
            this.tweens.add({
              targets: soulStones,
              y: (soulStoneStartY ?? soulStones.y) + 5,
              duration: 150,
              ease: 'Cubic.easeIn',
            });
          }
          this.tweens.add({
            targets: frame,
            y: startY + 11,
            duration: 150,
            ease: 'Cubic.easeIn',
            onStart: () => this.time.delayedCall(112, release),
            onComplete: () => {
              if (!frame.active) {
                release();
                return;
              }
              release();
              this.tweens.add({
                targets: frame,
                y: startY,
                duration: 300,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                  if (frame.active) {
                    frame.setY(startY);
                  }
                },
              });
              if (soulStones?.active) {
                this.tweens.add({
                  targets: soulStones,
                  y: soulStoneStartY ?? soulStones.y,
                  duration: 300,
                  ease: 'Cubic.easeOut',
                });
              }
            },
          });
        });
      },
    });
  }

  private createUIState(state: BattleState = this.battle.getState()): BattleUIState {
    const ownedItemCount = this.totalBattleItemCount();
    return createBattleUIState(state, {
      dealing: this.dealing,
      playerRedealing: this.playerRedealing,
      actionDealing: this.actionDealing,
      stageBannerPlaying: this.stageBannerPlaying,
      actionAnimationPlaying: this.actionAnimationPlaying || this.presentationSequencePlaying,
      ownedItemCount,
      itemUsesRemaining: this.remainingBattleItemUses(),
    });
  }

  private grantFixedRoundItemsIfNeeded(): void {
    const fixedRound = this.currentFixedRoundConfig();
    const grantId = fixedRound ? `${fixedRound.id}:${this.battle.round}` : undefined;
    if (!fixedRound?.grantItems || !grantId || this.grantedItemRoundIds.has(grantId)) {
      return;
    }

    Object.entries(fixedRound.grantItems).forEach(([itemId, count]) => {
      const amount = Math.max(0, Math.floor(count ?? 0));
      if (amount <= 0) {
        return;
      }

      const id = itemId as ItemId;
      this.temporaryItems[id] = (this.temporaryItems[id] ?? 0) + amount;
    });
    this.grantedItemRoundIds.add(grantId);
  }

  private currentFixedRoundConfig() {
    const state = this.battle.getState();
    if (!state.currentFixedRoundId) {
      return undefined;
    }

    return this.battle.levelConfig?.fixedRounds?.find((round) => round.id === state.currentFixedRoundId);
  }

  private battleItemCounts(): Partial<Record<ItemId, number>> {
    if (this.battle.mode === 'endless') return this.battle.endlessLedger!.shop.ownedItems;
    const counts: Partial<Record<ItemId, number>> = {};
    ITEMS.forEach((item) => {
      const progressCount = getProgress().ownedItems[item.id] ?? 0;
      const temporaryCount = this.temporaryItems[item.id] ?? 0;
      const total = progressCount + temporaryCount;
      if (total > 0) {
        counts[item.id] = total;
      }
    });
    return counts;
  }

  private totalBattleItemCount(): number {
    return Object.values(this.battleItemCounts()).reduce((total, count) => total + (count ?? 0), 0);
  }

  private remainingBattleItemUses(): number {
    return remainingBattleItemUses(this.battle.mode, this.battleItemUses);
  }

  private consumeBattleItem(itemId: ItemId): void {
    // Endless inventory is consumed atomically by useBattleItem.
    if (this.battle.mode === 'endless') return;
    const temporaryCount = this.temporaryItems[itemId] ?? 0;
    if (temporaryCount > 0) {
      const nextCount = temporaryCount - 1;
      if (nextCount <= 0) {
        delete this.temporaryItems[itemId];
      } else {
        this.temporaryItems[itemId] = nextCount;
      }
      return;
    }

    consumeItem(itemId, 1);
  }

  private hasMechanic(mechanic: BattleMechanicId): boolean {
    if (this.reliefMode && mechanic === 'items') {
      return false;
    }
    return this.battle.hasMechanic(mechanic);
  }

  private startDealPresentation(): void {
    this.resetPortraitPosesForRoundStart();
    this.prepareRoundDealVisibility();
    const beginDeal = () => {
      this.itemModalOpen = false;
      this.itemFeedback = undefined;
      const dealEvents = this.battle.currentRoundDealEvents();
      this.render();
      this.playDealSequence(dealEvents, () => {
        this.dealing = false;
        this.dealtPlayerCards = this.battle.player.hand.length;
        this.dealtEnemyCards = this.battle.enemies.map((enemy) => enemy.hand.length);
        this.render();
        if (this.showLevelIntroLessonIfNeeded(() => {
          if (!this.showRoundLessonIfNeeded()) {
            this.render();
          }
        })) {
          return;
        }
        this.showRoundLessonIfNeeded();
      });
    };

    const roundStartEvents = this.battle.consumePresentationEvents();
    if (roundStartEvents.length === 0) {
      beginDeal();
      return;
    }

    this.playImmediatePresentationEvents(roundStartEvents);
    this.playPassiveEffectEvents(roundStartEvents, beginDeal);
  }

  private playRoundStartBannerThenDeal(): void {
    // Battle data already contains the new round's cards. Enter the visual
    // dealing state before the banner renders so those cards stay concealed.
    // The first round's passive logic has also resolved synchronously, so hide
    // target badges until their spell projectile actually reaches the target.
    this.concealInitialRoundStatusBadges();
    this.prepareRoundDealVisibility();
    this.playStageBanner(t('battle.banner.roundStart'), () => {
      this.startDealPresentation();
    });
  }

  private concealInitialRoundStatusBadges(): void {
    const oiran = this.battle.enemies.find((enemy) => enemy.id === 'oiran' && !enemy.defeated);
    if (oiran?.hanamiFanTargetId) {
      this.hiddenHanamiFanTargetIds.add(oiran.hanamiFanTargetId);
    }

    this.battle.enemies.forEach((enemy) => {
      if (enemy.taoistTalismaned && !enemy.defeated) {
        this.hiddenTaoistTalismanTargetIds.add(enemy.id);
      }
    });
  }

  private prepareRoundDealVisibility(): void {
    this.dealing = true;
    this.dealingRound = this.battle.round;
    this.dealtPlayerCards = 0;
    this.dealtEnemyCards = this.battle.enemies.map(() => 0);
  }

  private resetPortraitPosesForRoundStart(): void {
    this.setPlayerPortraitPose('idle');
    this.battle.enemies.forEach((_, enemyIndex) => {
      this.setEnemyPortraitPose(enemyIndex, 'idle');
    });
  }

  private playRevealBannerThen(onComplete: () => void): void {
    this.playStageBanner(t('battle.banner.reveal'), onComplete, false);
  }

  private playSoulRedeemBannerThen(): void {
    this.stageBannerPlaying = true;
    this.itemModalOpen = false;
    this.setPlayerPortraitPose('hurt');
    this.render();

    const icon = getBattleIconArt('soul-redeem');
    playSoulRedeemVfx(this, {
      center: this.playerSeatCenter(),
      iconTextureKey: icon.textureKey,
      title: t('skill.soulRedeem.name'),
      healAmount: 3,
      onRevive: () => {
        this.battle.resolveSoulRedeem();
        this.setPlayerPortraitPose('idle');
        this.playerSoulStoneMeter?.setHp(this.battle.player.hp, true);
      },
      onComplete: () => {
        this.stageBannerPlaying = false;
        if (this.endlessSaveError) { this.render(); return; }
        if (this.battle.phase === 'round-result') this.render();
        else this.startDealPresentation();
      },
    });
  }

  private playSoulRedeemParticles(x: number, y: number, count: number, color: number): void {
    for (let index = 0; index < count; index += 1) {
      const spark = this.add.circle(
        x + Phaser.Math.Between(-26, 26),
        y + Phaser.Math.Between(-18, 18),
        Phaser.Math.Between(3, 6),
        color,
        0.9,
      ).setDepth(71);
      this.tweens.add({
        targets: spark,
        x: spark.x + Phaser.Math.Between(-54, 54),
        y: spark.y + Phaser.Math.Between(-58, 34),
        scale: 0.3,
        alpha: 0,
        duration: Phaser.Math.Between(440, 680),
        ease: 'Sine.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  private playEnemySoulRedeemBannerThen(onComplete: () => void): void {
    this.playStageBanner(t('battle.banner.keeperSoulRedeem'), onComplete, false, COLORS.resonance, '#4b3000');
  }

  private hasPendingSoulRedeem(): boolean {
    return this.battle.pendingSoulRedeem || !!this.battle.pendingEnemySoulRedeem;
  }

  private resolvePendingSoulRedeem(): void {
    const beforeRedeem = this.hpSnapshot();
    if (this.battle.pendingSoulRedeem) {
      this.battle.resolveSoulRedeem();
    } else if (this.battle.pendingEnemySoulRedeem) {
      this.battle.resolveEnemySoulRedeem();
    }
    this.playHealSoundIfHpIncreased(beforeRedeem);
    if (this.endlessSaveError) { this.render(); return; }
    if (this.battle.phase === 'round-result') this.render();
    else this.startDealPresentation();
  }

  private playPendingSoulRedeemBannerThen(): void {
    if (this.battle.pendingEnemySoulRedeem) {
      this.playEnemySoulRedeemBannerThen(() => this.resolvePendingSoulRedeem());
      return;
    }

    this.playSoulRedeemBannerThen();
  }

  private playStageBanner(label: string, onComplete: () => void, renderBefore = true, color = COLORS.dangerText, stroke = '#3a070d'): void {
    this.stageBannerPlaying = true;
    this.itemModalOpen = false;
    if (renderBefore) {
      this.render();
    }

    const container = this.add.container(this.battleLayout.stageBanner.x, this.battleLayout.stageBanner.y).setDepth(70);
    const blocker = this.add.rectangle(
      0,
      18,
      this.battleLayout.canvas.width,
      this.battleLayout.canvas.height,
      0x000000,
      0.01,
    ).setInteractive();
    const text = this.add.text(0, 0, label, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '104px',
      color,
      fontStyle: 'bold',
      stroke,
      strokeThickness: 8,
      align: 'center',
      lineSpacing: 12,
    }).setOrigin(0.5);
    text.setShadow(0, 0, color, 36, true, true);
    container.add([blocker, text]);
    container.setAlpha(0);
    container.setScale(0.56);

    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 360,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(420, () => {
          this.tweens.add({
            targets: container,
            alpha: 0,
            y: container.y - 34,
            scale: 1.12,
            duration: 320,
            ease: 'Sine.easeIn',
            onComplete: () => {
              container.destroy(true);
              this.stageBannerPlaying = false;
              onComplete();
            },
          });
        });
      },
    });
  }

  private playDealSequence(steps: BattlePresentationEvent[], onComplete: () => void): void {
    const playStep = (index: number) => {
      if (index >= steps.length || !this.dealing || this.dealingRound !== this.battle.round) {
        onComplete();
        return;
      }

      const step = steps[index];
      if (step.type !== 'card-dealt') {
        this.time.delayedCall(0, () => playStep(index + 1));
        return;
      }

      const enemyIndex = step.target === 'player'
        ? -1
        : this.battle.enemies.findIndex((enemy) => enemy.id === step.target);
      if (step.target !== 'player' && enemyIndex < 0) {
        this.time.delayedCall(0, () => playStep(index + 1));
        return;
      }

      const to = step.target === 'player'
        ? this.dealTargetForPlayer(step.cardIndex)
        : this.dealTargetForEnemy(enemyIndex, step.cardIndex);
      const targetAngle = step.target === 'player'
        ? this.dealAngleForPlayer(step.cardIndex)
        : this.dealAngleForEnemy(enemyIndex, step.cardIndex);

      this.playDealCard(to, targetAngle, 'slide', () => {
        if (step.target === 'player') {
          this.dealtPlayerCards = Math.max(this.dealtPlayerCards, step.cardIndex + 1);
        } else {
          this.dealtEnemyCards[enemyIndex] = Math.max(this.dealtEnemyCards[enemyIndex], step.cardIndex + 1);
        }

        this.render();
        this.time.delayedCall(54, () => playStep(index + 1));
      });
    };

    playStep(0);
  }

  private playActionDealEvents(events: BattlePresentationEvent[], onComplete: () => void): void {
    const dealEvents = this.cardDealEvents(events);
    if (dealEvents.length === 0) {
      onComplete();
      return;
    }

    this.actionDealing = true;
    this.dealtPlayerCards = this.battle.player.hand.length;
    this.dealtEnemyCards = this.battle.enemies.map((enemy) => enemy.hand.length);
    dealEvents.forEach((event) => {
      if (event.target === 'player') {
        this.dealtPlayerCards = Math.min(this.dealtPlayerCards, event.cardIndex);
        return;
      }

      const enemyIndex = this.battle.enemies.findIndex((enemy) => enemy.id === event.target);
      if (enemyIndex >= 0) {
        this.dealtEnemyCards[enemyIndex] = Math.min(this.dealtEnemyCards[enemyIndex], event.cardIndex);
      }
    });
    this.render();

    const playStep = (index: number) => {
      if (index >= dealEvents.length || !this.actionDealing) {
        this.actionDealing = false;
        this.dealtPlayerCards = this.battle.player.hand.length;
        this.dealtEnemyCards = this.battle.enemies.map((enemy) => enemy.hand.length);
        this.render();
        onComplete();
        return;
      }

      const event = dealEvents[index];
      const enemyIndex = event.target === 'player'
        ? -1
        : this.battle.enemies.findIndex((enemy) => enemy.id === event.target);
      if (event.target !== 'player' && enemyIndex < 0) {
        this.time.delayedCall(0, () => playStep(index + 1));
        return;
      }

      const to = event.target === 'player'
        ? this.dealTargetForPlayer(event.cardIndex)
        : this.dealTargetForEnemy(enemyIndex, event.cardIndex);
      const targetAngle = event.target === 'player'
        ? this.dealAngleForPlayer(event.cardIndex)
        : this.dealAngleForEnemy(enemyIndex, event.cardIndex);

      this.playDealCard(to, targetAngle, 'place', () => {
        if (event.target === 'player') {
          this.dealtPlayerCards = Math.max(this.dealtPlayerCards, event.cardIndex + 1);
        } else {
          this.dealtEnemyCards[enemyIndex] = Math.max(this.dealtEnemyCards[enemyIndex], event.cardIndex + 1);
        }

        this.render();
        this.time.delayedCall(70, () => playStep(index + 1));
      });
    };

    playStep(0);
  }

  private dealTargetForPlayer(cardIndex: number): Phaser.Math.Vector2 {
    const seat = this.battleLayout.seats.player;
    const hud = this.battleLayout.playerHud;
    const count = Math.max(this.battle.player.hand.length, cardIndex + 1);
    const pose = resolveHandItemPose(
      cardIndex,
      count,
      this.battleLayout.cards.width,
      this.battleLayout.cards.spacing,
      true,
    );
    return new Phaser.Math.Vector2(
      seat.x + this.playerHandCenterX(count) + pose.x,
      seat.y + hud.hand.y + pose.y,
    );
  }

  private dealTargetForEnemy(enemyIndex: number, cardIndex: number): Phaser.Math.Vector2 {
    const seat = this.enemySeatForIndex(enemyIndex);
    const layout = this.enemyHudLayout(enemyIndex);
    const count = Math.max(this.battle.enemies[enemyIndex]?.hand.length ?? 0, cardIndex + 1);
    const pose = resolveHandItemPose(
      cardIndex,
      count,
      this.battleLayout.cards.enemyWidth,
      this.battleLayout.cards.enemySpacing,
      true,
    );
    return new Phaser.Math.Vector2(
      seat.x + this.enemyHandCenterX(enemyIndex, count) + pose.x,
      seat.y + layout.hand.y + pose.y,
    );
  }

  private dealAngleForPlayer(cardIndex: number): number {
    const count = Math.max(this.battle.player.hand.length, cardIndex + 1);
    return resolveHandItemPose(
      cardIndex,
      count,
      this.battleLayout.cards.width,
      this.battleLayout.cards.spacing,
      true,
    ).angle;
  }

  private dealAngleForEnemy(enemyIndex: number, cardIndex: number): number {
    const count = Math.max(this.battle.enemies[enemyIndex]?.hand.length ?? 0, cardIndex + 1);
    return resolveHandItemPose(
      cardIndex,
      count,
      this.battleLayout.cards.enemyWidth,
      this.battleLayout.cards.enemySpacing,
      true,
    ).angle;
  }

  private enemyCardCenter(enemyIndex: number, cardIndex: number): Phaser.Math.Vector2 {
    const seat = this.enemySeatForIndex(enemyIndex);
    const layout = this.enemyHudLayout(enemyIndex);
    const count = Math.max(this.battle.enemies[enemyIndex]?.hand.length ?? 0, cardIndex + 1);
    const pose = resolveHandItemPose(
      cardIndex,
      count,
      this.battleLayout.cards.enemyWidth,
      this.battleLayout.cards.enemySpacing,
      true,
    );
    return new Phaser.Math.Vector2(
      seat.x + this.enemyHandCenterX(enemyIndex, count) + pose.x,
      seat.y + layout.hand.y + pose.y,
    );
  }

  private playDealCard(
    to: Phaser.Math.Vector2,
    targetAngle: number,
    sound: 'slide' | 'place',
    onComplete: () => void,
  ): void {
    const card = this.add.container(this.battleLayout.dealOrigin.x, this.battleLayout.dealOrigin.y)
      .setDepth(30)
      .setAngle(Phaser.Math.Between(-5, 5));
    card.add(this.add.image(0, 0, 'card-back').setDisplaySize(34, 48));

    this.sound.play(sound === 'slide' ? 'cardSlide' : 'cardPlace', {
      volume: sound === 'slide' ? 0.56 : 0.42,
    });
    this.tweens.add({
      targets: card,
      x: to.x,
      y: to.y,
      angle: targetAngle,
      duration: 160,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        card.destroy(true);
        onComplete();
      },
    });
  }

  private playPlayerRedealPresentation(events: BattlePresentationEvent[], onComplete?: () => void): void {
    this.playerRedealing = true;
    this.dealtPlayerCards = 0;
    this.itemModalOpen = false;
    this.itemFeedback = undefined;
    this.render();

    const dealEvents = this.cardDealEvents(events).filter((event) => event.target === 'player');
    const playStep = (index: number) => {
      if (index >= dealEvents.length || !this.playerRedealing) {
        this.playerRedealing = false;
        this.dealtPlayerCards = this.battle.player.hand.length;
        this.queuePlayerResonanceFeedbackIfChanged();
        this.render();
        onComplete?.();
        return;
      }

      const event = dealEvents[index];
      this.playDealCard(this.dealTargetForPlayer(event.cardIndex), this.dealAngleForPlayer(event.cardIndex), 'place', () => {
        this.dealtPlayerCards = Math.max(this.dealtPlayerCards, event.cardIndex + 1);
        this.render();
        this.time.delayedCall(70, () => playStep(index + 1));
      });
    };

    playStep(0);
  }

  private renderBattleLogButton(): void {
    if (this.battleLogOpen || this.battle.phase === 'battle-result') {
      return;
    }

    const container = this.add.container(this.battleLayout.hud.logButton.x, this.battleLayout.hud.logButton.y).setDepth(40);
    this.ui.push(container);
    container.add(this.battleActionButton(0, 0, 118, 40, t('battle.logButton'), () => {
      if (this.blockingMessage
        || this.itemModalOpen
        || this.battle.endlessLedger?.shop.isOpen
        || this.itemFeedback
        || this.confirmReturnToStorySelect
        || this.confirmExitFormalGame
        || this.confirmExitEndless
        || this.isPresentationBusy()) {
        return;
      }

      this.battleLogOpen = true;
      this.render();
    }, 'secondary', '14px'));
    const cleanModeButton = this.battleActionButton(128, 0, 142, 40, t(this.cleanMode ? 'battle.cleanMode.on' : 'battle.cleanMode.off'), () => {
      if (this.blockingMessage
        || this.itemModalOpen
        || this.battle.endlessLedger?.shop.isOpen
        || this.itemFeedback
        || this.confirmReturnToStorySelect
        || this.confirmExitFormalGame
        || this.confirmExitEndless
        || this.isPresentationBusy()) {
        return;
      }

      this.cleanMode = !this.cleanMode;
      this.hideSkillTooltip();
      this.render();
    }, 'secondary', '14px');
    const cleanModeHitArea = cleanModeButton.list[0] as Phaser.GameObjects.GameObject;
    cleanModeHitArea.on('pointerover', () => this.showSkillTooltip(
      this.battleLayout.hud.logButton.x + 199,
      this.battleLayout.hud.logButton.y - 88,
      t('battle.cleanMode.title'),
      t('battle.cleanMode.tooltip'),
      true,
    ));
    cleanModeHitArea.on('pointerout', () => this.hideSkillTooltip());
    container.add(cleanModeButton);
  }

  private renderBattleLogModal(): void {
    if (!this.battleLogOpen) {
      return;
    }

    const colors = this.currentUIColors();
    const container = this.add.container(640, 360).setDepth(140);
    this.ui.push(container);
    const blocker = this.add.rectangle(0, 0, 1280, 720, 0x050608, 0.78).setInteractive();
    const panel = MedievalPanel.render(this, {
      width: 760,
      height: 530,
      skin: getBattleThemeArt(this.battleArtSelection.themeId).modalPanel,
      fallbackFill: colors.panel,
      fallbackLine: colors.accent,
    });
    const title = this.add.text(0, -224, t('battle.logTitle'), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '28px',
      color: MEDIEVAL_UI_COLORS.textBright,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 0, colors.accentText, 8, true, true);
    container.add([blocker, panel, title]);

    const entries = this.battle.log.length > 0
      ? this.battle.log.map((message) => ({ message }))
      : [{ message: t('battle.logEmpty'), empty: true }];
    this.battleLogGrid = new ScrollableGrid(this, {
      x: 310,
      y: 174,
      width: 660,
      height: 330,
      columns: 1,
      cellWidth: 628,
      cellHeight: 56,
      rowGap: 8,
      wheelStep: 64,
      scrollbar: {
        trackColor: MEDIEVAL_UI_COLORS.panel,
        thumbColor: MEDIEVAL_UI_COLORS.accent,
        thumbHoverColor: 0xd3a25b,
      },
    });
    this.battleLogGrid.container.setDepth(141);
    this.battleLogGrid.setItems(entries, (scene, entry, index) => {
      const row = scene.add.container(0, 0);
      const isNewest = index === 0 && !entry.empty;
      const background = scene.add.rectangle(
        0,
        0,
        628,
        56,
        isNewest ? 0x2b1a12 : MEDIEVAL_UI_COLORS.panelAlt,
        isNewest ? 0.9 : 0.78,
      ).setStrokeStyle(
        1,
        isNewest ? MEDIEVAL_UI_COLORS.accent : MEDIEVAL_UI_COLORS.line,
        isNewest ? 0.82 : 0.5,
      );
      const accent = scene.add.rectangle(
        -307,
        0,
        3,
        38,
        isNewest ? MEDIEVAL_UI_COLORS.accent : MEDIEVAL_UI_COLORS.line,
        isNewest ? 0.95 : 0.52,
      );
      const message = scene.add.text(-294, 0, entry.message, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '15px',
        color: entry.empty
          ? MEDIEVAL_UI_COLORS.textMuted
          : (isNewest ? MEDIEVAL_UI_COLORS.textBright : MEDIEVAL_UI_COLORS.text),
        wordWrap: { width: 574, useAdvancedWrap: true },
      }).setOrigin(0, 0.5);
      row.add([background, accent, message]);
      return row;
    });

    container.add(this.button(-78, 202, 156, 44, t('battle.logClose'), () => {
      this.battleLogOpen = false;
      this.render();
    }, colors.button, '17px'));
  }

  private renderPlayerCommandBar(): void {
    const uiState = this.createUIState();
    const guideTarget = this.tutorialGuideTarget();
    const showItems = this.hasMechanic('items') && this.shouldShowTutorialItemBar();
    const showSkills = this.hasMechanic('skills');
    const inputBlocked = Boolean(
      this.endlessSaveError
      || this.blockingMessage
      || this.battleLogOpen
      || this.itemModalOpen
      || this.battle.endlessLedger?.shop.isOpen
      || this.itemFeedback
      || this.confirmReturnToStorySelect
      || this.confirmExitFormalGame
      || this.confirmExitEndless,
    );
    const colors = this.currentUIColors();
    const playerSeat = this.battleLayout.seats.player;
    const hud = this.battleLayout.playerHud;
    // Keep tutorial guides above the hand. Child depth cannot escape a Phaser
    // container, so the command bar itself must sit above card presentation.
    const controls = this.add.container(playerSeat.x, playerSeat.y).setDepth(55);
    this.ui.push(controls);
    const showPassive = this.hasMechanic('soul_redeem');
    const visibleSkillCount = showSkills
      ? Number(uiState.skills.shift.visible) + Number(uiState.skills.summon.visible)
      : 0;
    const utilityCount = Number(showPassive) + Number(showItems) + visibleSkillCount;
    const utilityStartX = hud.utilityBar.x - ((utilityCount - 1) * hud.utilityGap) / 2;
    let utilityIndex = 0;

    if (showPassive) {
      const slotX = utilityStartX + utilityIndex * hud.utilityGap;
      const slotY = hud.utilityBar.y;
      this.graduationTargets.set('passive:player', { x: playerSeat.x + slotX, y: playerSeat.y + slotY, width: 54, height: 54 });
      controls.add(this.playerPassiveIcon(
        playerSeat.x + slotX,
        playerSeat.y + slotY - 98,
      ).setPosition(slotX, slotY));
      utilityIndex += 1;
    }

    if (showItems) {
      const itemUsesRemaining = this.remainingBattleItemUses();
      const itemUsesExhausted = itemUsesRemaining <= 0;
      const slotX = utilityStartX + utilityIndex * hud.utilityGap;
      const itemTooltipX = playerSeat.x + slotX;
      const itemTooltipY = playerSeat.y + hud.utilityBar.y - 98;
      controls.add(ItemBar.render(this, {
        x: slotX,
        y: hud.utilityBar.y,
        enabled: uiState.itemButton.enabled && !inputBlocked && !itemUsesExhausted,
        label: this.battle.mode === 'endless' ? t('endless.items.bag') : t('battle.itemButtonRemaining', { remaining: itemUsesRemaining, max: MAX_BATTLE_ITEM_USES }),
        badge: this.battle.mode === 'endless' ? `${this.totalBattleItemCount()}` : `${itemUsesRemaining}`,
        colors: {
          accent: colors.accent,
          accentText: colors.accentText,
          line: colors.line,
          muted: colors.muted,
          panelEnabled: colors.button,
          panelDisabled: colors.panel,
          panelHover: colors.buttonHover,
          text: colors.text,
        },
        onShowTooltip: () => this.showSkillTooltip(
          itemTooltipX,
          itemTooltipY,
          t('battle.itemButton'),
          this.battle.mode === 'endless' ? t('endless.items.bag') : t('battle.itemButtonRemaining', { remaining: itemUsesRemaining, max: MAX_BATTLE_ITEM_USES }),
        ),
        onHideTooltip: () => this.hideSkillTooltip(),
        onOpen: () => {
          this.playClickSound();
          this.selectedBattleItemId = undefined;
          this.itemModalPage = 0;
          this.itemModalHasAnimated = false;
          this.itemModalOpen = true;
          this.render();
        },
        guided: guideTarget === 'item-bag' && !inputBlocked,
      }));
      utilityIndex += 1;
    }

    if (showSkills) {
      const skills = {
        shift: { ...uiState.skills.shift, enabled: uiState.skills.shift.enabled && !inputBlocked },
        summon: { ...uiState.skills.summon, enabled: uiState.skills.summon.enabled && !inputBlocked },
      };
      controls.add(SkillBar.render(this, {
        x: utilityStartX + utilityIndex * hud.utilityGap,
        y: hud.utilityBar.y,
        skills,
        direction: 'horizontal',
        slotGap: hud.utilityGap,
        guideTarget: guideTarget === 'skill-shift'
          ? 'shift'
          : guideTarget === 'skill-summon' ? 'summon' : undefined,
        colors: {
          cooldown: colors.dangerText,
          line: colors.line,
          muted: colors.muted,
          resonance: COLORS.resonance,
          text: colors.text,
          accent: colors.accent,
          panelEnabled: colors.button,
          panelDisabled: colors.panel,
          panelHover: colors.buttonHover,
        },
        tooltipOrigin: { x: playerSeat.x, y: playerSeat.y },
        onShowTooltip: (x, y, title, body) => this.showSkillTooltip(x, y, title, body),
        onHideTooltip: () => this.hideSkillTooltip(),
        onUse: (kind, title, tooltip, tooltipX, tooltipY) => {
          this.playClickSound();
          this.runAction(() => {
            const result = this.battle.execute({
              type: 'use-skill',
              skill: kind === 'shift' ? 'resonance-shift' : 'resonance-summon',
            });
            if (result?.used) {
              this.setPlayerPortraitPose('cast');
            }
            if (!result?.used) {
              this.showSkillTooltip(tooltipX, tooltipY, title, result?.message ?? tooltip);
            }
          });
        },
      }));
    }

    if (uiState.autoAdvanceRound) {
      this.scheduleNextRound();
      return;
    }

    if (uiState.inputLocked || inputBlocked) {
      return;
    }

    controls.add(ActionPanel.render(this, {
      x: hud.actions.x,
      y: hud.actions.y,
      buttons: uiState.actionButtons,
      colors: {
        button: colors.button,
        primary: colors.accent,
        danger: colors.danger,
      },
      createButton: (x, y, width, height, label, onClick, fill, fontSize, sound) => this.battleActionButton(
        x,
        y,
        width,
        height,
        label,
        onClick,
        fill === colors.danger ? 'danger' : fill === colors.accent ? 'primary' : 'normal',
        fontSize,
        sound,
      ),
      onAction: (buttonState) => this.handleActionButton(buttonState),
      centered: true,
      onTargetRendered: (id, x, y, width, height) => this.graduationTargets.set(id, {
        x: playerSeat.x + hud.actions.x + x, y: playerSeat.y + hud.actions.y + y, width, height,
      }),
      guideTarget: guideTarget === 'view-hand'
        || guideTarget === 'invite-one'
        || guideTarget === 'compare'
        || guideTarget === 'player-stand'
        ? guideTarget
        : undefined,
    }));
  }

  private renderStoryReturnButton(): void {
    if (!this.battle.levelConfig?.id || this.battle.phase === 'battle-result') {
      return;
    }

    const container = this.add.container(this.battleLayout.hud.exitButton.x, this.battleLayout.hud.exitButton.y).setDepth(40);
    this.ui.push(container);
    container.add(this.battleActionButton(0, 0, 112, 40, t('battle.storyReturn.button'), () => {
      if (this.blockingMessage || this.itemModalOpen
        || this.battle.endlessLedger?.shop.isOpen || this.itemFeedback || this.presentationSequencePlaying || this.actionAnimationPlaying || this.dealing || this.actionDealing || this.playerRedealing) {
        return;
      }

      this.confirmReturnToStorySelect = true;
      this.render();
    }, 'danger', '14px'));
  }

  private renderFormalExitButton(): void {
    if (this.battle.mode === 'endless' || this.battle.levelConfig?.id || !this.tableThemeId || this.battle.phase === 'battle-result') {
      return;
    }

    const container = this.add.container(this.battleLayout.hud.exitButton.x, this.battleLayout.hud.exitButton.y).setDepth(40);
    this.ui.push(container);
    container.add(this.battleActionButton(0, 0, 112, 40, t('battle.formalExit.button'), () => {
      if (this.blockingMessage || this.itemModalOpen
        || this.battle.endlessLedger?.shop.isOpen || this.itemFeedback || this.presentationSequencePlaying || this.actionAnimationPlaying || this.dealing || this.actionDealing || this.playerRedealing) {
        return;
      }

      this.confirmExitFormalGame = true;
      this.render();
    }, 'danger', '14px'));
  }

  private renderStoryReturnConfirmModal(): void {
    if (!this.confirmReturnToStorySelect) {
      return;
    }

    const colors = this.currentUIColors();
    const container = this.add.container(640, 360).setDepth(105);
    this.ui.push(container);

    const blocker = this.add.rectangle(0, 0, 1280, 720, 0x050608, 0.68);
    blocker.setInteractive();
    container.add(blocker);
    container.add(MedievalPanel.render(this, {
      width: 500,
      height: 258,
      skin: getBattleThemeArt(this.battleArtSelection.themeId).modalPanel,
      fallbackFill: colors.panel,
      fallbackLine: colors.danger,
    }));

    const title = this.add.text(0, -82, t('battle.storyReturn.title'), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '28px',
      color: MEDIEVAL_UI_COLORS.textBright,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const body = this.add.text(0, -22, t('battle.storyReturn.body'), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '18px',
      color: MEDIEVAL_UI_COLORS.textMuted,
      align: 'center',
      lineSpacing: 8,
      wordWrap: { width: 390, useAdvancedWrap: true },
    }).setOrigin(0.5);

    container.add([
      title,
      body,
      this.button(-172, 58, 150, 46, t('battle.storyReturn.cancel'), () => {
        this.confirmReturnToStorySelect = false;
        this.render();
      }),
      this.button(22, 58, 184, 46, t('battle.storyReturn.confirm'), () => {
        this.confirmReturnToStorySelect = false;
        this.scene.start('StorySelectScene');
      }, colors.danger, '17px'),
    ]);
  }

  private renderFormalExitConfirmModal(): void {
    if (!this.confirmExitFormalGame) {
      return;
    }

    const colors = this.currentUIColors();
    const container = this.add.container(640, 360).setDepth(105);
    this.ui.push(container);

    const blocker = this.add.rectangle(0, 0, 1280, 720, 0x050608, 0.68);
    blocker.setInteractive();
    container.add(blocker);
    container.add(MedievalPanel.render(this, {
      width: 520,
      height: 270,
      skin: getBattleThemeArt(this.battleArtSelection.themeId).modalPanel,
      fallbackFill: colors.panel,
      fallbackLine: colors.danger,
    }));

    const title = this.add.text(0, -84, t(this.reliefMode ? 'battle.reliefExit.title' : 'battle.formalExit.title'), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '28px',
      color: MEDIEVAL_UI_COLORS.textBright,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const body = this.add.text(0, -22, t(this.reliefMode ? 'battle.reliefExit.body' : 'battle.formalExit.body'), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '18px',
      color: MEDIEVAL_UI_COLORS.textMuted,
      align: 'center',
      lineSpacing: 8,
      wordWrap: { width: 410, useAdvancedWrap: true },
    }).setOrigin(0.5);

    container.add([
      title,
      body,
      this.button(-172, 62, 150, 46, t('battle.formalExit.cancel'), () => {
        this.confirmExitFormalGame = false;
        this.render();
      }),
      this.button(22, 62, 184, 46, t('battle.formalExit.confirm'), () => {
        this.confirmExitFormalGame = false;
        this.scene.start(this.reliefMode ? 'TableSelectScene' : 'StartScene');
      }, colors.danger, '17px'),
    ]);
  }

  private handleActionButton(buttonState: BattleActionButtonState): void {
    if (buttonState.id === 'view-hand') {
      this.battle.execute(buttonState.action);
      this.queuePlayerResonanceFeedbackIfChanged();
      this.render();
      if (this.showPlayerTurnLessonIfNeeded()) {
        return;
      }
      this.showCompareHintIfNeeded();
      return;
    }

    if (buttonState.id === 'invite-one') {
      const invitedEnemyId = this.battle.currentEnemy?.id;
      this.battle.execute(buttonState.action);
      const events = this.battle.consumePresentationEvents();
      if (this.cardDealEvents(events).length === 0) {
        this.playClickSound();
      }
      this.playPassiveEffectEvents(events, () => {
        this.playImmediatePresentationEvents(events);
        this.playActionDealEvents(events, () => {
          this.playCardReplacementEvents(events, () => {
            const continueAfterInviteDialogue = () => {
              if (this.showPlayerTurnLessonIfNeeded()) {
                return;
              }

              this.render();
            };

            if (invitedEnemyId && this.showInviteDialogueIfNeeded(invitedEnemyId, continueAfterInviteDialogue)) {
              return;
            }

            continueAfterInviteDialogue();
          });
        });
      });
      return;
    }

    this.runAction(
      () => this.battle.execute(buttonState.action),
      { restorePortraitsAfterCombat: buttonState.action.type === 'compare-current-enemy' },
    );
  }

  private scheduleNextRound(): void {
    if (this.endlessSaveError || this.autoAdvancingRound || this.battle.endlessLedger?.shop.isOpen || this.battle.phase !== 'round-result') {
      return;
    }

    this.autoAdvancingRound = true;
    this.time.delayedCall(900, () => {
      if (this.isRoundTransitionBusy()) {
        this.autoAdvancingRound = false;
        this.time.delayedCall(120, () => this.scheduleNextRound());
        return;
      }

      this.autoAdvancingRound = false;
      if (this.battle.phase !== 'round-result' || this.battle.battleOutcome) {
        this.render();
        return;
      }

      if (this.battle.openEndlessShop()) {
        this.render();
        return;
      }
      this.battle.execute({ type: 'next-round' });
      if (this.endlessSaveError) { this.render(); return; }
      const events = this.battle.consumePresentationEvents();
      this.playImmediatePresentationEvents(events);
      this.playPassiveEffectEvents(events, () => this.startDealPresentation());
    });
  }

  private isRoundTransitionBusy(): boolean {
    return this.dealing
      || this.playerRedealing
      || this.actionDealing
      || this.stageBannerPlaying
      || this.actionAnimationPlaying
      || this.presentationSequencePlaying
      || this.itemModalOpen
      || Boolean(this.itemFeedback)
      || this.battleLogOpen
      || Boolean(this.blockingMessage)
      || this.confirmReturnToStorySelect
      || this.confirmExitFormalGame
      || this.confirmExitEndless;
  }

  private endlessExitBlocked(): boolean {
    return Boolean(this.endlessSaveError || this.isPresentationBusy() || this.hasPendingSoulRedeem() || this.endlessSettlementPending
      || this.battle.phase === 'battle-result' || this.itemModalOpen || !!this.itemFeedback
      || !!this.blockingMessage || this.battleLogOpen || this.confirmExitEndless);
  }

  private renderEndlessHud(): void {
    const accounting = this.battle.getState().endlessAccounting!;
    this.ui.push(renderEndlessBattleHud(this, accounting));
    this.ui.push(MedievalButton.render(this, { x: this.battleLayout.hud.exitButton.x - 68, y: this.battleLayout.hud.exitButton.y, width: 180, height: 44,
      label: t('endless.exit.button'), fontSize: '17px', enabled: !this.endlessExitBlocked(), variant: 'danger',
      skin: getBattleThemeArt(this.battleArtSelection.themeId).actionButton,
      onActivate: () => { if (this.endlessExitBlocked()) return; this.confirmExitEndless = true; this.playClickSound(); this.render(); },
    }).setDepth(150));
  }

  private renderEndlessExitConfirm(): void {
    if (!this.confirmExitEndless) return;
    const summary = summarizeEndlessRun(this.endlessRunId ?? '', this.battle.round, this.battle.getState().endlessAccounting!, 'exit');
    const root = this.add.container(640, 360).setDepth(160);
    root.add(this.add.rectangle(0, 0, 1280, 720, 0x030304, 0.85).setInteractive());
    root.add(MedievalPanel.render(this, { width: 650, height: 340,
      skin: getBattleThemeArt(this.battleArtSelection.themeId).modalPanel, fallbackFill: 0x24150f, fallbackLine: 0xb95b4d }));
    root.add(this.add.text(0, -100, t('endless.exit.title'), { fontFamily: GAME_FONT_FAMILY, fontSize: '30px', color: '#f1e5cf' }).setOrigin(0.5));
    root.add(this.add.text(0, -28, t('endless.exit.body', { coins: summary.total }), {
      fontFamily: GAME_FONT_FAMILY, fontSize: '19px', color: '#edbd80', align: 'center',
      wordWrap: { width: 560, useAdvancedWrap: true }, lineSpacing: 8 }).setOrigin(0.5));
    root.add(MedievalButton.render(this, { x: -260, y: 80, width: 240, height: 48, label: t('endless.exit.cancel'),
      variant: 'secondary', onActivate: () => { this.confirmExitEndless = false; this.playClickSound(); this.render(); } }));
    root.add(MedievalButton.render(this, { x: 20, y: 80, width: 240, height: 48, label: t('endless.exit.confirm'),
      variant: 'danger', onActivate: () => {
        if (this.isPresentationBusy() || this.hasPendingSoulRedeem()) return;
        this.confirmExitEndless = false;
        if (this.battle.endEndlessRun()) { this.resultModalReady = true; this.playClickSound(); }
        this.render();
      } }));
    this.ui.push(root);
  }

  private settleEndlessIfNeeded(): void {
    if (this.endlessSaveError || this.battle.phase !== 'battle-result' || !this.battle.battleOutcome || this.hasPendingSoulRedeem()
      || this.isPresentationBusy() || !this.resultModalReady || this.battleEconomySettled
      || this.endlessSettlementPending || this.endlessSettlementError) return;
    const battle = this.battle;
    const summary = this.endlessSettlementSummary ?? summarizeEndlessRun(this.endlessRunId ?? '', battle.round,
      battle.getState().endlessAccounting!, battle.endlessEndReason ?? 'defeat');
    this.endlessSettlementSummary = summary;
    this.endlessSettlementPending = true;
    void settleEndlessEconomy(summary, this.endlessController?.ownerId).then((result) => {
      if (this.battle !== battle) return;
      this.endlessSettlementPending = false;
      if (result.status === 'settled' || result.status === 'already-settled') {
        this.endlessSettlementReceipt = result.receipt;
        this.battleEconomySettled = true;
        battle.endlessLedger!.shop.discardInventory();
        this.endlessController?.release();
      } else this.endlessSettlementError = t(`endless.result.${result.status}`);
      if (!this.sys || this.sys.isActive()) this.render();
    }).catch(() => {
      if (this.battle !== battle) return;
      this.endlessSettlementPending = false;
      this.endlessSettlementError = t('endless.result.storage-unavailable');
      if (!this.sys || this.sys.isActive()) this.render();
    });
  }

  private renderEndlessResult(): void {
    if (this.battle.phase !== 'battle-result' || !this.resultModalReady || this.isPresentationBusy() || this.hasPendingSoulRedeem()) return;
    const summary = this.endlessSettlementSummary ?? summarizeEndlessRun(this.endlessRunId ?? '', this.battle.round,
      this.battle.getState().endlessAccounting!, this.battle.endlessEndReason ?? 'defeat');
    this.ui.push(renderEndlessResultModal(this, {
      summary, receipt: this.endlessSettlementReceipt, isLocalBest: getProgress().endlessBestScore?.runId === summary.runId, pending: this.endlessSettlementPending,
      error: this.endlessSettlementError,
      onRetry: () => { this.endlessSettlementError = undefined; this.render(); },
      onReturn: () => { if (this.battleEconomySettled) this.scene.start('StartScene'); },
    }));
  }

  private settleEconomyIfNeeded(): void {
    if (this.battle.mode === 'endless') {
      this.settleEndlessIfNeeded();
      return;
    }
    if (this.battleEconomySettled || this.battle.phase !== 'battle-result' || !this.battle.battleOutcome) {
      return;
    }

    this.battleEconomySettled = true;
    const levelConfig = this.battle.levelConfig;
    const economy = levelConfig
      ? settleStoryBattleEconomy(
        this.battle.battleOutcome,
        levelConfig.rewards,
        !isStoryLevelCompleted(levelConfig.id),
        levelConfig.id,
      )
      : this.reliefMode
        ? settleReliefBattleEconomy(this.battle.battleOutcome)
        : settleBattleEconomy(
          this.battle.battleOutcome,
          this.battle.player.hp,
          (this.battle.tableThemeConfig?.entryCost ?? 20) * this.stakeMultiplier,
          this.battle.tableThemeConfig?.payoutMultiplier ?? 1.5,
          this.tableThemeId,
          this.stakeMultiplier,
        );
    if (this.battle.battleOutcome === 'victory' && levelConfig) {
      completeStoryLevelAndUnlockNext(levelConfig.id);
    }
    this.economyResult = economy;
    this.battle.log.unshift(this.economyLogText(economy));
  }

  private renderResultModal(): void {
    if (this.battle.mode === 'endless') {
      this.renderEndlessResult();
      return;
    }
    if (
      this.itemFeedback
      || !this.resultModalReady
      || this.isPresentationBusy()
      || this.battle.phase !== 'battle-result'
      || !this.battle.battleOutcome
      || !this.economyResult
    ) {
      return;
    }

    const colors = this.currentUIColors();
    const isVictory = this.battle.battleOutcome === 'victory';
    const container = this.add.container(640, 360).setDepth(100);
    this.ui.push(container);

    container.add(this.add.rectangle(0, 0, 1280, 720, 0x050608, 0.68));
    const storyResultText = this.storyResultText(isVictory);
    const modalHeight = storyResultText ? 390 : 282;
    container.add(MedievalPanel.render(this, {
      width: 520,
      height: modalHeight,
      skin: getBattleThemeArt(this.battleArtSelection.themeId).modalPanel,
      fallbackFill: colors.panel,
      fallbackLine: isVictory ? 0x78d18a : 0xff4b5f,
    }));

    const titleColor = isVictory ? COLORS.green : COLORS.dangerText;
    const title = this.add.text(0, storyResultText ? -148 : -88, isVictory ? t('battle.result.victory') : t('battle.result.defeat'), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '46px',
      color: titleColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 0, titleColor, 12, true, true);

    const goldText = this.add.text(0, storyResultText ? -90 : -24, this.economyResultText(this.economyResult), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '22px',
      color: '#e8cf73',
    }).setOrigin(0.5);
    goldText.setShadow(0, 0, '#e8cf73', 8, true, true);

    const totalText = this.add.text(0, storyResultText ? -56 : 18, t('battle.result.totalGold', { total: this.economyResult.total }), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '18px',
      color: MEDIEVAL_UI_COLORS.textMuted,
    }).setOrigin(0.5);
    const children: Phaser.GameObjects.GameObject[] = [title, goldText, totalText];
    if (storyResultText) {
      children.push(this.add.text(0, 42, storyResultText, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '16px',
        color: MEDIEVAL_UI_COLORS.text,
        align: 'center',
        lineSpacing: 7,
        wordWrap: { width: 430, useAdvancedWrap: true },
      }).setOrigin(0.5));
    }
    const buttonY = storyResultText ? 134 : 68;
    const continueLabel = this.reliefMode && !isVictory ? t('battle.result.retry') : t('battle.result.continue');
    children.push(this.button(-230, buttonY, 200, 50, continueLabel, () => {
      this.continueAfterResult();
    }));
    children.push(this.button(30, buttonY, 200, 50, t('battle.result.returnLobby'), () => {
      this.scene.start('StartScene');
    }));
    container.add(children);
  }

  private economyResultText(economy: EconomyChange): string {
    if (this.battle.levelConfig) {
      if (economy.rewardStatus === 'granted') {
        return t('battle.result.storyFirstClearGold', { amount: economy.amount });
      }
      if (economy.rewardStatus === 'already-claimed') {
        return t('battle.result.storyRewardClaimed');
      }
      return t('battle.result.storyNoGold');
    }

    if (this.reliefMode) {
      return this.battle.battleOutcome === 'victory'
        ? t('battle.result.reliefGold', { amount: economy.amount, total: economy.total })
        : t('battle.result.reliefNoGold');
    }

    return this.battle.battleOutcome === 'victory'
      ? t('battle.result.goldGained', { amount: economy.amount })
      : t('battle.result.noGoldGained');
  }

  private economyLogText(economy: EconomyChange): string {
    if (this.battle.levelConfig) {
      if (economy.rewardStatus === 'granted') {
        return t('log.storyFirstClearGold', { amount: economy.amount, total: economy.total });
      }
      if (economy.rewardStatus === 'already-claimed') {
        return t('log.storyRewardClaimed', { total: economy.total });
      }
      return t('log.storyDefeat', { total: economy.total });
    }

    if (this.reliefMode) {
      return this.battle.battleOutcome === 'victory'
        ? t('log.reliefVictory', { amount: economy.amount, total: economy.total })
        : t('log.reliefDefeat', { total: economy.total });
    }

    return this.battle.battleOutcome === 'victory'
      ? t('log.economyVictory', { amount: economy.amount, total: economy.total })
      : t('log.economyDefeat', { total: economy.total });
  }

  private continueAfterResult(): void {
    const levelId = this.battle.levelConfig?.id;
    if (this.reliefMode && this.battle.battleOutcome === 'defeat' && this.tableThemeId) {
      this.scene.start('BattleScene', {
        tableThemeId: this.tableThemeId,
        stakeMultiplier: 1,
        reliefMode: true,
      });
      return;
    }

    if (!levelId && this.tableThemeId) {
      this.scene.start('TableSelectScene');
      return;
    }

    if (!levelId) {
      this.scene.start('BattleScene', {});
      return;
    }

    if (this.battle.battleOutcome === 'defeat') {
      this.scene.start('BattleScene', { levelId });
      return;
    }

    const nextLevel = getNextStoryLevel(levelId);
    if (!nextLevel) {
      this.scene.start('StorySelectScene');
      return;
    }

    this.scene.start('ChapterIntroScene', {
      introId: introIdForLevel(nextLevel.id),
      levelId: nextLevel.id,
    });
  }

  private renderBlockingMessage(): void {
    if (!this.blockingMessage) {
      return;
    }

    const colors = this.currentUIColors();
    const themeArt = getBattleThemeArt(this.battleArtSelection.themeId);
    this.ui.push(BlockingMessageModal.render(this, {
      title: this.blockingMessage.title,
      body: this.blockingMessage.body,
      buttonLabel: this.blockingMessage.buttonLabel,
      panelSkin: themeArt.modalPanel,
      buttonSkin: themeArt.actionButton,
      colors: {
        panel: colors.panel,
        line: colors.line,
        text: colors.text,
        muted: colors.muted,
        accent: colors.accent,
        accentText: colors.accentText,
        button: colors.button,
        buttonHover: colors.buttonHover,
      },
      onClose: () => {
        this.playClickSound();
        const onClose = this.blockingMessage?.onClose;
        this.blockingMessage = undefined;
        if (onClose) {
          onClose();
          return;
        }

        this.render();
      },
    }));
  }

  private showBlockingMessage(title: string, body: string, buttonLabel = t('battle.modal.continue'), onClose?: () => void): void {
    this.blockingMessage = { title, body, buttonLabel, onClose };
    this.render();
  }

  private showBlockingMessageSequence(messages: Array<{ title: string; body: string }>, onComplete: () => void): void {
    const showAt = (index: number) => {
      const message = messages[index];
      if (!message) {
        onComplete();
        return;
      }

      this.showBlockingMessage(message.title, message.body, t('battle.modal.continue'), () => showAt(index + 1));
    };

    showAt(0);
  }

  private showLevelIntroLessonIfNeeded(onClose?: () => void): boolean {
    const state = this.battle.getState();
    if (this.shownLevelIntroLesson || state.round !== 1 || !state.levelIntroLessonKey) {
      return false;
    }

    this.shownLevelIntroLesson = true;
    this.showBlockingMessage(t(this.battle.levelConfig?.titleKey ?? 'battle.modal.tutorialTitle'), t(state.levelIntroLessonKey), t('battle.modal.understood'), onClose);
    return true;
  }

  private showRoundLessonIfNeeded(): boolean {
    const state = this.battle.getState();
    if (!state.currentFixedRoundId || !state.currentLessonKey || this.shownLessonRoundIds.has(state.currentFixedRoundId)) {
      return false;
    }

    this.shownLessonRoundIds.add(state.currentFixedRoundId);
    this.showBlockingMessage(t('battle.modal.tutorialTitle'), t(state.currentLessonKey), t('battle.modal.understood'));
    return true;
  }

  private showCompareHintIfNeeded(): void {
    const state = this.battle.getState();
    if (!state.currentTutorialBeforeCompareKey || this.shownCompareHintKeys.has(state.currentTutorialBeforeCompareKey)) {
      return;
    }

    this.shownCompareHintKeys.add(state.currentTutorialBeforeCompareKey);
    this.showBlockingMessage(t('battle.modal.tutorialTitle'), t(state.currentTutorialBeforeCompareKey), t('battle.modal.understood'));
  }

  private showPlayerTurnLessonIfNeeded(): boolean {
    const state = this.battle.getState();
    if (
      state.phase !== 'player-turn'
      || !state.currentFixedRoundId
      || !state.currentPlayerTurnLessonKey
      || this.shownPlayerTurnLessonRoundIds.has(state.currentFixedRoundId)
    ) {
      return false;
    }

    this.shownPlayerTurnLessonRoundIds.add(state.currentFixedRoundId);
    this.showBlockingMessage(t('battle.modal.tutorialTitle'), t(state.currentPlayerTurnLessonKey), t('battle.modal.understood'));
    return true;
  }

  private showInviteDialogueIfNeeded(enemyId: string, onComplete: () => void): boolean {
    const fixedRound = this.battle.levelConfig?.fixedRounds?.[this.battle.round - 1];
    const fixedEnemy = fixedRound?.enemies.find((enemy) => enemy.enemyId === enemyId);
    if (!fixedRound || !fixedEnemy?.inviteDialogueKeys?.length) {
      return false;
    }

    const dialogueId = `${fixedRound.id}:${enemyId}:invite`;
    if (this.shownInviteDialogueIds.has(dialogueId)) {
      return false;
    }

    this.shownInviteDialogueIds.add(dialogueId);
    this.showBlockingMessageSequence(
      fixedEnemy.inviteDialogueKeys.map((key) => this.dialogueMessageFromKey(key)),
      onComplete,
    );
    return true;
  }

  private showRevealDialogueIfNeeded(onClose: () => void): boolean {
    const fixedRound = this.battle.levelConfig?.fixedRounds?.[this.battle.round - 1];
    if (!fixedRound || this.shownRevealDialogueRoundIds.has(fixedRound.id)) {
      return false;
    }

    const dialogueKeys = [
      ...(fixedRound.afterRevealDialogueKeys ?? []),
      ...fixedRound.enemies.flatMap((fixedEnemy) => {
        const enemy = this.battle.enemies.find((candidate) => candidate.id === fixedEnemy.enemyId);
        return enemy?.invited === undefined ? fixedEnemy.compareWithoutInviteDialogueKeys ?? [] : [];
      }),
    ];
    if (dialogueKeys.length === 0) {
      return false;
    }

    this.shownRevealDialogueRoundIds.add(fixedRound.id);
    this.showBlockingMessage(
      enemyName('bartender'),
      dialogueKeys.map((key) => t(key).replace(/^酒保：/, '').replace(/^Bartender: /, '')).join('\n'),
      t('battle.modal.continue'),
      onClose,
    );
    return true;
  }

  private dialogueMessageFromKey(key: string): { title: string; body: string } {
    const raw = t(key);
    const goblinPrefixes = ['哥布林：', 'Goblin: '];
    const gamblerPrefixes = ['赌徒：', 'Gambler: '];
    const werewolfPrefixes = ['狼人：', 'Werewolf: '];
    const paladinPrefixes = ['圣骑士：', 'Paladin: '];
    const merchantPrefixes = ['商人：', 'Merchant: '];
    const keeperPrefixes = ['酒馆老板：', 'Tavern Owner: '];
    const bartenderPrefixes = ['酒保：', 'Bartender: '];
    const goblinPrefix = goblinPrefixes.find((prefix) => raw.startsWith(prefix));
    if (goblinPrefix) {
      return { title: enemyName('goblin'), body: raw.slice(goblinPrefix.length) };
    }

    const gamblerPrefix = gamblerPrefixes.find((prefix) => raw.startsWith(prefix));
    if (gamblerPrefix) {
      return { title: enemyName('gambler'), body: raw.slice(gamblerPrefix.length) };
    }

    const werewolfPrefix = werewolfPrefixes.find((prefix) => raw.startsWith(prefix));
    if (werewolfPrefix) {
      return { title: enemyName('werewolf'), body: raw.slice(werewolfPrefix.length) };
    }

    const paladinPrefix = paladinPrefixes.find((prefix) => raw.startsWith(prefix));
    if (paladinPrefix) {
      return { title: enemyName('paladin'), body: raw.slice(paladinPrefix.length) };
    }

    const merchantPrefix = merchantPrefixes.find((prefix) => raw.startsWith(prefix));
    if (merchantPrefix) {
      return { title: enemyName('merchant'), body: raw.slice(merchantPrefix.length) };
    }

    const keeperPrefix = keeperPrefixes.find((prefix) => raw.startsWith(prefix));
    if (keeperPrefix) {
      return { title: enemyName('keeper'), body: raw.slice(keeperPrefix.length) };
    }

    const bartenderPrefix = bartenderPrefixes.find((prefix) => raw.startsWith(prefix));
    if (bartenderPrefix) {
      return { title: enemyName('bartender'), body: raw.slice(bartenderPrefix.length) };
    }

    return { title: t('battle.modal.tutorialTitle'), body: raw };
  }

  private storyResultText(isVictory: boolean): string {
    const levelId = this.battle.levelConfig?.id;
    const keys = this.resultSummaryKeys(levelId, isVictory);
    return keys.map((key) => t(key)).join('\n');
  }

  private resultSummaryKeys(levelId: string | undefined, isVictory: boolean): string[] {
    if (levelId === 'chapter1_1') {
      return [isVictory ? 'tutorial.chapter1.unlockInvite' : 'tutorial.chapter1.defeat1'];
    }

    if (levelId === 'chapter1_3') {
      return [isVictory ? 'tutorial.chapter1_3.unlockResonance' : 'tutorial.chapter1_3.defeatHint3'];
    }

    if (levelId === 'chapter1_6') {
      return [isVictory ? 'tutorial.chapter1_6.unlockItems' : 'tutorial.chapter1_6.defeatHint3'];
    }

    if (levelId === 'chapter1_7') {
      return [isVictory ? 'tutorial.chapter1_7.unlockFinalTrial' : 'tutorial.chapter1_7.defeatHint4'];
    }

    if (levelId === 'chapter1_8') {
      return [isVictory ? 'tutorial.chapter1_8.chapterComplete' : 'tutorial.chapter1_8.defeatHint4'];
    }

    if (levelId === 'chapter1_9') {
      return [isVictory ? 'tutorial.chapter1_9.chapterComplete' : 'tutorial.chapter1_9.defeatHint4'];
    }

    return [];
  }

  private showResultStoryIfNeeded(onComplete: () => void): boolean {
    if (this.shownResultStory || !this.battle.battleOutcome) {
      return false;
    }

    const keys = this.resultStoryKeys(this.battle.levelConfig?.id, this.battle.battleOutcome);
    if (keys.length === 0) {
      return false;
    }

    this.shownResultStory = true;
    this.showBlockingMessageSequence(keys.map((key) => this.dialogueMessageFromKey(key)), onComplete);
    return true;
  }

  private resultStoryKeys(levelId: string | undefined, outcome: 'victory' | 'defeat'): string[] {
    if (levelId === 'chapter1_3') {
      return [outcome === 'victory' ? 'tutorial.chapter1_3.victory2' : 'tutorial.chapter1_3.defeat4'];
    }

    if (levelId === 'chapter1_6') {
      return [outcome === 'victory' ? 'tutorial.chapter1_6.victory2' : 'tutorial.chapter1_6.defeat4'];
    }

    if (levelId === 'chapter1_7') {
      return [outcome === 'victory' ? 'tutorial.chapter1_7.victory2' : 'tutorial.chapter1_7.defeat4'];
    }

    if (levelId === 'chapter1_8') {
      return [outcome === 'victory' ? 'tutorial.chapter1_8.victory2' : 'tutorial.chapter1_8.defeat2'];
    }

    if (levelId === 'chapter1_9') {
      return [outcome === 'victory' ? 'tutorial.chapter1_9.victory5' : 'tutorial.chapter1_9.defeat2'];
    }

    if (levelId === 'chapter1_1') {
      return [outcome === 'victory' ? 'tutorial.chapter1.victory2' : 'tutorial.chapter1.defeat2'];
    }

    return [];
  }

  private renderItemFeedback(): void {
    if (!this.itemFeedback || this.battle.phase === 'battle-result') {
      return;
    }

    const colors = this.currentUIColors();
    const container = this.add.container(640, 360).setDepth(90);
    this.ui.push(container);
    const stroke = this.itemFeedback.success ? 0x78d18a : 0xff4b5f;
    const titleColor = this.itemFeedback.success ? COLORS.green : COLORS.dangerText;

    container.add(this.add.rectangle(0, 0, 1280, 720, 0x050608, 0.62));
    container.add(MedievalPanel.render(this, {
      width: 430,
      height: 260,
      skin: getBattleThemeArt(this.battleArtSelection.themeId).modalPanel,
      fallbackFill: colors.panel,
      fallbackLine: stroke,
    }));
    const title = this.add.text(0, -76, this.itemFeedback.title, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '30px',
      color: titleColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 0, titleColor, 10, true, true);

    container.add([
      title,
      this.add.text(0, -8, this.itemFeedback.message, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '20px',
        color: MEDIEVAL_UI_COLORS.text,
        align: 'center',
        lineSpacing: 8,
        wordWrap: { width: 340, useAdvancedWrap: true },
      }).setOrigin(0.5),
      this.button(-90, 72, 180, 48, t('battle.itemFeedback.confirm'), () => {
        this.itemFeedback = undefined;
        this.render();
      }),
    ]);
  }

  private button(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    fill?: number,
    fontSize = '19px',
    sound: 'button' | 'card' | 'none' = 'button',
    visualVariant?: MedievalButtonVariant,
  ): Phaser.GameObjects.Container {
    const colors = this.currentUIColors();
    const resolvedFill = fill ?? colors.button;
    const resolvedVariant = visualVariant ?? (resolvedFill === colors.danger ? 'danger' : 'normal');
    const skin = getBattleThemeArt(this.battleArtSelection.themeId).actionButton;
    if (skin) {
      return MedievalButton.render(this, {
        x,
        y,
        width,
        height,
        label,
        fontSize,
        variant: resolvedVariant,
        skin,
        onActivate: () => {
          if (sound !== 'none') {
            this.playClickSound(sound);
          }
          onClick();
        },
      });
    }

    const fallbackFill = resolvedVariant === 'primary'
      ? colors.buttonHover
      : resolvedVariant === 'secondary' ? colors.panel : resolvedFill;
    const button = this.add.container(x, y);
    const rect = this.add.rectangle(width / 2, height / 2, width, height, fallbackFill).setStrokeStyle(2, colors.line);
    const text = this.add.text(width / 2, height / 2, label, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize,
      color: colors.text,
    }).setOrigin(0.5);

    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerover', () => rect.setFillStyle(colors.buttonHover));
    rect.on('pointerout', () => rect.setFillStyle(fallbackFill));
    rect.on('pointerdown', () => {
      if (sound !== 'none') {
        this.playClickSound(sound);
      }
      onClick();
    });

    button.add([rect, text]);
    return button;
  }

  private battleActionButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    variant: 'normal' | 'primary' | 'secondary' | 'danger',
    fontSize = '19px',
    sound: 'button' | 'card' | 'none' = 'button',
  ): Phaser.GameObjects.Container {
    const colors = this.currentUIColors();
    return this.button(
      x,
      y,
      width,
      height,
      label,
      onClick,
      variant === 'danger' ? colors.danger : colors.button,
      fontSize,
      sound,
      variant,
    );
  }

  private playClickSound(sound: 'button' | 'card' = 'button'): void {
    this.sound.play(sound === 'card' ? 'cardPlace' : 'buttonClick', { volume: 0.42 });
  }

  private queuePlayerResonanceFeedbackIfChanged(): void {
    if (!this.hasMechanic('resonance')) {
      return;
    }

    if (this.observedPlayerResonanceRound !== this.battle.round) {
      this.observedPlayerResonanceRound = this.battle.round;
      this.observedPlayerResonanceMultiplier = 1;
    }

    if (
      this.battle.phase === 'choice'
      || (this.battle.player.fateMode && !this.battle.roundRevealed)
    ) {
      return;
    }

    const score = this.battle.playerScore();
    const multiplier = score.resonance === 'none' ? 1 : score.multiplier;
    if (multiplier === this.observedPlayerResonanceMultiplier) {
      return;
    }

    this.observedPlayerResonanceMultiplier = multiplier;
    if (multiplier <= 1) {
      return;
    }

    this.pendingPlayerResonanceFeedback = {
      label: this.resonanceText(score),
      multiplier,
      strong: score.resonance === 'strong' || score.resonance === 'boom',
      boom: score.resonance === 'boom',
    };
  }

  private flushPlayerResonanceFeedback(): void {
    if (
      !this.pendingPlayerResonanceFeedback
      || this.dealing
      || this.actionDealing
      || this.playerRedealing
      || this.blockingMessage
      || this.itemModalOpen
      || this.battle.endlessLedger?.shop.isOpen
    ) {
      return;
    }

    const feedback = this.pendingPlayerResonanceFeedback;
    this.pendingPlayerResonanceFeedback = undefined;
    this.playPlayerResonancePopup(feedback);
  }

  private playPlayerResonancePopup(feedback: { label: string; multiplier: number; strong: boolean; boom: boolean }): void {
    this.playerResonancePopup?.destroy(true);
    this.playerResonanceShade?.destroy();

    const seat = this.battleLayout.seats.player;
    const hud = this.battleLayout.playerHud;
    const cardCount = this.battle.player.hand.length;
    const x = seat.x + this.playerHandCenterX(cardCount);
    const targetY = seat.y + hud.hand.y - 84;
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x20252d, 0)
      .setDepth(10);
    this.playerResonanceShade = shade;
    const popup = this.add.container(x, targetY + 10)
      .setDepth(76)
      .setAlpha(0)
      .setScale(0.74);
    this.playerResonancePopup = popup;

    const label = this.add.text(0, 0, feedback.label, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: feedback.strong ? '38px' : '33px',
      color: feedback.boom ? '#ffd36a' : feedback.strong ? '#fff0ae' : '#ffe08a',
      fontStyle: 'bold',
      stroke: '#3b2105',
      strokeThickness: 5,
    }).setOrigin(0.5);
    label.setShadow(0, 0, feedback.boom ? '#ff3b24' : '#ffc43d', feedback.boom ? 28 : feedback.strong ? 22 : 16, true, true);
    popup.add(label);

    this.sound.play('resonanceEcho', {
      volume: feedback.strong ? 0.56 : 0.48,
      rate: Math.min(1.16, 1 + Math.max(0, feedback.multiplier - 2) * 0.06),
    });
    this.tweens.add({
      targets: shade,
      alpha: feedback.strong ? 0.42 : 0.34,
      duration: 180,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: popup,
      y: targetY,
      alpha: 1,
      scale: 1,
      duration: 230,
      ease: 'Back.easeOut',
    });
    this.time.delayedCall(760, () => {
      if (!popup.active) {
        return;
      }
      this.tweens.add({
        targets: shade,
        alpha: 0,
        duration: 280,
        ease: 'Sine.easeIn',
        onComplete: () => {
          shade.destroy();
          if (this.playerResonanceShade === shade) {
            this.playerResonanceShade = undefined;
          }
        },
      });
      this.tweens.add({
        targets: popup,
        y: targetY - 14,
        alpha: 0,
        duration: 280,
        ease: 'Sine.easeIn',
        onComplete: () => {
          popup.destroy(true);
          if (this.playerResonancePopup === popup) {
            this.playerResonancePopup = undefined;
          }
        },
      });
    });
  }

  private renderEndlessShop(): void {
    const accounting = this.battle.getState().endlessAccounting;
    if (!accounting?.shop.visit || this.battle.battleOutcome
      || this.battle.phase !== 'round-result' && !this.battle.endlessLedger?.shop.isOpeningVisit || this.isPresentationBusy()) return;
    this.ui.push(renderEndlessShopModal(this, {
      accounting,
      message: this.endlessShopMessage,
      onBuy: (id, visitId) => {
        const result = this.battle.buyEndlessItem(id, visitId);
        this.endlessShopMessage = result.bought ? t('endless.shop.purchased', { price: result.price }) : t(`endless.shop.${result.reason}`);
        this.playClickSound();
        this.render();
      },
      onFinish: (visitId) => {
        const opening = this.battle.endlessLedger?.shop.isOpeningVisit;
        if (!this.battle.finishEndlessShopVisit(visitId)) { this.render(); return; }
        this.endlessShopMessage = undefined;
        this.playClickSound();
        if (opening) this.playRoundStartBannerThenDeal();
        else this.render();
      },
    }));
  }

  private renderItemModal(): void {
    if (!this.itemModalOpen || this.battle.phase === 'battle-result') {
      return;
    }

    const colors = this.currentUIColors();
    const themeArt = getBattleThemeArt(this.battleArtSelection.themeId);
    const cardStates = this.battleItemCardStates();
    const guideItemId = this.tutorialItemIdForRound();
    const container = ItemPickerModal.render(this, {
      items: cardStates,
      page: this.itemModalPage,
      animateOpen: !this.itemModalHasAnimated,
      cardFrameTextureKey: ITEM_CARD_FRAME_ART.textureKey,
      title: t('battle.itemModal.title'),
      usageLabel: this.battle.mode === 'endless' ? t('endless.items.usage', { count: this.totalBattleItemCount(), capacity: ENDLESS_CONFIG.inventoryCapacity }) : t('battle.itemButtonUsage', { used: this.battleItemUses, max: MAX_BATTLE_ITEM_USES }),
      phaseHint: this.remainingBattleItemUses() > 0
        ? t('battle.itemModal.phaseHint')
        : t('battle.itemModal.limitReached', { max: MAX_BATTLE_ITEM_USES }),
      selectHint: t('battle.itemModal.selectHint'),
      emptyLabel: t(this.battle.mode === 'endless' ? 'endless.items.empty' : 'battle.itemModal.empty'),
      useLabel: t('battle.itemModal.use'),
      closeLabel: t('battle.itemModal.close'),
      panelSkin: themeArt.modalPanel,
      buttonSkin: themeArt.actionButton,
      colors: {
        panel: colors.panel,
        line: colors.line,
        text: colors.text,
        muted: colors.muted,
        accent: colors.accent,
        accentText: colors.accentText,
        dangerText: colors.dangerText,
      },
      onSelect: (itemId) => {
        this.selectedBattleItemId = itemId;
        this.render();
      },
      onUse: (itemId) => {
        const item = ITEMS.find((candidate) => candidate.id === itemId);
        if (!item) {
          return;
        }
        this.playClickSound();
        this.itemModalHasAnimated = false;
        this.useItemFromModal(item);
      },
      onPageChange: (page) => {
        this.playClickSound();
        this.itemModalPage = page;
        this.selectedBattleItemId = undefined;
        this.itemModalHasAnimated = false;
        this.render();
      },
      onClose: () => {
        this.playClickSound();
        this.selectedBattleItemId = undefined;
        this.itemModalPage = 0;
        this.itemModalHasAnimated = false;
        this.itemModalOpen = false;
        this.render();
      },
      guideItemId: guideItemId && this.selectedBattleItemId !== guideItemId ? guideItemId : undefined,
      guideUseButton: Boolean(guideItemId && this.selectedBattleItemId === guideItemId),
    });
    this.itemModalHasAnimated = true;
    this.ui.push(container);
  }

  private battleItemCardStates(): BattleItemCardState[] {
    const counts = this.battleItemCounts();
    const tutorialItemId = this.tutorialItemIdForRound();
    return ITEMS
      .filter((item) => (counts[item.id] ?? 0) > 0)
      .filter((item) => !tutorialItemId || item.id === tutorialItemId)
      .map((item) => {
        const iconArt = getBattleIconArtByResourceKey(item.resourceKey);
        const available = this.canUseItemNow(item);
        return {
          id: item.id,
          icon: item.icon,
          iconTextureKey: iconArt && this.textures.exists(iconArt.textureKey) ? iconArt.textureKey : undefined,
          name: t(item.nameKey),
          description: t(battleItemDescriptionKey(this.battle.mode, item)),
          count: counts[item.id] ?? 0,
          available,
          unavailableReason: available ? undefined : this.itemUnavailableReason(item),
          timingLabel: t(this.itemTimingHintKey(item)),
          selected: this.selectedBattleItemId === item.id,
        };
      });
  }

  private itemUnavailableReason(item: ItemDefinition): string {
    if (item.id === 'resonance_dice' && this.battle.playerScore().resonance === 'none') return t('itemEffect.resonanceDice.requiresResonance');
    if (item.id === 'heal_potion' && this.battle.player.hp >= this.battle.player.maxHp) return t('itemEffect.healPotion.fullHp');
    if (item.id === 'holy_shield' && this.battle.player.shieldCharges > 0) return t('itemEffect.holyShield.active');
    if (this.itemUseLimitReached(item)) {
      return t('battle.itemModal.itemLimitReached', { max: item.maxUsesPerBattle ?? 0 });
    }
    if (this.remainingBattleItemUses() <= 0) {
      return t('battle.itemModal.limitReached', { max: MAX_BATTLE_ITEM_USES });
    }
    return t(this.itemTimingHintKey(item));
  }

  private itemTimingHintKey(item: ItemDefinition): string {
    if (item.id === 'heal_potion' || item.id === 'resonance_dust') {
      return 'battle.itemModal.timingUnknownHand';
    }

    return 'battle.itemModal.timingPlayerTurn';
  }

  private useItemFromModal(item: ItemDefinition): void {
    if ((this.battleItemCounts()[item.id] ?? 0) <= 0 || !this.canUseItemNow(item)) return;
    if (this.itemUseLimitReached(item)) {
      this.showSkillTooltip(640, 592, t(item.nameKey), t('battle.itemModal.itemLimitReached', { max: item.maxUsesPerBattle ?? 0 }));
      return;
    }

    if (this.remainingBattleItemUses() <= 0) {
      this.showSkillTooltip(640, 592, t('battle.itemModal.title'), t('battle.itemModal.limitReached', { max: MAX_BATTLE_ITEM_USES }));
      return;
    }

    const hpBefore = this.hpSnapshot();
    const riskBefore = this.battle.player.incomingDamageBonus;
    const playerHandBefore = [...this.battle.player.hand];
    const result = useBattleItem(item.id, this.battle);
    if (this.endlessSaveError) { this.render(); return; }
    if (result.used) {
      this.setPlayerPortraitPose('cast');
      this.selectedBattleItemId = undefined;
      this.consumeBattleItem(item.id);
      this.battleItemUses += 1;
      this.battleItemUseCounts[item.id] = (this.battleItemUseCounts[item.id] ?? 0) + 1;
      this.itemFeedback = result.feedback;
    }

    if (result.used && result.revealAfterFeedback) {
      this.playBeerHealThenReveal(result.healed ?? Math.max(0, this.battle.player.hp - hpBefore.player), hpBefore);
      return;
    }

    if (result.used && (item.id === 'cooling_charm' || item.id === 'resonance_dice')) {
      const events: BattlePresentationEvent[] = this.battle.player.hand.map((card, cardIndex) => ({
        type: 'card-dealt',
        target: 'player',
        card,
        cardIndex,
        context: 'action',
      }));
      this.playFateRerollThenRedeal(playerHandBefore, events, Math.max(0, this.battle.player.incomingDamageBonus - riskBefore),
        item.id === 'resonance_dice' ? result.message : undefined);
      return;
    }

    if (result.used && item.id === 'resonance_dust') {
      this.playResonanceHornPresentation();
      return;
    }

    if (result.used && item.id === 'holy_shield' && result.shieldCharges) {
      this.playHolyShieldActivationPresentation(result.shieldCharges);
      return;
    }

    if (result.used) {
      this.queuePlayerResonanceFeedbackIfChanged();
    }

    this.playHealSoundIfHpIncreased(hpBefore);
    this.itemModalOpen = false;
    const events = this.battle.consumePresentationEvents();
    this.presentationSequencePlaying = true;
    this.playImmediatePresentationEvents(events);
    const shouldDelayResultModal = this.shouldDelayOutcomeForPresentation(events);
    this.resultModalReady = !shouldDelayResultModal;
    if (!this.hasCombatEvents(events)) {
      this.render();
    }
    this.playPostActionAnimations(events, hpBefore, this.currentRevealEnemyIds(), false, () => {
      if (this.hasPendingSoulRedeem()) {
        this.presentationSequencePlaying = false;
        this.playPendingSoulRedeemBannerThen();
        return;
      }

      if (!shouldDelayResultModal) {
        this.presentationSequencePlaying = false;
        this.render();
        return;
      }

      const showResult = () => {
        this.resultModalReady = true;
        this.presentationSequencePlaying = false;
        this.render();
      };

      if (this.showResultStoryIfNeeded(showResult)) {
        return;
      }

      showResult();
    });
    if (!result.used) {
      this.showSkillTooltip(640, 592, t(item.nameKey), result.message);
    }
  }

  private playFateRerollThenRedeal(previousHand: Card[], events: BattlePresentationEvent[], riskGain: number, resonanceMessage?: string): void {
    const player = this.playerSeatCenter();
    const hand = this.playerHandEffectCenter();
    this.itemModalOpen = false;
    this.itemFeedback = undefined;
    this.presentationSequencePlaying = true;
    this.actionAnimationPlaying = true;
    this.itemEffectPlayerHandHidden = true;
    this.render();

    this.itemEffectPresenter.playFateReroll({
      iconTextureKey: getBattleIconArt(resonanceMessage ? 'resonance-dice' : 'fate-reroll').textureKey,
      resonanceReroll: !!resonanceMessage,
      player,
      hand,
      cards: previousHand,
      cardWidth: this.battleLayout.cards.width,
      cardSpacing: this.battleLayout.cards.spacing,
      onCardsConsumed: () => undefined,
      onComplete: () => {
        this.itemEffectPlayerHandHidden = false;
        this.playPlayerRedealPresentation(events, () => {
          this.actionAnimationPlaying = false;
          this.presentationSequencePlaying = false;
          this.render();
          if (riskGain > 0) this.playStatusGainText(player, 'risk', riskGain);
          if (resonanceMessage) {
            const label = this.add.text(hand.x, hand.y - 90, resonanceMessage, {
              fontFamily: GAME_FONT_FAMILY, fontSize: '18px', color: '#e4ccff',
              stroke: '#1b1029', strokeThickness: 4,
            }).setOrigin(0.5).setDepth(70);
            this.tweens.add({ targets: label, y: label.y - 30, alpha: 0, delay: 650, duration: 950,
              onComplete: () => label.destroy() });
          }
        });
      },
    });
  }

  private playResonanceHornPresentation(): void {
    const player = this.playerSeatCenter();
    this.itemModalOpen = false;
    this.itemFeedback = undefined;
    this.presentationSequencePlaying = true;
    this.actionAnimationPlaying = true;
    this.itemEffectPlayerHandHidden = true;
    this.battle.consumePresentationEvents();
    this.render();

    this.itemEffectPresenter.playResonanceHorn({
      iconTextureKey: getBattleIconArt('resonance-horn').textureKey,
      player,
      label: t('itemEffect.resonanceHorn.response'),
      onReveal: () => {
        this.itemEffectPlayerHandHidden = false;
        this.queuePlayerResonanceFeedbackIfChanged();
        this.render();
      },
      onComplete: () => {
        this.itemEffectPlayerHandHidden = false;
        this.actionAnimationPlaying = false;
        this.presentationSequencePlaying = false;
        this.render();
      },
    });
  }

  private playHolyShieldActivationPresentation(charges: number): void {
    const player = this.playerSeatCenter();
    this.itemModalOpen = false;
    this.itemFeedback = undefined;
    this.presentationSequencePlaying = true;
    this.actionAnimationPlaying = true;
    this.visualPlayerShieldChargesOverride = 0;
    this.battle.consumePresentationEvents();
    this.render();

    this.itemEffectPresenter.playHolyShieldActivation({
      iconTextureKey: getBattleIconArt('holy-shield').textureKey,
      player,
      charges,
      label: t('battle.holyShield.status', { charges }),
      onActivated: () => {
        this.visualPlayerShieldChargesOverride = undefined;
        this.render();
        this.playStatusGainText(player, 'shield', charges);
      },
      onComplete: () => {
        this.visualPlayerShieldChargesOverride = undefined;
        this.actionAnimationPlaying = false;
        this.presentationSequencePlaying = false;
        this.render();
      },
    });
  }

  private playBeerHealThenReveal(healed: number, hpBefore: { player: number; enemies: number[] }): void {
    const player = this.playerSeatCenter();
    this.itemModalOpen = false;
    this.itemFeedback = undefined;
    this.presentationSequencePlaying = true;
    this.actionAnimationPlaying = true;
    this.visualHpOverride = hpBefore;
    this.render();

    this.itemEffectPresenter.playFateBeer({
      iconTextureKey: getBattleIconArt('fate-beer').textureKey,
      player,
      iconStart: { x: player.x + 172, y: player.y - 16 },
      onDrink: () => {
        this.visualHpOverride = undefined;
        this.itemEffectPlayerHandRevealed = true;
        this.render();
        this.playFateBeerHealEffect(healed);
      },
      onComplete: () => this.time.delayedCall(240, () => {
        // Beer healing has already been presented. Combat must start from this
        // healed state, not the snapshot taken before drinking.
        const hpBeforeReveal = this.hpSnapshot();
        this.visualHpOverride = {
          player: hpBeforeReveal.player,
          enemies: [...hpBeforeReveal.enemies],
        };
        this.battle.execute({ type: 'reveal-by-item' });
        if (this.endlessSaveError) { this.render(); return; }
        this.itemEffectPlayerHandRevealed = false;
        this.queuePlayerResonanceFeedbackIfChanged();
        const events = this.battle.consumePresentationEvents();
        const revealEnemyIds = this.currentRevealEnemyIds();
        this.revealFocusPlaying = revealEnemyIds.size > 0;
        this.revealFocusPendingEnemyIds = new Set(revealEnemyIds);
        this.playImmediatePresentationEvents(events);
        const shouldDelayResultModal = this.shouldDelayOutcomeForPresentation(events);
        this.resultModalReady = !shouldDelayResultModal;
        this.render();

        this.time.delayedCall(620, () => this.playPostActionAnimations(events, hpBeforeReveal, revealEnemyIds, true, () => {
          this.visualHpOverride = undefined;
          if (this.hasPendingSoulRedeem()) {
            this.actionAnimationPlaying = false;
            this.presentationSequencePlaying = false;
            this.playPendingSoulRedeemBannerThen();
            return;
          }

          if (!shouldDelayResultModal) {
            this.actionAnimationPlaying = false;
            this.presentationSequencePlaying = false;
            this.render();
            return;
          }

          const showResult = () => {
            this.resultModalReady = true;
            this.actionAnimationPlaying = false;
            this.presentationSequencePlaying = false;
            this.render();
          };

          if (this.showResultStoryIfNeeded(showResult)) {
            return;
          }

          showResult();
        }, false, false));
      }),
    });
  }

  private playFateBeerHealEffect(amount: number): void {
    const { x, y } = this.playerSeatCenter();
    const glow = this.add.circle(x, y, 58, 0x78d18a, 0.2).setStrokeStyle(4, 0x9dffae, 0.9).setDepth(58);
    const innerGlow = this.add.circle(x, y, 26, 0xb9ffc2, 0.32).setDepth(59);
    const halo = this.add.circle(x, y, 18, 0x78d18a, 0.1).setStrokeStyle(3, 0xd0ffd4, 0.95).setDepth(60);

    this.sound.play('healSound', { volume: 0.56 });
    this.playHealGainText(x, y - 86, amount, 64);
    this.playBeerBubbles(x, y - 20, 0x9dffae);
    this.tweens.add({
      targets: glow,
      scale: 2.25,
      alpha: 0,
      duration: 720,
      ease: 'Cubic.easeOut',
      onComplete: () => glow.destroy(),
    });
    this.tweens.add({
      targets: innerGlow,
      scale: 2.8,
      alpha: 0,
      duration: 620,
      ease: 'Quad.easeOut',
      onComplete: () => innerGlow.destroy(),
    });
    this.tweens.add({
      targets: halo,
      scale: 4,
      alpha: 0,
      duration: 820,
      ease: 'Sine.easeOut',
      onComplete: () => halo.destroy(),
    });
  }

  private playBeerBubbles(x: number, y: number, color = 0xfff4c9): void {
    [-18, -7, 6, 18].forEach((offset, index) => {
      const bubble = this.add.circle(x + offset, y + (index % 2) * 7, 4 + (index % 2), color, 0.82).setDepth(63);
      this.tweens.add({
        targets: bubble,
        y: bubble.y - 32 - index * 5,
        x: bubble.x + (index - 1.5) * 8,
        alpha: 0,
        scale: 1.8,
        duration: 440 + index * 70,
        ease: 'Sine.easeOut',
        onComplete: () => bubble.destroy(),
      });
    });
  }

  private holyShieldAura(charges: number): Phaser.GameObjects.Container {
    const shield = this.add.container(0, 0);
    const chargeBoost = Math.min(0.06, Math.max(0, charges - 1) * 0.025);
    const dome = this.add.circle(0, 0, 72, 0xd6a23f, 0.07 + chargeBoost)
      .setStrokeStyle(2, 0xffe29a, 0.66);
    const outer = this.add.circle(0, 0, 77, 0xd6a23f, 0.025)
      .setStrokeStyle(4, 0xe6b957, 0.52 + chargeBoost)
      .setBlendMode(Phaser.BlendModes.ADD);
    const sheen = this.add.ellipse(-18, -19, 52, 30, 0xffefbd, 0.075)
      .setRotation(-0.42)
      .setBlendMode(Phaser.BlendModes.ADD);
    const emblemGlow = this.add.circle(0, 0, 30, 0xe6b957, 0.12)
      .setBlendMode(Phaser.BlendModes.ADD);
    const emblem = this.createHolyShieldEmblem(0, 0, 0xffdfa0, 0xd29a35, 0.76);
    shield.add([dome, outer, sheen, emblemGlow, emblem]);
    const phase = (Math.sin(this.time.now * 0.0026) + 1) / 2;
    shield.setScale(0.99 + phase * 0.018);
    this.tweens.add({
      targets: shield,
      scale: 1.025,
      duration: 1250,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: [dome, outer, sheen, emblemGlow],
      alpha: '+=0.08',
      duration: 1080,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return shield;
  }

  private createHolyShieldEmblem(
    x: number,
    y: number,
    lineColor: number,
    fillColor: number,
    alpha = 1,
  ): Phaser.GameObjects.Graphics {
    const emblem = this.add.graphics().setPosition(x, y).setAlpha(alpha);
    emblem.fillStyle(fillColor, 0.22);
    emblem.lineStyle(3, lineColor, 0.96);
    emblem.beginPath();
    emblem.moveTo(-20, -22);
    emblem.lineTo(20, -22);
    emblem.lineTo(17, 8);
    emblem.lineTo(0, 27);
    emblem.lineTo(-17, 8);
    emblem.closePath();
    emblem.fillPath();
    emblem.strokePath();
    emblem.lineStyle(2, lineColor, 0.72);
    emblem.beginPath();
    emblem.moveTo(0, -15);
    emblem.lineTo(0, 16);
    emblem.moveTo(-11, -4);
    emblem.lineTo(11, -4);
    emblem.strokePath();
    return emblem;
  }

  private playHolyShieldBlock(blockedDamage: number, onComplete: () => void): void {
    this.itemEffectPresenter.playHolyShieldBlock({
      iconTextureKey: getBattleIconArt('holy-shield').textureKey,
      player: this.playerSeatCenter(),
      blockedDamage,
      label: t('battle.holyShield.blocked'),
      onComplete,
    });
  }

  private canUseItemNow(item: ItemDefinition): boolean {
    return !(item.id === 'heal_potion' && this.battle.player.hp >= this.battle.player.maxHp)
      && !this.itemUseLimitReached(item)
      && this.remainingBattleItemUses() > 0
      && canUseBattleItemFromState(item.id, this.battle.getState());
  }

  private tutorialItemIdForRound(): ItemId | undefined {
    if (this.battle.levelConfig?.tutorialFocus !== 'items') {
      return undefined;
    }
    const roundId = this.battle.getState().currentFixedRoundId;
    if (roundId === 'chapter1_7_round1') return 'heal_potion';
    if (roundId === 'chapter1_7_round2') return 'cooling_charm';
    if (roundId === 'chapter1_7_round3') return 'resonance_dust';
    return undefined;
  }

  private shouldShowTutorialItemBar(): boolean {
    if (this.battle.levelConfig?.tutorialFocus !== 'items') {
      return true;
    }
    const state = this.battle.getState();
    if (state.currentFixedRoundId === 'chapter1_7_round2') {
      return state.phase === 'player-turn' || (this.battleItemUseCounts.cooling_charm ?? 0) > 0;
    }
    return true;
  }

  private tutorialGuideTarget(): 'view-hand' | 'invite-one' | 'compare' | 'player-stand' | 'skill-shift' | 'skill-summon' | 'item-bag' | undefined {
    const state = this.battle.getState();
    const roundId = state.currentFixedRoundId;
    if (roundId === 'chapter1_6_round1') {
      if (state.phase === 'choice') return 'view-hand';
      if (state.phase === 'player-turn') return state.player.resonanceShiftUsed ? 'player-stand' : 'skill-shift';
    }
    if (roundId === 'chapter1_6_round2') {
      if (state.phase === 'choice') return 'view-hand';
      if (state.phase === 'player-turn') return state.player.resonanceSummonUsed ? 'player-stand' : 'skill-summon';
    }
    if (roundId === 'chapter1_7_round1' && state.phase === 'choice' && (this.battleItemUseCounts.heal_potion ?? 0) === 0) {
      return 'item-bag';
    }
    if (roundId === 'chapter1_7_round2') {
      if (state.phase === 'choice') return 'view-hand';
      if (state.phase === 'enemy-turn') return 'invite-one';
      if (state.phase === 'player-turn') return (this.battleItemUseCounts.cooling_charm ?? 0) > 0 ? 'player-stand' : 'item-bag';
    }
    if (roundId === 'chapter1_7_round3') {
      if (state.phase === 'choice' && (this.battleItemUseCounts.resonance_dust ?? 0) === 0) return 'item-bag';
      if (state.phase === 'enemy-turn') return 'compare';
    }
    return undefined;
  }

  private renderGraduationTutorial(): void {
    if (this.battle.levelConfig?.tutorialFocus !== 'graduation' || this.graduationTutorialStep >= 8) return;
    const state = this.battle.getState();
    if (state.round > 1 || state.battleOutcome || state.phase === 'round-result') {
      this.graduationTutorialStep = 8;
      return;
    }
    if (this.isPresentationBusy() || this.blockingMessage || this.itemModalOpen
        || this.battle.endlessLedger?.shop.isOpen || this.itemFeedback
      || this.battleLogOpen || this.confirmReturnToStorySelect || this.confirmExitFormalGame || this.confirmExitEndless) return;
    if (this.graduationTutorialStep >= 3) {
      if (state.phase === 'player-turn') this.graduationTutorialStep = 7;
      else if (state.phase === 'enemy-turn') this.graduationTutorialStep = 4 + Math.min(2, state.currentEnemyIndex);
    }
    const step = this.graduationTutorialStep;
    const areas: TutorialFocusArea[] = [];
    const addTarget = (id: string, interactive = false) => {
      const target = this.graduationTargets.get(id);
      if (target) areas.push({ ...target, interactive });
    };
    const playerSeat = this.battleLayout.seats.player;
    const playerHud = this.battleLayout.playerHud;
    if (step === 0) {
      areas.push({ x: playerSeat.x + playerHud.hand.x, y: playerSeat.y + playerHud.hand.y, width: 190, height: 110 });
      this.battle.enemies.forEach((_enemy, index) => {
        const seat = this.enemySeatForIndex(index);
        areas.push({ x: seat.x, y: seat.y, width: seat.width, height: seat.height });
      });
    } else if (step === 1) {
      this.battle.enemies.forEach((enemy) => addTarget(`passive:${enemy.id}`));
    } else if (step === 2) {
      addTarget('passive:player');
    } else if (step === 3) {
      addTarget('view-hand', true);
    } else if (step >= 4 && step <= 6) {
      const seat = this.enemySeatForIndex(state.currentEnemyIndex);
      areas.push({ x: seat.x, y: seat.y, width: seat.width, height: seat.height });
      addTarget('invite-one', true);
      if (step > 4) addTarget('compare', true);
    } else if (step === 7) {
      areas.push({ x: playerSeat.x, y: playerSeat.y + 88, width: 520, height: 140 });
    }
    const introductory = step < 3 || step === 7;
    this.ui.push(BattleTutorialOverlay.render(this, {
      areas,
      body: t(`tutorial.chapter1_9.guide${step}`, { enemy: state.currentEnemyId ? enemyName(state.currentEnemyId) : '' }),
      nextLabel: introductory ? t(step === 7 ? 'tutorial.chapter1_9.guideFinish' : 'tutorial.chapter1_9.guideNext') : undefined,
      skipLabel: t('tutorial.chapter1_9.guideSkip'),
      onNext: () => { this.graduationTutorialStep = step === 7 ? 8 : step + 1; this.render(); },
      onSkip: () => { this.graduationTutorialStep = 8; this.render(); },
    }));
  }

  private itemUseLimitReached(item: ItemDefinition): boolean {
    return battleItemUseLimitReached(this.battle.mode, item, this.battleItemUseCounts);
  }

  private playerStatusStates(): StatusIconState[] {
    const statuses: StatusIconState[] = [];
    const shieldCharges = this.playerDisplayShieldCharges();
    if (shieldCharges > 0) {
      statuses.push(createBattleStatusState('holy-shield', {
        title: t('item.holyShield.name'),
        description: t(this.battle.mode === 'endless' ? 'endless.items.shieldDescription' : 'item.holyShield.desc'),
        stacks: shieldCharges,
      }));
    }

    if (this.battle.player.incomingDamageBonus > 0) {
      statuses.push(createBattleStatusState('incoming-damage', {
        title: t('battle.status.incomingDamage'),
        description: t('battle.phase.playerRiskActive'),
        stacks: this.battle.player.incomingDamageBonus,
      }));
    }

    return statuses;
  }

  private statusStatesForPresentation(ownerId: string, current: StatusIconState[]): StatusIconState[] {
    const previous = this.statusSnapshots.get(ownerId);
    const presented = reconcileBattleStatusStates(previous, current);
    this.statusSnapshots.set(ownerId, new Map(
      current.map((status) => [status.id, { ...status, transition: 'none' }]),
    ));
    return presented;
  }

  private playerPassiveIcon(tooltipX?: number, tooltipY?: number): Phaser.GameObjects.Container {
    const active = !this.battle.player.soulRedeemUsed;
    const colors = this.currentUIColors();
    const seat = this.battleLayout.seats.player;
    const hud = this.battleLayout.playerHud;
    return new AbilitySlot(this, {
      icon: '✚',
      iconTextureKey: getBattleIconArt('soul-redeem').textureKey,
      variant: 'passive',
      color: 0xffd86b,
      textColor: COLORS.resonance,
      enabled: active,
      unavailable: !active,
      backgroundColor: colors.button,
      disabledBackgroundColor: colors.panel,
      hoverBackgroundColor: colors.buttonHover,
      onShowTooltip: () => this.showSkillTooltip(
        tooltipX ?? seat.x + hud.portrait.x - hud.orbitRadiusX - 110,
        tooltipY ?? seat.y + hud.portrait.y - hud.orbitRadiusY - 90,
        t('skill.soulRedeem.name'),
        t('skill.soulRedeem.tooltip'),
      ),
      onHideTooltip: () => this.hideSkillTooltip(),
    }).container;
  }

  private enemyPassiveIcon(
    enemy: EnemyState,
    index: number,
    layout: BattleLayoutConfig['enemyHud']['left'],
  ): Phaser.GameObjects.Container {
    const passive = this.enemyPassiveInfo(enemy);
    const active = this.enemyPassiveActive(enemy);
    const worldSeat = this.enemySeatForIndex(index);
    const left = layout.passivePosition.endsWith('left');
    const top = layout.passivePosition.startsWith('top');
    const slotX = layout.portrait.x + (left ? -layout.orbitRadiusX : layout.orbitRadiusX);
    const slotY = layout.portrait.y + (top ? -layout.orbitRadiusY : layout.orbitRadiusY);
    const colors = this.currentUIColors();
    const passiveSlotFill = this.enemyPassiveSlotFill(enemy.sourceThemeId);
    return new AbilitySlot(this, {
      icon: passive.icon,
      iconTextureKey: passive.iconArtId ? getBattleIconArt(passive.iconArtId).textureKey : undefined,
      variant: 'passive',
      radiateWhenEnabled: true,
      color: passive.color,
      textColor: passive.textColor,
      enabled: active,
      unavailable: this.enemyPassiveSpent(enemy),
      backgroundColor: colors.button,
      slotFillColor: passiveSlotFill.color,
      slotFillAlpha: passiveSlotFill.alpha,
      disabledBackgroundColor: colors.panel,
      hoverBackgroundColor: colors.buttonHover,
      onShowTooltip: () => this.showSkillTooltip(
        worldSeat.x + slotX + (left ? -118 : 118),
        worldSeat.y + slotY + (top ? -74 : 74),
        passive.name,
        passive.description,
      ),
      onHideTooltip: () => this.hideSkillTooltip(),
    }).container;
  }

  private enemyPassiveSlotFill(themeId: TableThemeId): { color: number; alpha: number } {
    switch (themeId) {
      case 'northern_longhouse':
        return { color: 0x24495d, alpha: 0.82 };
      case 'dragon_gate':
        return { color: 0x4a2922, alpha: 0.82 };
      case 'edo_teahouse':
        return { color: 0x0d0c10, alpha: 0.9 };
      case 'evernight_tavern':
      default:
        return { color: 0x704638, alpha: 0.46 };
    }
  }

  private enemyPassiveSpent(enemy: EnemyState): boolean {
    if (enemy.defeated) {
      return true;
    }

    if (enemy.id === 'keeper') {
      return enemy.soulRedeemUsed;
    }

    if (enemy.id === 'viking_warrior') {
      return enemy.passiveTriggered;
    }

    if (enemy.id === 'valkyrie') {
      return enemy.summonCount >= 2;
    }

    if (enemy.id === 'ninja') {
      return enemy.smokeScreenUsed;
    }

    return enemy.passiveTriggeredThisRound;
  }

  private enemyHasPassiveInfo(enemy: EnemyState): boolean {
    return enemy.id === 'goblin'
      || enemy.id === 'gambler'
      || enemy.id === 'werewolf'
      || enemy.id === 'keeper'
      || enemy.id === 'viking_warrior'
      || enemy.id === 'rune_shaman'
      || enemy.id === 'valkyrie'
      || enemy.id === 'swordsman'
      || enemy.id === 'songstress'
      || enemy.id === 'taoist'
      || enemy.id === 'shogun_samurai'
      || enemy.id === 'ninja'
      || enemy.id === 'oiran';
  }

  private enemyPassiveInfo(enemy: EnemyState): { name: string; icon: string; iconArtId?: BattleIconId; description: string; color: number; textColor: string } {
    if (enemy.id === 'goblin') {
      return {
        name: t('skill.goblinInstinct.name'),
        icon: '!',
        iconArtId: 'goblin-instinct',
        description: t('skill.goblinInstinct.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
        color: 0x65d46e,
        textColor: '#78d18a',
      };
    }

    if (enemy.id === 'gambler') {
      return {
        name: t('skill.gamblerBlessing.name'),
        icon: '♢',
        iconArtId: 'gambler-blessing',
        description: t('skill.gamblerBlessing.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
        color: 0xf25f9a,
        textColor: '#f25f9a',
      };
    }

    if (enemy.id === 'keeper') {
      return {
        name: t('skill.soulRedeem.name'),
        icon: '✦',
        description: t('skill.keeperSoulRedeem.tooltip'),
        color: 0xe8cf73,
        textColor: '#ffd86b',
      };
    }

    if (enemy.id === 'viking_warrior') {
      return {
        name: t('skill.warHorn.name'),
        icon: 'H',
        iconArtId: 'war-horn',
        description: t('skill.warHorn.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
        color: 0xff8a3d,
        textColor: '#ffad6b',
      };
    }

    if (enemy.id === 'rune_shaman') {
      return {
        name: t('skill.runeBlessing.name'),
        icon: 'R',
        iconArtId: 'rune-blessing',
        description: t('skill.runeBlessing.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
        color: 0x79c9ff,
        textColor: '#9ed8ff',
      };
    }

    if (enemy.id === 'valkyrie') {
      return {
        name: t('skill.einherjarSummon.name'),
        icon: 'V',
        iconArtId: 'einherjar-summon',
        description: t('skill.einherjarSummon.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
        color: 0xf7d889,
        textColor: '#ffe39a',
      };
    }

    if (enemy.id === 'swordsman') {
      return {
        name: t('skill.chivalry.name'),
        icon: '侠',
        iconArtId: 'chivalry',
        description: t('skill.chivalry.tooltip'),
        color: 0xf05f42,
        textColor: '#ff9a72',
      };
    }

    if (enemy.id === 'songstress') {
      return {
        name: t('skill.redSilkToast.name'),
        icon: '绸',
        iconArtId: 'red-silk-toast',
        description: t('skill.redSilkToast.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
        color: 0xf29bc2,
        textColor: '#ffb8d6',
      };
    }

    if (enemy.id === 'taoist') {
      return {
        name: t('skill.heavenlyInsight.name'),
        icon: '道',
        iconArtId: 'heavenly-insight',
        description: t('skill.heavenlyInsight.tooltip'),
        color: 0x72d8b3,
        textColor: '#92f0cc',
      };
    }

    if (enemy.id === 'shogun_samurai') {
      return {
        name: t('skill.iaijutsuCharge.name'),
        icon: '刀',
        iconArtId: 'iaijutsu-charge',
        description: t('skill.iaijutsuCharge.tooltip'),
        color: 0xe15f58,
        textColor: '#ffd19d',
      };
    }

    if (enemy.id === 'ninja') {
      return {
        name: t('skill.smokeSubstitution.name'),
        icon: '影',
        iconArtId: 'smoke-substitution',
        description: t('skill.smokeSubstitution.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
        color: 0x8e78bb,
        textColor: '#d8cbff',
      };
    }

    if (enemy.id === 'oiran') {
      return {
        name: t('skill.hanamiDance.name'),
        icon: '扇',
        iconArtId: 'hanami-dance',
        description: t('skill.hanamiDance.tooltip'),
        color: 0xf09ab5,
        textColor: '#ffd2e3',
      };
    }

    return {
      name: t('skill.werewolfLifesteal.name'),
      icon: 'V',
      iconArtId: 'werewolf-lifesteal',
      description: t('skill.werewolfLifesteal.tooltip', { threshold: this.battle.enemyPassiveHpThreshold(enemy.id) }),
      color: 0x73c7ff,
      textColor: '#73c7ff',
    };
  }

  private enemyPassiveActive(enemy: EnemyState): boolean {
    if (enemy.id === 'goblin') {
      return enemy.hp < this.battle.enemyPassiveHpThreshold(enemy.id) && !enemy.defeated;
    }

    if (enemy.id === 'gambler') {
      return enemy.hp < this.battle.enemyPassiveHpThreshold(enemy.id) && !enemy.defeated;
    }

    if (enemy.id === 'keeper') {
      return !enemy.soulRedeemUsed && !enemy.defeated;
    }

    if (enemy.id === 'viking_warrior') {
      return enemy.hp < this.battle.enemyPassiveHpThreshold(enemy.id) && !enemy.passiveTriggered && !enemy.defeated;
    }

    if (enemy.id === 'rune_shaman') {
      return enemy.hp < this.battle.enemyPassiveHpThreshold(enemy.id) && !enemy.defeated;
    }

    if (enemy.id === 'valkyrie') {
      return enemy.hp < this.battle.enemyPassiveHpThreshold(enemy.id) && enemy.summonCount < 2 && !enemy.defeated;
    }

    if (enemy.id === 'swordsman') {
      return this.battle.enemies.some((item) => item !== enemy && !item.defeated && item.hp <= 2)
        && !enemy.passiveTriggeredThisRound
        && !enemy.defeated;
    }

    if (enemy.id === 'songstress') {
      return this.battle.enemies.some((item) => (
        item !== enemy
        && !item.defeated
        && item.hp < this.battle.enemyPassiveHpThreshold(enemy.id)
      ))
        && !enemy.passiveTriggeredThisRound
        && !enemy.defeated;
    }

    if (enemy.id === 'taoist') {
      return !enemy.passiveTriggeredThisRound && !enemy.defeated;
    }

    if (enemy.id === 'shogun_samurai') {
      return !enemy.defeated;
    }

    if (enemy.id === 'ninja') {
      return !enemy.smokeScreenUsed && !enemy.defeated;
    }

    if (enemy.id === 'oiran') {
      return this.battle.enemies.some((candidate) => candidate !== enemy && !candidate.defeated);
    }

    return enemy.hp < this.battle.enemyPassiveHpThreshold(enemy.id) && !enemy.defeated;
  }

  private showSkillTooltip(x: number, y: number, title: string, body: string, force = false): void {
    this.hideSkillTooltip();
    if (this.cleanMode && !force) {
      return;
    }

    const colors = this.currentUIColors();
    MedievalTooltip.render(this, {
      x,
      y,
      title,
      body,
      skin: getBattleThemeArt(this.battleArtSelection.themeId).tooltipPanel,
      fallbackFill: colors.panel,
      fallbackLine: colors.accent,
    });
  }

  private hideSkillTooltip(): void {
    this.children.getByName('skill-tooltip')?.destroy();
  }

  private renderScoreBadge(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    score: ScoreResult,
    compact = false,
    showResonance = false,
  ): void {
    container.add(createScoreBadge(this, {
      x,
      y,
      point: score.point,
      label: t('common.pointUnit'),
      variant: compact ? 'compact' : 'orb',
      scale: compact ? 1.24 : 1.1,
      resonance: showResonance ? score.resonance : 'none',
    }));
  }

  private resonanceText(score: ScoreResult): string {
    if (score.resonance === 'boom') {
      return t('score.boomWithRank', { rank: score.boomRank ?? '' });
    }

    if (score.resonance === 'strong') {
      return t('score.strongResonance', { multiplier: score.multiplier });
    }

    if (score.resonance === 'resonance') {
      return t('score.resonance', { multiplier: score.multiplier });
    }

    return t('score.noResonance');
  }

  private renderEnemyCardRow(
    container: Phaser.GameObjects.Container,
    enemy: EnemyState,
    enemyIndex: number,
    x: number,
    y: number,
  ): HandView<{ card: Card; faceUp: boolean }> | undefined {
    if (this.enemyDisplayDefeated(enemyIndex) && enemy.hand.length === 0) {
      container.add(this.add.text(x, y, t('battle.notParticipating'), {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '14px',
        color: this.currentUIColors().muted,
      }).setOrigin(0.5));
      return undefined;
    }

    const visibleCards = this.dealing || this.actionDealing
      ? enemy.hand.slice(0, Math.min(this.dealtEnemyCards[enemyIndex] ?? 0, enemy.hand.length))
      : enemy.hand;
    const pendingReveal = this.revealFocusPlaying && this.revealFocusPendingEnemyIds.has(enemy.id);
    const showAll = !pendingReveal
      && (enemy.revealed || (this.battle.roundRevealed && this.battle.results.some((result) => result.enemy === enemy)));
    const cards = visibleCards.map((card, index) => ({
      card,
      faceUp: showAll || index === 0,
    }));

    const width = this.battleLayout.cards.enemyWidth;
    const enemyScore = this.scoreEnemy(enemy);
    const resonant = this.enemyHasResonance(enemy);
    const boom = resonant && enemyScore.resonance === 'boom';
    const muted = this.enemyDisplayDefeated(enemyIndex);
    const hand = new HandView(this, {
      x,
      y,
      items: cards,
      slotCount: enemy.hand.length,
      itemWidth: width,
      spacing: this.battleLayout.cards.enemySpacing,
      fan: true,
      createItem: ({ card, faceUp }, _index, cardX, cardY, angle) => createCardView(this, {
        x: cardX,
        y: cardY,
        card: faceUp ? card : undefined,
        hidden: !faceUp,
        width,
        resonant,
        boom,
        muted,
        ambientGlow: true,
      }).setAngle(angle),
    });
    container.add(hand.container);
    if (resonant && showAll && !muted) {
      this.playResonanceHandShakeOnce(
        `enemy:${enemy.id}:${this.battle.round}:${enemy.hand.map(formatCard).join('|')}`,
        hand.container,
        enemyScore.resonance === 'strong' || boom,
      );
    }
    return hand;
  }

  private showEnemySpeech(enemyId: string, text: string): void {
    const enemyIndex = this.battle.enemies.findIndex((enemy) => enemy.id === enemyId);
    if (enemyIndex < 0) {
      return;
    }

    this.enemySpeechBubble?.destroy();
    const seat = this.enemySeatForIndex(enemyIndex);
    const hud = this.enemyHudLayout(enemyIndex);
    const portraitX = seat.x + hud.portrait.x;
    const portraitY = seat.y + hud.portrait.y;
    const placement: { tipX: number; tipY: number; direction: EnemySpeechDirection } = enemyIndex === 0
      ? { tipX: portraitX + 52, tipY: portraitY - 38, direction: 'right-up' }
      : (enemyIndex === 2
        ? { tipX: portraitX - 52, tipY: portraitY - 38, direction: 'left-up' }
        : { tipX: portraitX - 54, tipY: portraitY - 8, direction: 'left' });

    let bubble: EnemySpeechBubble;
    bubble = new EnemySpeechBubble(this, {
      ...placement,
      text,
      onComplete: () => {
        if (this.enemySpeechBubble === bubble) {
          this.enemySpeechBubble = undefined;
        }
      },
    });
    this.enemySpeechBubble = bubble;
  }

  private renderPlayerCardRow(container: Phaser.GameObjects.Container, x: number, y: number): HandView<{ card: Card; faceUp: boolean }> {
    const visibleCards = this.dealing || this.playerRedealing || this.actionDealing
      ? this.battle.player.hand.slice(0, this.dealtPlayerCards)
      : this.battle.player.hand;
    const faceUp = !this.itemEffectPlayerHandHidden
      && (
        this.itemEffectPlayerHandRevealed
        || this.playerRedealing
        || (!this.dealing && this.battle.phase !== 'choice' && (!this.battle.player.fateMode || this.battle.roundRevealed))
      );
    const cards = visibleCards.map((card) => ({ card, faceUp }));
    const width = this.battleLayout.cards.width;
    const resonant = !this.itemEffectPlayerHandHidden && !this.playerRedealing && this.playerHasResonance();
    const boom = resonant && this.battle.playerScore().resonance === 'boom';
    const hand = new HandView(this, {
      x,
      y,
      items: cards,
      slotCount: this.battle.player.hand.length,
      itemWidth: width,
      spacing: this.battleLayout.cards.spacing,
      fan: true,
      createItem: ({ card, faceUp }, _index, cardX, cardY, angle) => createCardView(this, {
        x: cardX,
        y: cardY,
        card: faceUp ? card : undefined,
        hidden: !faceUp,
        width,
        resonant,
        boom,
        ambientGlow: true,
      }).setAngle(angle),
    });
    container.add(hand.container);
    if (resonant && faceUp) {
      this.playResonanceHandShakeOnce(
        `player:${this.battle.round}:${this.battle.player.hand.map(formatCard).join('|')}`,
        hand.container,
        this.battle.playerScore().resonance === 'strong' || boom,
      );
    }
    return hand;
  }

  private playResonanceHandShakeOnce(
    key: string,
    hand: Phaser.GameObjects.Container,
    strong: boolean,
  ): void {
    if (this.resonanceShakeKeys.has(key) || !hand.active) {
      return;
    }

    this.resonanceShakeKeys.add(key);
    this.playResonanceHandShake(hand, strong);
  }

  private playResonanceHandShake(hand: Phaser.GameObjects.Container, strong: boolean): void {
    const originX = hand.x;
    const distance = strong ? 5 : 3;
    const angle = strong ? 2.4 : 1.6;
    hand.setX(originX - distance);
    hand.setAngle(-angle);
    this.tweens.add({
      targets: hand,
      x: originX + distance,
      angle,
      duration: strong ? 46 : 52,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!hand.active) {
          return;
        }
        hand.setPosition(originX, hand.y);
        hand.setAngle(0);
      },
    });
  }

  private renderCardRow(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    cards: Array<{ card: Card; faceUp: boolean }>,
    options: { width: number; height: number; spacing: number; resonant: boolean; muted?: boolean },
  ): void {
    cards.forEach(({ card, faceUp }, index) => {
      const cardX = x + index * options.spacing;
      container.add(createCardView(this, {
        x: cardX + options.width / 2,
        y,
        card: faceUp ? card : undefined,
        hidden: !faceUp,
        width: options.width,
        resonant: options.resonant,
        muted: options.muted,
      }));
    });
  }

  private cardsText(x: number, y: number, label: string, resonant: boolean, muted = false, fontSize = '24px'): Phaser.GameObjects.Text {
    const colors = this.currentUIColors();
    const text = this.add.text(x, y, label, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize,
      color: muted ? colors.muted : colors.text,
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
    const colors = this.currentUIColors();
    const text = this.add.text(x, y, this.resonanceText(score), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize,
      color: resonant ? COLORS.resonance : colors.muted,
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

  private hpSnapshot(): { player: number; enemies: number[] } {
    return {
      player: this.battle.player.hp,
      enemies: this.battle.enemies.map((enemy) => enemy.hp),
    };
  }

  private playerDisplayHp(): number {
    return this.visualHpOverride?.player ?? this.battle.player.hp;
  }

  private playerDisplayShieldCharges(): number {
    return this.visualPlayerShieldChargesOverride ?? this.battle.player.shieldCharges;
  }

  private enemyDisplayHp(index: number): number {
    return this.visualHpOverride?.enemies[index] ?? this.battle.enemies[index].hp;
  }

  private enemyDisplayDefeated(index: number): boolean {
    return this.visualEnemyDefeated?.[index] ?? this.battle.enemies[index].defeated;
  }

  private playHealSoundIfHpIncreased(before: { player: number; enemies: number[] }): void {
    const playerHealed = this.battle.player.hp > before.player;
    const enemyHealed = this.battle.enemies.some((enemy, index) => enemy.hp > (before.enemies[index] ?? enemy.hp));
    if (!playerHealed && !enemyHealed) {
      return;
    }

    this.sound.play('healSound', { volume: 0.5 });
  }

  private playImmediatePresentationEvents(events: BattlePresentationEvent[]): void {
    if (this.hasImmediateHealFeedback(events)) {
      this.sound.play('healSound', { volume: 0.5 });
    }

    events.forEach((event) => {
      if (event.type === 'enemy-speech') {
        const previousKey = this.lastEnemySpeechKeys.get(event.enemyId);
        const speechKey = chooseEnemySpeechKey(event.enemyId, event.intent, previousKey);
        this.lastEnemySpeechKeys.set(event.enemyId, speechKey);
        this.showEnemySpeech(event.enemyId, t(speechKey));
      }
    });
  }

  private hasImmediateHealFeedback(events: BattlePresentationEvent[]): boolean {
    const delayedHealByTarget = new Map<string, number>();
    this.passiveEffectEvents(events)
      .filter((event) => event.passiveId === 'werewolf_lifesteal')
      .forEach((event) => {
        const amount = event.amount ?? 0;
        event.targetEnemyIds.forEach((enemyId) => {
          delayedHealByTarget.set(enemyId, (delayedHealByTarget.get(enemyId) ?? 0) + amount);
        });
      });

    return events.some((event) => (
      event.type === 'heal'
      && event.amount > (delayedHealByTarget.get(event.target) ?? 0)
    ));
  }

  private passiveEffectEvents(events: BattlePresentationEvent[]): Extract<BattlePresentationEvent, { type: 'passive-effect' }>[] {
    return events.filter((event): event is Extract<BattlePresentationEvent, { type: 'passive-effect' }> => event.type === 'passive-effect');
  }

  private cardsRedealtEvents(events: BattlePresentationEvent[]): Extract<BattlePresentationEvent, { type: 'cards-redealt' }>[] {
    return events.filter((event): event is Extract<BattlePresentationEvent, { type: 'cards-redealt' }> => event.type === 'cards-redealt');
  }

  private cardReplacementEvents(events: BattlePresentationEvent[]): Extract<BattlePresentationEvent, { type: 'card-replaced' }>[] {
    return events.filter((event): event is Extract<BattlePresentationEvent, { type: 'card-replaced' }> => event.type === 'card-replaced');
  }

  private preCombatPresentationEvents(events: BattlePresentationEvent[]): BattlePresentationEvent[] {
    return events.filter((event) => (
      (event.type === 'passive-effect' && event.passiveId === 'gambler_blessing')
      || (event.type === 'passive-effect' && event.passiveId === 'heavenly_insight')
      || (event.type === 'passive-effect' && event.passiveId === 'iaijutsu_charge' && event.effect === 'release')
      || event.type === 'cards-redealt'
      || event.type === 'card-replaced'
    ));
  }

  private postCombatPresentationEvents(events: BattlePresentationEvent[]): BattlePresentationEvent[] {
    return events.filter((event) => !(
      (event.type === 'passive-effect' && event.passiveId === 'gambler_blessing')
      || (event.type === 'passive-effect' && event.passiveId === 'heavenly_insight')
      || (event.type === 'passive-effect' && event.passiveId === 'iaijutsu_charge' && event.effect === 'release')
      || (event.type === 'passive-effect' && event.timing === 'round-start')
      || event.type === 'cards-redealt'
      || event.type === 'card-replaced'
    ));
  }

  private runAction(
    action: () => void,
    presentation: { restorePortraitsAfterCombat?: boolean } = {},
  ): void {
    const riskBefore = this.battle.player.incomingDamageBonus;
    const roundBefore = this.battle.round;
    const hpBefore = this.hpSnapshot();
    const phaseBefore = this.battle.phase;
    const currentEnemyIdBefore = phaseBefore === 'enemy-turn' ? this.battle.currentEnemy?.id : undefined;
    const revealedEnemyIdsBefore = new Set(
      this.battle.enemies.filter((enemy) => enemy.revealed).map((enemy) => enemy.id),
    );
    if (this.endlessSaveError) return;
    action();
    if (this.endlessSaveError) { this.render(); return; }
    this.queuePlayerResonanceFeedbackIfChanged();
    const events = this.battle.consumePresentationEvents();
    this.presentationSequencePlaying = true;
    this.playImmediatePresentationEvents(events);
    const shouldDelayResultModal = this.shouldDelayOutcomeForPresentation(events);
    const shouldDealNewRound = this.battle.round > roundBefore && this.battle.phase === 'choice' && !this.battle.battleOutcome;
    this.resultModalReady = !shouldDelayResultModal;
    const directlyComparedEnemyId = phaseBefore === 'enemy-turn' ? currentEnemyIdBefore : undefined;
    const revealEnemyIds = new Set(
      this.hasRoundRevealEvent(events)
        ? this.battle.enemies
          .filter((enemy) => (
            enemy.hand.length > 0
            && this.battle.results.some((result) => result.enemy === enemy)
            && !revealedEnemyIdsBefore.has(enemy.id)
            && enemy.id !== directlyComparedEnemyId
          ))
          .map((enemy) => enemy.id)
        : [],
    );
    const skipRevealBanner = this.hasRoundRevealEvent(events) && revealEnemyIds.size === 0;

    this.playActionDealEvents(events, () => {
      const continueAfterActionDeals = () => {
        const riskGain = this.battle.player.incomingDamageBonus - riskBefore;
        if (riskGain > 0) {
          this.playStatusGainText(this.playerSeatCenter(), 'risk', riskGain);
        }
        if (!this.hasCombatEvents(events)) {
          this.render();
        }

        this.playPostActionAnimations(events, hpBefore, revealEnemyIds, skipRevealBanner, () => {
          this.playPassiveEffectEvents(this.postCombatPresentationEvents(events), () => {
            if (this.hasPendingSoulRedeem()) {
              this.presentationSequencePlaying = false;
              this.playPendingSoulRedeemBannerThen();
              return;
            }

            const continueAfterRevealDialogue = () => {
              if (!shouldDelayResultModal) {
                this.presentationSequencePlaying = false;
                if (shouldDealNewRound) {
                  this.startDealPresentation();
                } else if (this.showPlayerTurnLessonIfNeeded()) {
                  return;
                } else {
                  this.render();
                }
                return;
              }

              const showResult = () => {
                this.resultModalReady = true;
                this.presentationSequencePlaying = false;
                if (shouldDealNewRound) {
                  this.startDealPresentation();
                } else if (this.showPlayerTurnLessonIfNeeded()) {
                  return;
                } else {
                  this.render();
                }
              };

              if (this.showResultStoryIfNeeded(showResult)) {
                return;
              }

              showResult();
            };

            const continueAfterDamageFeedback = () => {
              if (this.hasRoundRevealEvent(events) && this.showRevealDialogueIfNeeded(continueAfterRevealDialogue)) {
                return;
              }

              continueAfterRevealDialogue();
            };

            if (this.showChapter3DamageFeedbackIfNeeded(events, continueAfterDamageFeedback)) {
              return;
            }

            if (this.showChapter4ResonanceFeedbackIfNeeded(events, continueAfterDamageFeedback)) {
              return;
            }

            continueAfterDamageFeedback();
          });
        }, presentation.restorePortraitsAfterCombat === true);
      };

      continueAfterActionDeals();
    });
  }

  private playPostActionAnimations(
    events: BattlePresentationEvent[],
    hpBefore: { player: number; enemies: number[] },
    revealEnemyIds: Set<string>,
    skipRevealBanner = false,
    onComplete?: () => void,
    restorePortraitsAfterCombat = false,
    includePlayerInReveal = true,
  ): void {
    const combatEvents = this.combatEvents(events);
    if (combatEvents.length === 0) {
      this.playPreCombatPresentationEvents(events, () => onComplete?.());
      return;
    }

    // Logic resolves synchronously, so preserve the pre-combat state throughout
    // reveal and passive presentation. Each impact advances this visual snapshot.
    this.visualHpOverride = {
      player: hpBefore.player,
      enemies: [...hpBefore.enemies],
    };
    this.visualEnemyDefeated = hpBefore.enemies.map((hp) => hp <= 0);
    const shieldBlocks = combatEvents.filter((event) => event.type === 'damage' && event.shielded).length;
    this.visualPlayerShieldChargesOverride = shieldBlocks > 0
      ? this.battle.player.shieldCharges + shieldBlocks
      : undefined;

    const playWithDelayedHp = () => {
      this.actionAnimationPlaying = true;
      this.render();
      this.playDamageAnimations(combatEvents, () => {
        this.visualHpOverride = undefined;
        this.visualEnemyDefeated = undefined;
        this.visualPlayerShieldChargesOverride = undefined;
        this.actionAnimationPlaying = false;
        if (restorePortraitsAfterCombat) {
          this.restorePortraitsAfterDirectCompare();
        }
        onComplete?.();
      });
    };
    const playPreCombatThenReveal = () => {
      this.playPreCombatPresentationEvents(events, () => {
        if (this.hasRoundRevealEvent(events) && revealEnemyIds.size > 0) {
          this.playRevealFocus(revealEnemyIds, playWithDelayedHp, includePlayerInReveal);
          return;
        }

        playWithDelayedHp();
      });
    };

    if (combatEvents.length > 0 && this.hasRoundRevealEvent(events) && !skipRevealBanner) {
      this.playRevealBannerThen(playPreCombatThenReveal);
      return;
    }

    playPreCombatThenReveal();
  }

  private restorePortraitsAfterDirectCompare(): void {
    this.setPlayerPortraitPose(this.battle.player.hp <= 0 ? 'hurt' : 'idle');
    this.battle.enemies.forEach((_, enemyIndex) => {
      this.setEnemyPortraitPose(enemyIndex, 'idle');
    });
  }

  private playRevealFocus(
    revealEnemyIds: Set<string>,
    onComplete: () => void,
    includePlayer = true,
  ): void {
    this.actionAnimationPlaying = true;
    this.revealFocusPlaying = true;
    this.revealFocusPendingEnemyIds = new Set(revealEnemyIds);
    this.render();

    const shade = this.add.rectangle(
      this.battleLayout.canvas.width / 2,
      this.battleLayout.canvas.height / 2,
      this.battleLayout.canvas.width,
      this.battleLayout.canvas.height,
      0x020305,
      1,
    ).setDepth(29).setInteractive().setAlpha(0);
    const groups = this.createRevealFocusGroups(revealEnemyIds, includePlayer);

    this.tweens.add({
      targets: shade,
      alpha: REVEAL_SHADE_ALPHA,
      duration: 180,
      ease: 'Sine.easeOut',
      onComplete: () => this.playRevealFocusGroup(groups, 0, shade, onComplete),
    });
  }

  private createRevealFocusGroups(revealEnemyIds: Set<string>, includePlayer = true): Array<{
    container: Phaser.GameObjects.Container;
    cards: Phaser.GameObjects.Container[];
    score: Phaser.GameObjects.Container;
    resonant: boolean;
    flipCards: boolean;
    shakeKey: string;
    strong: boolean;
  }> {
    const groups: Array<{
      container: Phaser.GameObjects.Container;
      cards: Phaser.GameObjects.Container[];
      score: Phaser.GameObjects.Container;
      resonant: boolean;
      flipCards: boolean;
      shakeKey: string;
      strong: boolean;
    }> = [];

    this.battle.enemies.forEach((enemy, index) => {
      if (
        !revealEnemyIds.has(enemy.id)
        || enemy.hand.length === 0
        || !this.battle.results.some((result) => result.enemy === enemy)
      ) {
        return;
      }

      const seat = this.enemySeatForIndex(index);
      const hud = this.enemyHudLayout(index);
      groups.push(this.createRevealFocusGroup(
        seat.x + this.enemyHandCenterX(index, enemy.hand.length),
        seat.y + hud.hand.y,
        enemy.hand,
        this.scoreEnemy(enemy),
        this.battleLayout.cards.enemyWidth,
        this.battleLayout.cards.enemySpacing,
        hud.scoreSide,
        hud.scoreGap,
        true,
        `enemy:${enemy.id}:${this.battle.round}:${enemy.hand.map(formatCard).join('|')}`,
      ));
    });

    if (includePlayer) {
      groups.push(this.createRevealFocusGroup(
        this.battleLayout.seats.player.x + this.playerHandCenterX(this.battle.player.hand.length),
        this.battleLayout.seats.player.y + this.battleLayout.playerHud.hand.y,
        this.battle.player.hand,
        this.battle.playerScore(),
        this.battleLayout.cards.width,
        this.battleLayout.cards.spacing,
        'right',
        this.battleLayout.playerHud.scoreGap,
        false,
        `player:${this.battle.round}:${this.battle.player.hand.map(formatCard).join('|')}`,
      ));
    }
    return groups;
  }

  private createRevealFocusGroup(
    x: number,
    y: number,
    cards: Card[],
    scoreResult: ScoreResult,
    cardWidth: number,
    spacing: number,
    scoreSide: 'left' | 'right',
    scoreGap: number,
    flipCards: boolean,
    shakeKey: string,
  ): {
    container: Phaser.GameObjects.Container;
    cards: Phaser.GameObjects.Container[];
    score: Phaser.GameObjects.Container;
    resonant: boolean;
    flipCards: boolean;
    shakeKey: string;
    strong: boolean;
  } {
    const container = this.add.container(x, y).setDepth(31).setAlpha(0);
    const resonant = this.hasMechanic('resonance') && scoreResult.resonance !== 'none';
    const cardViews = cards.map((card, index) => {
      const pose = resolveHandItemPose(index, cards.length, cardWidth, spacing, true);
      const cardView = createCardView(this, {
        x: pose.x,
        y: pose.y,
        card,
        width: cardWidth,
        resonant,
        boom: scoreResult.resonance === 'boom',
      }).setAngle(pose.angle).setScale(flipCards ? 0.08 : 1, 1);
      container.add(cardView);
      return cardView;
    });
    const handWidth = cardWidth + Math.max(0, cards.length - 1) * spacing;
    const direction = scoreSide === 'right' ? 1 : -1;
    const score = createScoreBadge(this, {
      x: direction * (handWidth / 2 + scoreGap),
      y: 0,
      point: scoreResult.point,
      label: t('common.pointUnit'),
      variant: 'compact',
      scale: 1.24,
      resonance: resonant ? scoreResult.resonance : 'none',
    }).setAlpha(0);
    container.add(score);
    return {
      container,
      cards: cardViews,
      score,
      resonant,
      flipCards,
      shakeKey,
      strong: scoreResult.resonance === 'strong' || scoreResult.resonance === 'boom',
    };
  }

  private playRevealFocusGroup(
    groups: Array<{
      container: Phaser.GameObjects.Container;
      cards: Phaser.GameObjects.Container[];
      score: Phaser.GameObjects.Container;
      resonant: boolean;
      flipCards: boolean;
      shakeKey: string;
      strong: boolean;
    }>,
    index: number,
    shade: Phaser.GameObjects.Rectangle,
    onComplete: () => void,
  ): void {
    if (index >= groups.length) {
      this.time.delayedCall(560, () => {
        const containers = groups.map((group) => group.container);
        this.tweens.add({
          targets: shade,
          alpha: 0,
          duration: 460,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            shade.destroy();
            this.revealFocusPendingEnemyIds.clear();
            this.revealFocusPlaying = false;
            this.actionAnimationPlaying = false;
            onComplete();
            containers.forEach((container) => {
              if (container.active) {
                container.destroy(true);
              }
            });
          },
        });
      });
      return;
    }

    const group = groups[index];
    if (group.flipCards) {
      this.sound.play('cardPlace', { volume: 0.42 });
    }
    this.tweens.add({
      targets: group.container,
      alpha: 1,
      duration: group.flipCards ? 100 : 180,
      ease: 'Sine.easeOut',
    });
    const revealScore = () => {
      if (group.resonant) {
        this.sound.play('resonanceEcho', { volume: 0.44 });
        this.playResonanceHandShakeOnce(group.shakeKey, group.container, group.strong);
      }
      this.tweens.add({
        targets: group.score,
        alpha: 1,
        scale: { from: 0.82, to: 1 },
        duration: 180,
        ease: 'Back.easeOut',
      });
      this.time.delayedCall(220, () => this.playRevealFocusGroup(groups, index + 1, shade, onComplete));
    };

    if (!group.flipCards) {
      this.time.delayedCall(120, revealScore);
      return;
    }

    this.tweens.add({
      targets: group.cards,
      scaleX: 1,
      duration: 260,
      ease: 'Back.easeOut',
      onComplete: revealScore,
    });
  }

  private playPreCombatPresentationEvents(events: BattlePresentationEvent[], onComplete: () => void): void {
    const preEvents = this.preCombatPresentationEvents(events);
    if (preEvents.length === 0) {
      onComplete();
      return;
    }

    const redealEvents = this.cardsRedealtEvents(preEvents);
    if (redealEvents.length > 0) {
      this.actionDealing = true;
      this.dealtEnemyCards = this.battle.enemies.map((enemy) => enemy.hand.length);
      redealEvents.forEach((event) => {
        this.dealtEnemyCards[event.targetEnemyIndex] = 0;
      });
    }

    this.playPassiveEffectEvents(preEvents, () => {
      this.playCardsRedealtEvents(preEvents, () => this.playCardReplacementEvents(preEvents, onComplete));
    });
  }

  private playCardsRedealtEvents(events: BattlePresentationEvent[], onComplete: () => void): void {
    const redealEvents = this.cardsRedealtEvents(events);
    if (redealEvents.length === 0) {
      onComplete();
      return;
    }

    const playStep = (index: number) => {
      if (index >= redealEvents.length) {
        onComplete();
        return;
      }

      this.playEnemyRedeal(redealEvents[index], () => {
        this.time.delayedCall(120, () => playStep(index + 1));
      });
    };

    playStep(0);
  }

  private playEnemyRedeal(event: Extract<BattlePresentationEvent, { type: 'cards-redealt' }>, onComplete: () => void): void {
    const enemyIndex = event.targetEnemyIndex;
    if (enemyIndex < 0 || enemyIndex >= this.battle.enemies.length
      || event.targetEnemyInstanceId && this.battle.enemies[enemyIndex]?.instanceId !== event.targetEnemyInstanceId) {
      onComplete();
      return;
    }

    this.actionDealing = true;
    this.dealtEnemyCards = this.battle.enemies.map((enemy) => enemy.hand.length);
    this.dealtEnemyCards[enemyIndex] = 0;
    this.render();

    const count = Math.min(event.count, this.battle.enemies[enemyIndex].hand.length);
    const playCard = (cardIndex: number) => {
      if (cardIndex >= count || !this.actionDealing) {
        this.actionDealing = false;
        this.dealtEnemyCards = this.battle.enemies.map((enemy) => enemy.hand.length);
        this.render();
        onComplete();
        return;
      }

      this.playDealCard(
        this.dealTargetForEnemy(enemyIndex, cardIndex),
        this.dealAngleForEnemy(enemyIndex, cardIndex),
        'place',
        () => {
          this.dealtEnemyCards[enemyIndex] = Math.max(this.dealtEnemyCards[enemyIndex], cardIndex + 1);
          this.render();
          this.time.delayedCall(90, () => playCard(cardIndex + 1));
        },
      );
    };

    playCard(0);
  }

  private playCardReplacementEvents(events: BattlePresentationEvent[], onComplete: () => void): void {
    const replacements = this.cardReplacementEvents(events);
    if (replacements.length === 0) {
      onComplete();
      return;
    }

    const playStep = (index: number) => {
      if (index >= replacements.length) {
        onComplete();
        return;
      }

      this.playEnemyCardReplacement(replacements[index], () => {
        this.time.delayedCall(120, () => playStep(index + 1));
      });
    };

    playStep(0);
  }

  private playEnemyCardReplacement(event: Extract<BattlePresentationEvent, { type: 'card-replaced' }>, onComplete: () => void): void {
    const enemy = this.battle.enemies[event.targetEnemyIndex];
    if (!enemy || enemy.id !== event.target
      || event.targetEnemyInstanceId && enemy.instanceId !== event.targetEnemyInstanceId || event.cardIndex < 0 || event.cardIndex >= enemy.hand.length) {
      onComplete();
      return;
    }

    this.actionDealing = true;
    this.render();
    const position = this.enemyCardCenter(event.targetEnemyIndex, event.cardIndex);
    const oldCard = createCardView(this, {
      x: position.x,
      y: position.y,
      card: event.previousCard,
      width: this.battleLayout.cards.enemyWidth,
    }).setDepth(32);
    const talisman = this.add.image(
      position.x,
      position.y,
      getBattleIconArt('heavenly-insight').textureKey,
    ).setDisplaySize(52, 52).setDepth(34);
    this.sound.play('attackWind', { volume: 0.36 });
    playTalismanBurnVfx(this, position);
    this.tweens.add({
      targets: [oldCard, talisman],
      alpha: 0,
      scaleX: 1.28,
      scaleY: 0.48,
      duration: 560,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        oldCard.destroy(true);
        talisman.destroy();
        this.playDealCard(position, this.dealAngleForEnemy(event.targetEnemyIndex, event.cardIndex), 'place', () => {
          const replacement = createCardView(this, {
            x: position.x,
            y: position.y,
            card: event.replacementCard,
            width: this.battleLayout.cards.enemyWidth,
          }).setDepth(32).setAlpha(0);
          this.sound.play('cardPlace', { volume: 0.46 });
          this.tweens.add({
            targets: replacement,
            alpha: 1,
            scaleX: 1.08,
            scaleY: 1.08,
            duration: 240,
            yoyo: true,
            ease: 'Back.easeOut',
            onComplete: () => {
              this.time.delayedCall(520, () => {
                this.tweens.add({
                  targets: replacement,
                  alpha: 0,
                  duration: 220,
                  onComplete: () => {
                    replacement.destroy(true);
                    this.actionDealing = false;
                    this.render();
                    onComplete();
                  },
                });
              });
            },
          });
        });
      },
    });
  }

  private hasCombatEvents(events: BattlePresentationEvent[]): boolean {
    return events.some((event) => event.type === 'damage' || event.type === 'clash');
  }

  private hasRoundRevealEvent(events: BattlePresentationEvent[]): boolean {
    return events.some((event) => event.type === 'round-revealed');
  }

  private currentRevealEnemyIds(): Set<string> {
    return new Set(
      this.battle.enemies
        .filter((enemy) => enemy.hand.length > 0 && this.battle.results.some((result) => result.enemy === enemy))
        .map((enemy) => enemy.id),
    );
  }

  private hasBattleEndedEvent(events: BattlePresentationEvent[]): boolean {
    return events.some((event) => event.type === 'battle-ended');
  }

  private shouldDelayOutcomeForPresentation(events: BattlePresentationEvent[]): boolean {
    return (this.hasBattleEndedEvent(events) || this.hasPendingSoulRedeem())
      && (this.hasCombatEvents(events) || this.hasRoundRevealEvent(events));
  }

  private isPresentationBusy(): boolean {
    return this.dealing
      || this.playerRedealing
      || this.actionDealing
      || this.stageBannerPlaying
      || this.actionAnimationPlaying
      || this.presentationSequencePlaying
      || this.autoAdvancingRound;
  }

  private showChapter3DamageFeedbackIfNeeded(events: BattlePresentationEvent[], onComplete: () => void): boolean {
    if (this.battle.levelConfig?.id !== 'chapter1_3') {
      return false;
    }

    const combatEvents = this.combatEvents(events);
    const playerDamaged = combatEvents.some((event) => event.type === 'damage' && event.attacker === 'enemy' && event.amount > 0);
    const playerDealtDamage = combatEvents.some((event) => event.type === 'damage' && event.attacker === 'player' && event.amount > 0);
    const hadClash = combatEvents.some((event) => event.type === 'clash');

    if (playerDamaged) {
      this.chapter3ConsecutiveLosses += 1;
    } else if (playerDealtDamage || hadClash) {
      this.chapter3ConsecutiveLosses = 0;
    }

    if (!playerDamaged) {
      return false;
    }

    const messages = [this.dialogueMessageFromKey(this.nextChapter3TauntKey(this.chapter3LossCause()))];
    if (this.chapter3ConsecutiveLosses >= 2 && !this.chapter3LossHintShown) {
      this.chapter3LossHintShown = true;
      messages.push(this.dialogueMessageFromKey('tutorial.chapter1_3.lossHint'));
    }

    this.showBlockingMessageSequence(messages, onComplete);
    return true;
  }

  private chapter3LossCause(): 'compare' | 'invite' | 'playerDraw' | 'overpush' | 'generic' {
    const state = this.battle.getState();
    const playerDrew = state.player.drawCountThisRound > 0;
    const enemyWasInvited = state.enemies.some((enemy) => enemy.id === 'gambler' && enemy.invited !== undefined);

    if (playerDrew && enemyWasInvited) {
      return 'overpush';
    }

    if (playerDrew) {
      return 'playerDraw';
    }

    if (enemyWasInvited) {
      return 'invite';
    }

    if (state.currentFixedRoundId?.startsWith('chapter1_3')) {
      return 'compare';
    }

    return 'generic';
  }

  private nextChapter3TauntKey(cause: 'compare' | 'invite' | 'playerDraw' | 'overpush' | 'generic'): string {
    const keyGroups: Record<typeof cause, string[]> = {
      compare: [
        'tutorial.chapter1_3.tauntCompare1',
        'tutorial.chapter1_3.tauntCompare2',
      ],
      invite: [
        'tutorial.chapter1_3.tauntInvite1',
        'tutorial.chapter1_3.tauntInvite2',
      ],
      playerDraw: [
        'tutorial.chapter1_3.tauntPlayerDraw1',
        'tutorial.chapter1_3.tauntPlayerDraw2',
      ],
      overpush: [
        'tutorial.chapter1_3.tauntOverpush1',
        'tutorial.chapter1_3.tauntOverpush2',
      ],
      generic: [
        'tutorial.chapter1_3.tauntGeneric1',
        'tutorial.chapter1_3.tauntGeneric2',
      ],
    };
    const keys = keyGroups[cause];
    const key = keys[this.chapter3TauntIndex % keys.length];
    this.chapter3TauntIndex += 1;
    return key;
  }

  private showChapter4ResonanceFeedbackIfNeeded(events: BattlePresentationEvent[], onComplete: () => void): boolean {
    if (this.battle.levelConfig?.id !== 'chapter1_4') {
      return false;
    }

    const resonantDamage = this.combatEvents(events).find((event) => (
      event.type === 'damage'
      && event.amount > 0
      && event.resonance !== undefined
      && event.resonance !== 'none'
    ));
    if (!resonantDamage || resonantDamage.type !== 'damage') {
      return false;
    }

    const feedbackId = this.chapter4ResonanceFeedbackId(resonantDamage.attacker, resonantDamage.resonance);
    if (!feedbackId || this.shownChapter4ResonanceFeedbackIds.has(feedbackId)) {
      return false;
    }

    const keys = this.chapter4ResonanceFeedbackKeys(feedbackId);
    if (keys.length === 0) {
      return false;
    }

    this.shownChapter4ResonanceFeedbackIds.add(feedbackId);
    this.showBlockingMessageSequence(keys.map((key) => this.dialogueMessageFromKey(key)), onComplete);
    return true;
  }

  private chapter4ResonanceFeedbackId(attacker: 'player' | 'enemy', resonance?: ScoreResult['resonance']): 'player-resonance' | 'player-strong' | 'enemy-resonance' | 'enemy-strong' | undefined {
    if (attacker === 'player' && (resonance === 'strong' || resonance === 'boom')) {
      return 'player-strong';
    }

    if (attacker === 'player' && resonance === 'resonance') {
      return 'player-resonance';
    }

    if (attacker === 'enemy' && (resonance === 'strong' || resonance === 'boom')) {
      return 'enemy-strong';
    }

    if (attacker === 'enemy' && resonance === 'resonance') {
      return 'enemy-resonance';
    }

    return undefined;
  }

  private chapter4ResonanceFeedbackKeys(feedbackId: 'player-resonance' | 'player-strong' | 'enemy-resonance' | 'enemy-strong'): string[] {
    if (feedbackId === 'player-strong') {
      return [
        'tutorial.chapter1_4.feedback.playerStrong1',
        'tutorial.chapter1_4.feedback.playerStrong2',
      ];
    }

    if (feedbackId === 'player-resonance') {
      return [
        'tutorial.chapter1_4.feedback.playerResonance1',
        'tutorial.chapter1_4.feedback.playerResonance2',
      ];
    }

    if (feedbackId === 'enemy-strong') {
      return [
        'tutorial.chapter1_4.feedback.enemyStrong1',
        'tutorial.chapter1_4.feedback.enemyStrong2',
      ];
    }

    if (feedbackId === 'enemy-resonance') {
      return [
        'tutorial.chapter1_4.feedback.enemyResonance1',
        'tutorial.chapter1_4.feedback.enemyResonance2',
      ];
    }

    return [];
  }

  private combatEvents(events: BattlePresentationEvent[]): BattleCombatPresentationEvent[] {
    return events.filter((event): event is BattleCombatPresentationEvent => event.type === 'damage' || event.type === 'clash');
  }

  private cardDealEvents(events: BattlePresentationEvent[]): Extract<BattlePresentationEvent, { type: 'card-dealt' }>[] {
    return events.filter((event): event is Extract<BattlePresentationEvent, { type: 'card-dealt' }> => event.type === 'card-dealt');
  }

  private playDamageAnimations(events: BattleCombatPresentationEvent[], onComplete?: () => void): void {
    if (events.length === 0) {
      onComplete?.();
      return;
    }

    const playNext = (index: number) => {
      if (index >= events.length) {
        onComplete?.();
        return;
      }

      const event = events[index];
      if (event.type === 'damage' && event.attacker === 'player' && event.evaded) {
        const enemy = this.battle.enemies.find((item) => item.id === event.enemyId);
        if (!enemy) {
          playNext(index + 1);
          return;
        }
        const positions = this.combatPositions(enemy);
        let hit = false;
        let attackFinished = false;
        let smokeFinished = false;
        let advanced = false;
        const finish = () => {
          if (attackFinished && smokeFinished && !advanced) {
            advanced = true;
            playNext(index + 1);
          }
        };
        this.playPlayerAttackEffect(positions.player, positions.enemy, event.resonance, 1, () => {
          // Multi-hit attacks consume the single dodge presentation only once.
          if (hit) return;
          hit = true;
          this.playSmokeSubstitutionEvadeEffect(enemy, positions.enemy, () => {
            smokeFinished = true;
            finish();
          });
        }, () => {
          attackFinished = true;
          finish();
        });
        return;
      }
      this.playCombatAnimation(event);
      const killRewardHeal = event.type === 'damage'
        ? (event.killRewardHeal ?? event.guard?.killRewardHeal ?? 0)
        : 0;
      const attackDelay = killRewardHeal > 0
        ? Math.max(1520, this.combatPresentationDelay(event, index === events.length - 1))
        : this.combatPresentationDelay(event, index === events.length - 1);
      this.time.delayedCall(attackDelay, () => {
        if (killRewardHeal <= 0 || event.type !== 'damage') {
          playNext(index + 1);
          return;
        }

        const sourceEnemyId = event.guard?.killRewardHeal
          ? event.guard.protectorEnemyId
          : event.enemyId;
        const sourceEnemyIndex = this.battle.enemies.findIndex((enemy) => enemy.id === sourceEnemyId);
        this.playKillRewardSoulHeal(sourceEnemyIndex, killRewardHeal, () => playNext(index + 1));
      });
    };

    playNext(0);
  }

  private playKillRewardSoulHeal(enemyIndex: number, amount: number, onComplete: () => void): void {
    if (enemyIndex < 0 || amount <= 0) {
      onComplete();
      return;
    }

    const player = this.playerSeatCenter();
    const source = this.enemyHealthEffectCenter(enemyIndex);
    const target = new Phaser.Math.Vector2(player.x, player.y - 90);
    const shard = this.add.container(source.x, source.y).setDepth(43).setAlpha(0).setScale(0.45);
    const glow = this.add.circle(0, 0, 18, 0x8f1422, 0.34)
      .setBlendMode(Phaser.BlendModes.ADD);
    const rim = this.add.polygon(0, 0, [
      0, -17,
      10, -5,
      6, 14,
      -5, 11,
      -10, -3,
    ], 0xd2363f, 0.52).setStrokeStyle(2, 0xe8a36a, 0.86);
    const stone = this.add.image(0, 0, SOUL_STONE_ART.textureKey)
      .setCrop(4, 6, 66, 116)
      .setDisplaySize(18, 30)
      .setTint(0xff8b82);
    const ember = this.add.circle(-1, 1, 4, 0xffd06a, 0.92)
      .setBlendMode(Phaser.BlendModes.ADD);
    shard.add([glow, rim, stone, ember]);

    this.playShockwave(source.x, source.y, 0x9e202c, 82);
    const midpoint = new Phaser.Math.Vector2(
      (source.x + target.x) / 2 + (source.x <= target.x ? -42 : 42),
      Math.min(source.y, target.y) - 82,
    );
    const curve = new Phaser.Curves.QuadraticBezier(source, midpoint, target);

    this.tweens.add({
      targets: shard,
      y: source.y - 15,
      alpha: 1,
      scale: 1,
      angle: -8,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(120, () => {
          const progress = { value: 0 };
          this.playBloodStoneTrail(curve, 740);
          this.tweens.add({
            targets: progress,
            value: 1,
            duration: 740,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
              const point = curve.getPoint(progress.value);
              shard.setPosition(point.x, point.y);
              shard.setAngle(-8 + progress.value * 34);
              shard.setScale(1 - progress.value * 0.18);
            },
            onComplete: () => {
              shard.destroy(true);
              this.sound.play('healSound', { volume: 0.56 });
              if (this.visualHpOverride) {
                this.visualHpOverride.player = Math.min(
                  this.battle.player.maxHp,
                  this.visualHpOverride.player + amount,
                );
                this.playerSoulStoneMeter?.setHp(this.visualHpOverride.player, true);
              }
              this.playPlayerSoulHealImpact(target.x, target.y, amount);
              this.time.delayedCall(420, onComplete);
            },
          });
        });
      },
    });
  }

  private playBloodStoneTrail(curve: Phaser.Curves.QuadraticBezier, duration: number): void {
    const colors = [0x5b0913, 0x9e202c, 0xd84b4f, 0xc68a45];
    for (let index = 0; index < 10; index += 1) {
      const mote = this.add.rectangle(0, 0, index % 3 === 0 ? 5 : 3, index % 3 === 0 ? 5 : 3, colors[index % colors.length], 0.88)
        .setDepth(41)
        .setAlpha(0)
        .setAngle(45);
      const progress = { value: 0 };
      this.tweens.add({
        targets: progress,
        value: 1,
        duration: Math.max(360, duration - 120),
        delay: 70 + index * 34,
        ease: 'Sine.easeInOut',
        onStart: () => mote.setAlpha(0.82),
        onUpdate: () => {
          const point = curve.getPoint(progress.value);
          mote.setPosition(point.x, point.y);
          mote.setAlpha(0.82 * (1 - progress.value * 0.72));
        },
        onComplete: () => {
          mote.destroy();
        },
      });
    }
  }

  private playPlayerSoulHealImpact(x: number, y: number, amount: number): void {
    const glow = this.add.circle(x, y, 34, 0xc52c35, 0.26)
      .setDepth(37)
      .setStrokeStyle(4, 0xe8a36a, 0.92);
    const inner = this.add.circle(x, y, 14, 0xff765f, 0.5).setDepth(38)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.playHealGainText(x, y - 28, amount, 44);
    this.playSoulRedeemParticles(x, y, 10, 0xe45a51);
    this.tweens.add({
      targets: [glow, inner],
      alpha: 0,
      scale: 2.8,
      duration: 680,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        glow.destroy();
        inner.destroy();
      },
    });
  }

  private combatPresentationDelay(event: BattleCombatPresentationEvent, isLast: boolean): number {
    if (event.type === 'damage' && event.guard) {
      return event.guard.legacyAttackBonus ? 3300 : 2800;
    }

    const jadeSwordAttack = getProgress().equippedAttackEffect === 'jade_sword_array'
      && (event.type === 'clash' || (event.type === 'damage' && event.attacker === 'player'));
    if (jadeSwordAttack) {
      return isLast ? 2050 : 1750;
    }

    const sakuraSlashAttack = getProgress().equippedAttackEffect === 'sakura_slash'
      && (event.type === 'clash' || (event.type === 'damage' && event.attacker === 'player'));
    if (sakuraSlashAttack) {
      return isLast ? 1900 : 1550;
    }

    const dragonGatePlayerAttack = event.type === 'damage'
      && event.attacker === 'player'
      && (
        event.enemyId === 'swordsman'
        || event.enemyId === 'songstress'
        || event.enemyId === 'taoist'
      );
    if (dragonGatePlayerAttack) {
      // A reveal can hit the swordsman first and then trigger his guard on a
      // later enemy. Let the first impact and HP update finish before the
      // guard frame starts moving, otherwise both timelines overlap.
      return isLast ? 1900 : 1700;
    }

    const extendedEnemyAttack = (
      event.enemyId === 'viking_warrior'
      || event.enemyId === 'rune_shaman'
      || event.enemyId === 'valkyrie'
      || event.enemyId === 'einherjar'
      || event.enemyId === 'swordsman'
      || event.enemyId === 'songstress'
      || event.enemyId === 'taoist'
    ) && (event.type === 'clash' || event.attacker === 'enemy');
    if (extendedEnemyAttack) {
      return isLast ? 2180 : 1820;
    }

    if (event.type === 'clash' || (event.type === 'damage' && event.attacker === 'enemy')) {
      return isLast ? 1880 : 1320;
    }

    return isLast ? 1520 : 820;
  }

  private playPassiveEffectEvents(events: BattlePresentationEvent[], onComplete: () => void): void {
    const arrivals = events.filter((event): event is Extract<BattlePresentationEvent, { type: 'enemy-entered' }> =>
      event.type === 'enemy-entered' && this.battle.enemies[event.enemyIndex]?.instanceId === event.enemyInstanceId);
    if (arrivals.length > 0) {
      this.prepareRoundDealVisibility();
      this.concealInitialRoundStatusBadges();
      this.actionAnimationPlaying = true;
      arrivals.forEach(event => this.enteringEnemyInstances.set(event.enemyInstanceId, { alpha: 0, offsetY: 12 }));
      this.render();
      let remaining = arrivals.length;
      arrivals.forEach((event, index) => this.time.delayedCall(index * 120, () => {
        const hud = this.enemyHudLayout(event.enemyIndex);
        playEndlessEnemyEntranceVfx(this, {
          center: this.enemySeatCenter(event.enemyIndex), width: hud.portrait.width, height: hud.portrait.height,
          onReveal: () => {
            const state = this.enteringEnemyInstances.get(event.enemyInstanceId);
            if (!state) return;
            this.tweens.add({ targets: state, alpha: 1, offsetY: 0, duration: 350, ease: 'Cubic.easeOut',
              onUpdate: () => {
                if (this.battle.enemies[event.enemyIndex]?.instanceId !== event.enemyInstanceId) return;
                this.seatContainers.get(event.enemyId)?.setAlpha(state.alpha)
                  .setY(this.enemySeatForIndex(event.enemyIndex).y + state.offsetY);
              } });
          },
          onComplete: () => {
            this.enteringEnemyInstances.delete(event.enemyInstanceId);
            if (--remaining > 0) return;
            this.actionAnimationPlaying = false;
            this.playPassiveEffectEvents(events.filter(e => e.type !== 'enemy-entered'), onComplete);
          },
        });
      }));
      return;
    }
    const passiveEvents = this.passiveEffectEvents(events);
    if (passiveEvents.length === 0) {
      onComplete();
      return;
    }

    const stagedHpEvents = passiveEvents.filter((event) => (
      event.passiveId === 'werewolf_lifesteal'
      || (event.passiveId === 'rune_blessing' && event.effect === 'heal')
      || (event.passiveId === 'hanami_dance' && event.effect === 'reward_heal')
    ));
    const ownsPassiveHpSnapshot = stagedHpEvents.length > 0 && !this.visualHpOverride;
    if (ownsPassiveHpSnapshot) {
      this.visualHpOverride = {
        player: this.battle.player.hp,
        enemies: this.battle.enemies.map((enemy) => enemy.hp),
      };
      this.visualEnemyDefeated = this.battle.enemies.map((enemy) => enemy.defeated);
      stagedHpEvents.forEach((event) => {
        const enemyIndex = event.passiveId === 'werewolf_lifesteal'
          ? event.sourceEnemyIndex
          : (event.targetEnemyIndexes[0] ?? event.sourceEnemyIndex);
        const currentHp = this.visualHpOverride?.enemies[enemyIndex];
        if (currentHp === undefined) {
          return;
        }
        this.visualHpOverride!.enemies[enemyIndex] = Math.max(0, currentHp - (event.amount ?? 0));
        this.visualEnemyDefeated![enemyIndex] = false;
      });
    }

    passiveEvents
      .filter((event) => (
        event.passiveId === 'red_silk_toast'
        || (event.passiveId === 'hanami_dance' && event.effect === 'reward_attack')
        || (event.passiveId === 'rune_blessing' && event.effect === 'attack')
      ))
      .forEach((event) => event.targetEnemyIds.forEach((enemyId) => this.hiddenRoundAttackBonusEnemyIds.add(enemyId)));
    passiveEvents
      .filter((event) => event.passiveId === 'war_horn')
      .forEach((event) => event.targetEnemyIds.forEach((enemyId) => this.hiddenPermanentAttackBonusEnemyIds.add(enemyId)));
    passiveEvents
      .filter((event) => event.passiveId === 'einherjar_summon')
      .forEach((event) => event.targetEnemyIds.forEach((enemyId) => this.hiddenSummonedEnemyIds.add(enemyId)));
    passiveEvents
      .filter((event) => event.passiveId === 'hanami_dance' && event.effect === 'mark')
      .forEach((event) => event.targetEnemyIds.forEach((enemyId) => this.hiddenHanamiFanTargetIds.add(enemyId)));
    passiveEvents
      .filter((event) => event.passiveId === 'heavenly_insight' && event.effect === 'sense')
      .forEach((event) => event.targetEnemyIds.forEach((enemyId) => this.hiddenTaoistTalismanTargetIds.add(enemyId)));
    this.actionAnimationPlaying = true;
    this.render();
    const playStep = (index: number) => {
      if (index >= passiveEvents.length) {
        this.hiddenRoundAttackBonusEnemyIds.clear();
        this.hiddenPermanentAttackBonusEnemyIds.clear();
        this.hiddenSummonedEnemyIds.clear();
        this.hiddenHanamiFanTargetIds.clear();
        this.hiddenTaoistTalismanTargetIds.clear();
        this.actionAnimationPlaying = false;
        if (ownsPassiveHpSnapshot) {
          this.visualHpOverride = undefined;
          this.visualEnemyDefeated = undefined;
        }
        this.render();
        onComplete();
        return;
      }

      this.playPassiveEffect(passiveEvents[index], () => {
        this.time.delayedCall(PASSIVE_EFFECT_TIMING.stepGap, () => playStep(index + 1));
      });
    };

    playStep(0);
  }

  private playPassiveEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    if (event.sourceEnemyInstanceId && this.battle.enemies[event.sourceEnemyIndex]?.instanceId !== event.sourceEnemyInstanceId
      || event.targetEnemyInstanceIds?.some((id, i) => this.battle.enemies[event.targetEnemyIndexes[i]]?.instanceId !== id)) {
      this.time.delayedCall(0, onComplete);
      return;
    }
    this.setEnemyPortraitPose(event.sourceEnemyIndex, 'cast');
    const finish = () => {
      onComplete();
    };

    const playedByDirector = this.passiveVfxDirector.play({
      scene: this,
      event,
      anchors: {
        source: this.enemySeatCenter(event.sourceEnemyIndex),
        sourceLabel: this.enemyPassiveLabelCenter(event.sourceEnemyIndex),
        sourceHealth: this.enemyHealthEffectCenter(event.sourceEnemyIndex),
        targets: event.targetEnemyIndexes.map((index) => this.enemySeatCenter(index)),
        player: this.playerSeatCenter(),
        playerHand: this.playerHandEffectCenter(),
        sourceHand: this.enemyHandEffectCenter(event.sourceEnemyIndex),
      },
      feedback: {
        showEnemyHeal: (enemyIndex, amount) => {
          const enemy = this.battle.enemies[enemyIndex];
          if (!enemy) {
            return;
          }

          if (this.visualHpOverride) {
            this.setEnemyVisualHp(enemyIndex, enemy.hp);
          } else {
            this.enemySoulStoneMeters.get(enemy.id)?.setHp(enemy.hp, true);
          }
          const source = this.enemySeatCenter(enemyIndex);
          this.sound.play('healSound', { volume: 0.5 });
          this.playHealGainText(source.x, source.y - 86, amount, 47);
        },
        revealEnemyAttackBonus: (enemyIndex) => {
          const enemy = this.battle.enemies[enemyIndex];
          if (!enemy) {
            return;
          }
          this.hiddenRoundAttackBonusEnemyIds.delete(enemy.id);
          this.hiddenPermanentAttackBonusEnemyIds.delete(enemy.id);
          this.render();
          this.playStatusGainText(this.enemySeatCenter(enemyIndex), 'attack', event.amount ?? 1);
        },
        revealSummonedEnemy: (enemyIndex) => {
          const enemy = this.battle.enemies[enemyIndex];
          if (!enemy) {
            return;
          }
          this.hiddenSummonedEnemyIds.delete(enemy.id);
          this.render();
          this.setEnemyPortraitPose(enemyIndex, 'cast');
        },
      },
      onComplete: finish,
    });
    if (playedByDirector) {
      return;
    }

    if (event.passiveId === 'goblin_instinct') {
      this.playGoblinInstinctEffect(event, finish);
      return;
    }

    if (event.passiveId === 'gambler_blessing') {
      this.playGamblerBlessingEffect(event, finish);
      return;
    }

    if (event.passiveId === 'werewolf_lifesteal') {
      this.playWerewolfLifestealEffect(event, finish);
      return;
    }

    if (event.passiveId === 'war_horn') {
      this.playWarHornEffect(event, finish);
      return;
    }

    if (event.passiveId === 'rune_blessing') {
      this.playRuneBlessingEffect(event, finish);
      return;
    }

    if (event.passiveId === 'red_silk_toast') {
      this.playRedSilkToastEffect(event, finish);
      return;
    }

    if (event.passiveId === 'heavenly_insight') {
      this.playHeavenlyInsightEffect(event, finish);
      return;
    }

    if (event.passiveId === 'iaijutsu_charge') {
      this.playIaijutsuChargeEffect(event, finish);
      return;
    }

    if (event.passiveId === 'smoke_substitution') {
      this.playSmokeScreenArmEffect(event, finish);
      return;
    }

    if (event.passiveId === 'hanami_dance') {
      this.playHanamiDanceEffect(event, finish);
      return;
    }

    this.playEinherjarSummonEffect(event, finish);
  }

  private playIaijutsuChargeEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    const amount = event.amount ?? 1;
    const release = event.effect === 'release';
    const color = 0xe15f58;
    const textColor = '#ffd19d';
    const label = release
      ? t('battle.passive.iaijutsuRelease', { amount })
      : t('battle.status.iaijutsu', { amount });

    this.sound.play(release ? 'attackFire' : 'cardPlace', { volume: release ? 0.52 : 0.42 });
    this.flashEnemySeat(event.sourceEnemyIndex, color, label, textColor);
    if (release) {
      this.playIaijutsuSlash(source.x, source.y, color, 0xf5d66b);
    } else {
      this.playIaijutsuSheath(source.x, source.y, color, amount);
    }

    this.time.delayedCall(release ? 1180 : 1040, onComplete);
  }

  private playSmokeScreenArmEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const index = event.sourceEnemyIndex;
    this.setEnemyPortraitPose(index, 'cast');
    this.time.delayedCall(320, () => {
      const source = this.enemySeatCenter(index);
      const hud = this.enemyHudLayout(index);
      this.ninjaSmoke?.destroy();
      this.ninjaSmoke = new NinjaSmokeVfx(this, source.x, source.y, Math.min(hud.portrait.width, hud.portrait.height) / 2);
      this.ninjaSmokeInstanceId = this.battle.enemies[index]?.instanceId;
      this.sound.play('attackWind', { volume: 0.36 });
      this.time.delayedCall(650, () => {
        this.setEnemyPortraitPose(index, 'idle');
        onComplete();
      });
    });
  }

  private playSmokeSubstitutionEvadeEffect(enemy: EnemyState, position: Phaser.Math.Vector2, onComplete: () => void): void {
    const index = this.battle.enemies.indexOf(enemy);
    const hud = this.enemyHudLayout(index);
    const smoke = this.ninjaSmoke ?? new NinjaSmokeVfx(this, position.x, position.y, Math.min(hud.portrait.width, hud.portrait.height) / 2);
    this.ninjaSmoke = smoke;
    this.ninjaSmokeInstanceId = enemy.instanceId;
    this.sound.play('attackWind', { volume: 0.46 });
    smoke.evade(() => {
      const portrait = this.enemyPortraits.get(index);
      if (portrait?.active) {
        const startX = portrait.x;
        this.tweens.add({
          targets: portrait, x: startX + 12, alpha: 0.3, duration: 140,
          yoyo: true, hold: 80, ease: 'Sine.easeOut'
        });
      }
      const label = this.enemyPassiveLabelCenter(index);
      const text = this.add.text(label.x, label.y, t('battle.passive.smokeScreenEvaded'), {
        fontFamily: GAME_FONT_FAMILY, fontSize: '22px', color: '#eef3f7',
        stroke: '#101114', strokeThickness: 5, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(48);
      this.tweens.add({
        targets: text, y: label.y - 16, alpha: 0,
        delay: 260, duration: 560, onComplete: () => text.destroy()
      });
    }, () => {
      if (this.ninjaSmoke === smoke) this.ninjaSmoke = undefined;
      this.setEnemyPortraitPose(index, 'idle');
      onComplete();
    });
  }

  private playHanamiDanceEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const targetIndex = event.targetEnemyIndexes[0];
    const targetEnemy = targetIndex === undefined ? undefined : this.battle.enemies[targetIndex];
    if (targetIndex === undefined || !targetEnemy) {
      onComplete();
      return;
    }
    const effect: HanamiEffect = event.effect === 'mark' ? 'mark'
      : event.effect === 'reward_heal' ? 'reward_heal' : 'reward_attack';
    const amount = event.amount ?? 0;
    this.setEnemyPortraitPose(event.sourceEnemyIndex, 'cast');
    this.sound.play('attackWind', { volume: effect === 'mark' ? 0.34 : 0.42 });
    playHanamiDanceVfx(this, {
      from: this.enemySeatCenter(event.sourceEnemyIndex),
      to: this.enemySeatCenter(targetIndex),
      effect,
      onHit: () => {
        if (effect === 'mark') {
          this.hiddenHanamiFanTargetIds.delete(targetEnemy.id);
        } else if (effect === 'reward_heal') {
          if (this.visualHpOverride) {
            this.setEnemyVisualHp(targetIndex, this.enemyDisplayHp(targetIndex) + amount);
          } else {
            this.enemySoulStoneMeters.get(targetEnemy.id)?.setHp(targetEnemy.hp, true);
          }
          this.sound.play('healSound', { volume: 0.48 });
        } else {
          this.hiddenRoundAttackBonusEnemyIds.delete(targetEnemy.id);
        }
        if (effect !== 'reward_heal') this.render();
        if (effect === 'reward_heal' || effect === 'reward_attack') {
          this.playStatusGainText(this.enemySeatCenter(targetIndex), effect === 'reward_heal' ? 'heal' : 'attack', amount);
        }
      },
      onComplete: () => {
        this.setEnemyPortraitPose(event.sourceEnemyIndex, 'idle');
        onComplete();
      },
    });
  }

  private playIaijutsuSheath(x: number, y: number, color: number, stacks: number): void {
    const seal = this.add.container(x, y).setDepth(27);
    const ring = this.add.circle(0, 0, 30, color, 0.1).setStrokeStyle(3, color, 0.9);
    const sheath = this.add.rectangle(0, 7, 78, 8, 0x31181d, 0.96).setStrokeStyle(2, 0xf5d66b, 0.82).setAngle(-18);
    const blade = this.add.rectangle(-8, -5, 58, 4, 0xffe1c0, 0.94).setAngle(-18);
    const stackText = this.add.text(0, -44, `${stacks}`, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '22px',
      color: '#ffd19d',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    stackText.setShadow(0, 0, '#e15f58', 10, true, true);
    seal.add([ring, sheath, blade, stackText]);
    // Keep the charge centered on the portrait; high stacks must not grow off-screen.
    this.playShockwave(x, y, color, Math.min(124, 96 + stacks * 8));
    this.playIaijutsuParticles(x, y, color, 0xf5d66b, false);
    this.tweens.add({
      targets: seal,
      scale: 1.62,
      alpha: 0,
      angle: -12,
      duration: 940,
      ease: 'Cubic.easeOut',
      onComplete: () => seal.destroy(true),
    });
  }

  private playIaijutsuSlash(x: number, y: number, color: number, gold: number): void {
    const slash = this.add.graphics().setDepth(28);
    slash.lineStyle(12, gold, 0.3);
    slash.beginPath();
    slash.moveTo(x - 72, y + 58);
    slash.lineTo(x + 70, y - 56);
    slash.strokePath();
    slash.lineStyle(4, 0xffffff, 0.96);
    slash.beginPath();
    slash.moveTo(x - 76, y + 58);
    slash.lineTo(x + 76, y - 58);
    slash.strokePath();
    slash.lineStyle(2, color, 1);
    slash.beginPath();
    slash.moveTo(x - 74, y + 58);
    slash.lineTo(x + 74, y - 58);
    slash.strokePath();
    this.playShockwave(x, y, gold, 142);
    this.playIaijutsuParticles(x, y, color, gold, true);
    this.tweens.add({
      targets: slash,
      alpha: 0,
      scale: 1.45,
      duration: 720,
      ease: 'Cubic.easeOut',
      onComplete: () => slash.destroy(),
    });
  }

  private playIaijutsuParticles(
    x: number,
    y: number,
    color: number,
    gold: number,
    release: boolean,
  ): void {
    const count = release ? 28 : 18;
    for (let index = 0; index < count; index += 1) {
      const slashBias = release && index < 16;
      const angle = slashBias
        ? Phaser.Math.DegToRad(-42 + Phaser.Math.Between(-13, 13))
        : Phaser.Math.FloatBetween(0, Math.PI * 2);
      const startDistance = release ? Phaser.Math.Between(8, 28) : Phaser.Math.Between(20, 46);
      const travel = release ? Phaser.Math.Between(48, 112) : Phaser.Math.Between(24, 64);
      const particle = this.add.rectangle(
        x + Math.cos(angle) * startDistance,
        y + Math.sin(angle) * startDistance,
        slashBias ? Phaser.Math.Between(8, 14) : Phaser.Math.Between(3, 6),
        slashBias ? 3 : Phaser.Math.Between(3, 7),
        index % 3 === 0 ? gold : color,
        release ? 0.96 : 0.82,
      ).setDepth(29).setRotation(angle).setBlendMode(Phaser.BlendModes.ADD);

      this.tweens.add({
        targets: particle,
        x: particle.x + Math.cos(angle) * travel,
        y: particle.y + Math.sin(angle) * travel + (release ? 4 : -8),
        alpha: 0,
        scaleX: release ? 0.25 : 0.45,
        scaleY: 0.25,
        angle: particle.angle + (release ? 28 : 55),
        delay: release ? index * 9 : index * 14,
        duration: release ? Phaser.Math.Between(430, 650) : Phaser.Math.Between(520, 760),
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  private playGoblinInstinctEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    const player = this.playerSeatCenter();
    this.sound.play('attackWind', { volume: 0.28 });
    this.flashEnemySeat(event.sourceEnemyIndex, 0x65d46e, t('battle.passive.goblinInstinct'), '#78d18a');
    this.playShockwave(source.x, source.y, 0x65d46e, 140);
    this.playInsightLine(source, player, 0x65d46e);
    this.time.delayedCall(PASSIVE_EFFECT_TIMING.goblinTotal, onComplete);
  }

  private playGamblerBlessingEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    this.sound.play('cardPlace', { volume: 0.48 });
    this.flashEnemySeat(event.sourceEnemyIndex, 0xf25f9a, t('battle.passive.gamblerBlessing'), '#ff7bb6');
    this.playCardShuffleBurst(source.x, source.y + 16, 0xf25f9a);
    this.time.delayedCall(PASSIVE_EFFECT_TIMING.standardTotal, onComplete);
  }

  private playWerewolfLifestealEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    const player = this.playerSeatCenter();
    this.sound.play('healSound', { volume: 0.46 });
    this.flashEnemySeat(event.sourceEnemyIndex, 0x73c7ff, t('battle.passive.werewolfLifesteal'), '#88d4ff');
    this.playBloodReturn(player, source, 0xef6f6c);
    this.time.delayedCall(260, () => this.flashEnemySeat(event.sourceEnemyIndex, 0x78d18a, t('battle.passive.hpGain', { amount: event.amount ?? 1 }), '#89f09f'));
    this.time.delayedCall(PASSIVE_EFFECT_TIMING.standardTotal, onComplete);
  }

  private playWarHornEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    this.sound.play('attackFire', { volume: 0.46 });
    this.flashEnemySeat(event.sourceEnemyIndex, 0xff8a3d, t('battle.passive.warHorn'), '#ffad6b');
    this.playShockwave(source.x, source.y, 0xff5a2c, 260);
    event.targetEnemyIndexes.forEach((index, offset) => {
      this.time.delayedCall(120 + offset * 70, () => this.flashEnemySeat(index, 0xff3f3f, t('battle.passive.attackUp'), '#ff6f6f'));
    });
    this.time.delayedCall(PASSIVE_EFFECT_TIMING.standardTotal, onComplete);
  }

  private playRuneBlessingEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    const isHeal = event.effect === 'heal';
    const color = isHeal ? 0x78d18a : 0x79c9ff;
    const textColor = isHeal ? '#89f09f' : '#9ed8ff';
    this.sound.play(isHeal ? 'healSound' : 'attackWind', { volume: isHeal ? 0.44 : 0.36 });
    this.flashEnemySeat(event.sourceEnemyIndex, 0x79c9ff, t('battle.passive.runeBlessing'), '#9ed8ff');
    this.playShockwave(source.x, source.y, 0x79c9ff, 190);
    event.targetEnemyIndexes.forEach((index, offset) => {
      const label = isHeal ? t('battle.passive.hpUp') : t('battle.passive.attackUp');
      this.time.delayedCall(180 + offset * 80, () => this.flashEnemySeat(index, color, label, textColor));
    });
    this.time.delayedCall(PASSIVE_EFFECT_TIMING.standardTotal, onComplete);
  }

  private playEinherjarSummonEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    event.targetEnemyIndexes.forEach((index) => this.setEnemyPortraitPose(index, 'cast'));
    this.sound.play('resonanceEcho', { volume: 0.5 });
    this.flashEnemySeat(event.sourceEnemyIndex, 0xf7d889, t('battle.passive.einherjarSummon'), '#ffe39a');
    this.playShockwave(source.x, source.y, 0xf7d889, 220);
    event.targetEnemyIndexes.forEach((index, offset) => {
      this.time.delayedCall(220 + offset * 120, () => {
        const target = this.enemySeatCenter(index);
        this.playSummonColumn(target.x, target.y, 0xf7d889);
        this.flashEnemySeat(index, 0xf7d889, t('battle.passive.einherjarArrive'), '#ffe39a');
      });
    });
    this.time.delayedCall(PASSIVE_EFFECT_TIMING.standardTotal, () => {
      onComplete();
    });
  }

  private playRedSilkToastEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    const targetIndex = event.targetEnemyIndexes[0];
    if (targetIndex === undefined) {
      onComplete();
      return;
    }

    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    const target = this.enemySeatCenter(targetIndex);
    const targetEnemy = this.battle.enemies[targetIndex];
    const hpBeforeToast = targetEnemy ? Math.max(0, targetEnemy.hp - 1) : undefined;
    if (targetEnemy && hpBeforeToast !== undefined) {
      this.enemySoulStoneMeters.get(targetEnemy.id)?.setHp(hpBeforeToast);
    }
    this.flashEnemySeat(event.sourceEnemyIndex, 0xf29bc2, t('battle.passive.redSilkToast'), '#ffb8d6');
    playRedSilkToastVfx(this, {
      source,
      target,
      onHeal: () => {
        this.sound.play('healSound', { volume: 0.42 });
        if (targetEnemy) {
          this.enemySoulStoneMeters.get(targetEnemy.id)?.setHp(targetEnemy.hp, true);
        }
        this.playStatusGainText(target, 'heal', 1);
        this.flashEnemySeat(targetIndex, 0x78d18a, t('battle.passive.hpUp'), '#89f09f');
      },
      onAttackUp: () => {
        const targetEnemyId = event.targetEnemyIds[0];
        if (targetEnemyId) {
          this.hiddenRoundAttackBonusEnemyIds.delete(targetEnemyId);
        }
        this.render();
        this.playStatusGainText(target, 'attack', 1);
        this.flashEnemySeat(targetIndex, 0xf4519d, t('battle.passive.attackUp'), '#ffb8d6');
      },
      onComplete,
    });
  }

  private playHeavenlyInsightEffect(event: Extract<BattlePresentationEvent, { type: 'passive-effect' }>, onComplete: () => void): void {
    if (event.effect !== 'sense') {
      // Keep the presentation queue asynchronous so the existing card-level
      // talisman burn can take over without replaying the application flight.
      this.time.delayedCall(180, onComplete);
      return;
    }

    const source = this.enemySeatCenter(event.sourceEnemyIndex);
    const targetIndex = event.targetEnemyIndexes[0] ?? event.sourceEnemyIndex;
    const target = this.enemySeatCenter(targetIndex);
    this.flashEnemySeat(event.sourceEnemyIndex, 0x72d8b3, t('battle.passive.heavenlyInsight'), '#92f0cc');
    playHeavenlyInsightVfx(this, {
      source,
      target,
      mode: 'sense',
      onLand: () => {
        const targetEnemyId = event.targetEnemyIds[0];
        if (targetEnemyId) {
          this.hiddenTaoistTalismanTargetIds.delete(targetEnemyId);
          this.render();
        }
        this.flashEnemySeat(
          targetIndex,
          0x72d8b3,
          t('battle.passive.talismaned'),
          '#92f0cc',
        );
      },
      onComplete,
    });
  }

  private playRedSilkRibbon(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2): void {
    const ribbon = this.add.graphics().setDepth(27);
    const drawPath = () => {
      ribbon.beginPath();
      ribbon.moveTo(from.x, from.y);
      const steps = 24;
      for (let step = 1; step <= steps; step += 1) {
        const progress = step / steps;
        const x = Phaser.Math.Linear(from.x, to.x, progress);
        const y = Phaser.Math.Linear(from.y, to.y, progress) + Math.sin(progress * Math.PI * 3) * 18;
        ribbon.lineTo(x, y);
      }
      ribbon.strokePath();
    };

    ribbon.lineStyle(14, 0xf29bc2, 0.25);
    drawPath();
    ribbon.lineStyle(4, 0xffd8e8, 0.9);
    drawPath();

    const petals = Array.from({ length: 4 }, (_, index) => {
      const petal = this.add.circle(from.x, from.y, 6, 0xffc6df, 0.95).setDepth(28);
      petal.setStrokeStyle(1, 0xffffff, 0.9);
      this.time.delayedCall(index * 85, () => {
        this.tweens.add({
          targets: petal,
          x: to.x,
          y: to.y + (index - 1.5) * 12,
          alpha: 0,
          scale: 1.55,
          duration: 650,
          ease: 'Sine.easeInOut',
          onComplete: () => petal.destroy(),
        });
      });
      return petal;
    });

    this.tweens.add({
      targets: ribbon,
      alpha: 0,
      duration: 1540,
      delay: 180,
      ease: 'Sine.easeOut',
      onComplete: () => {
        petals.forEach((petal) => petal.destroy());
        ribbon.destroy();
      },
    });
  }

  private playEnergyTransfer(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number, textColor: number): void {
    const line = this.add.line(0, 0, from.x, from.y, to.x, to.y, color, 0.72).setOrigin(0, 0).setDepth(27);
    line.setLineWidth(4);
    const orb = this.add.circle(from.x, from.y, 9, color, 0.88).setDepth(28);
    orb.setStrokeStyle(2, textColor, 0.85);
    this.tweens.add({
      targets: line,
      alpha: 0,
      duration: 760,
      ease: 'Sine.easeOut',
      onComplete: () => line.destroy(),
    });
    this.tweens.add({
      targets: orb,
      x: to.x,
      y: to.y,
      scale: 1.45,
      duration: 720,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.playImpactBurst(to.x, to.y, color);
        orb.destroy();
      },
    });
  }

  private playTaoistRune(x: number, y: number, color: number): void {
    const rune = this.add.container(x, y).setDepth(27);
    const outer = this.add.circle(0, 0, 46, color, 0.08).setStrokeStyle(3, color, 0.8);
    const inner = this.add.circle(0, 0, 24, 0x071d18, 0.1).setStrokeStyle(2, 0xffffff, 0.42);
    const lineA = this.add.line(0, 0, -34, 0, 34, 0, color, 0.74).setOrigin(0, 0).setLineWidth(3);
    const lineB = this.add.line(0, 0, 0, -34, 0, 34, color, 0.74).setOrigin(0, 0).setLineWidth(3);
    rune.add([outer, inner, lineA, lineB]);
    this.tweens.add({
      targets: rune,
      angle: 120,
      scale: 1.34,
      alpha: 0,
      duration: 980,
      ease: 'Sine.easeOut',
      onComplete: () => rune.destroy(true),
    });
  }

  private playTalismanFlight(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2): void {
    const talisman = this.add.container(from.x, from.y).setDepth(29);
    const paper = this.add.rectangle(0, 0, 30, 46, 0xd9f8de, 0.96).setStrokeStyle(2, 0x72d8b3, 1);
    const seal = this.add.text(0, 0, '符', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '24px',
      color: '#1e8b6d',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    talisman.add([paper, seal]);
    this.tweens.add({
      targets: talisman,
      x: to.x,
      y: to.y,
      angle: 320,
      duration: 520,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.playShockwave(to.x, to.y, 0x72d8b3, 125);
        this.tweens.add({
          targets: talisman,
          alpha: 0,
          scale: 1.35,
          duration: 360,
          ease: 'Sine.easeOut',
          onComplete: () => talisman.destroy(true),
        });
      },
    });
  }

  private playTalismanBurn(x: number, y: number): void {
    const flame = this.add.container(x, y).setDepth(33);
    const paper = this.add.rectangle(0, 0, 36, 54, 0xd9f8de, 0.96).setStrokeStyle(2, 0x72d8b3, 1);
    const seal = this.add.text(0, 0, '符', {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '28px',
      color: '#1e8b6d',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const glow = this.add.circle(0, 0, 24, 0x9cf3c5, 0.24);
    flame.add([glow, paper, seal]);
    this.tweens.add({
      targets: flame,
      scaleX: 1.52,
      scaleY: 1.86,
      alpha: 0,
      angle: Phaser.Math.Between(-18, 18),
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => flame.destroy(true),
    });
  }

  private enemySeatCenter(index: number): Phaser.Math.Vector2 {
    const seat = this.enemySeatForIndex(index);
    const hud = this.enemyHudLayout(index);
    return new Phaser.Math.Vector2(seat.x + hud.portrait.x, seat.y + hud.portrait.y);
  }

  private enemyPassiveLabelCenter(index: number): Phaser.Math.Vector2 {
    const center = this.enemySeatCenter(index);
    const hud = this.enemyHudLayout(index);
    const topSeat = this.enemyHudSeat(index) === 'top';
    const preferredY = topSeat
      ? center.y + hud.portrait.height / 2 + 34
      : center.y - hud.portrait.height / 2 - 36;
    return new Phaser.Math.Vector2(
      Phaser.Math.Clamp(center.x, 96, this.battleLayout.canvas.width - 96),
      Phaser.Math.Clamp(preferredY, 42, this.battleLayout.canvas.height - 42),
    );
  }

  private enemyHealthEffectCenter(index: number): Phaser.Math.Vector2 {
    const center = this.enemySeatCenter(index);
    return new Phaser.Math.Vector2(
      Phaser.Math.Clamp(center.x, 34, this.battleLayout.canvas.width - 34),
      Phaser.Math.Clamp(center.y - 88, 38, this.battleLayout.canvas.height - 38),
    );
  }

  private flashEnemySeat(index: number, color: number, label: string, textColor: string, showLabel = true): void {
    const center = this.enemySeatCenter(index);
    const hud = this.enemyHudLayout(index);
    const topSeat = this.enemyHudSeat(index) === 'top';
    const overlay = this.add.container(center.x, center.y).setDepth(28);
    const radius = Math.min(hud.portrait.width, hud.portrait.height) / 2;
    const dragonGateParticles = this.battle.enemies[index]?.sourceThemeId === 'dragon_gate';
    if (dragonGateParticles) {
      playDriftingParticleAura(this, {
        x: center.x,
        y: center.y,
        colors: [color, Phaser.Display.Color.HexStringToColor(textColor).color, 0xd6aa62],
        count: 24,
        minRadius: Math.round(radius * 0.52),
        maxRadius: Math.round(radius * 0.92),
        duration: PASSIVE_EFFECT_TIMING.flashHold + PASSIVE_EFFECT_TIMING.flashOut,
        depth: 28,
        clockwise: index % 2 === 0,
        upwardDrift: 24,
      });
    }
    const text = this.add.text(topSeat ? radius + 18 : 0, topSeat ? -radius + 14 : -radius - 42, label, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '22px',
      color: textColor,
      fontStyle: 'bold',
      stroke: '#101114',
      strokeThickness: 5,
    }).setOrigin(topSeat ? 0 : 0.5, 0.5).setVisible(showLabel);
    text.setShadow(0, 0, textColor, 14, true, true);
    if (dragonGateParticles) {
      overlay.add(text);
    } else {
      const glow = this.add.circle(0, 0, radius + 12, color, 0.12).setStrokeStyle(4, color, 1);
      const inner = this.add.circle(0, 0, radius - 7, color, 0.04).setStrokeStyle(2, color, 0.58);
      overlay.add([glow, inner, text]);
    }
    overlay.setAlpha(0);
    overlay.setScale(0.94);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      scale: 1,
      duration: PASSIVE_EFFECT_TIMING.flashIn,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(PASSIVE_EFFECT_TIMING.flashHold, () => {
          this.tweens.add({
            targets: overlay,
            alpha: 0,
            scale: 1.08,
            duration: PASSIVE_EFFECT_TIMING.flashOut,
            ease: 'Sine.easeOut',
            onComplete: () => overlay.destroy(true),
          });
        });
      },
    });
  }

  private playShockwave(x: number, y: number, color: number, radius: number): void {
    const wave = this.add.circle(x, y, 18, color, 0.08).setStrokeStyle(5, color, 0.95).setDepth(24);
    const targetScale = radius / 18;
    this.tweens.add({
      targets: wave,
      scaleX: targetScale,
      scaleY: targetScale,
      alpha: 0,
      duration: PASSIVE_EFFECT_TIMING.shockwave,
      ease: 'Cubic.easeOut',
      onComplete: () => wave.destroy(),
    });
    wave.once(Phaser.GameObjects.Events.DESTROY, () => this.tweens.killTweensOf(wave));
  }

  private playSummonColumn(x: number, y: number, color: number): void {
    const column = this.add.rectangle(x, y, 74, 210, color, 0.24).setDepth(25);
    column.setStrokeStyle(3, color, 0.9);
    this.tweens.add({
      targets: column,
      alpha: 0,
      scaleY: 1.32,
      duration: PASSIVE_EFFECT_TIMING.shockwave,
      ease: 'Sine.easeOut',
      onComplete: () => column.destroy(),
    });
  }

  private playInsightLine(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number): void {
    const line = this.add.line(0, 0, from.x, from.y, to.x, to.y, color, 0.9).setOrigin(0, 0).setDepth(27);
    line.setLineWidth(4);
    this.tweens.add({
      targets: line,
      alpha: 0,
      duration: PASSIVE_EFFECT_TIMING.insightLine,
      ease: 'Sine.easeOut',
      onComplete: () => line.destroy(),
    });
  }

  private playCardShuffleBurst(x: number, y: number, color: number): void {
    for (let index = 0; index < 5; index += 1) {
      const card = this.add.rectangle(x - 36 + index * 18, y, 26, 36, 0xf2f2ed, 0.92).setStrokeStyle(2, color, 0.9).setDepth(27);
      card.setAngle(-16 + index * 8);
      this.tweens.add({
        targets: card,
        x: x + Math.sin(index) * 52,
        y: y - 34 - index * 4,
        angle: card.angle + 110,
        alpha: 0,
        duration: PASSIVE_EFFECT_TIMING.shuffleCard,
        ease: 'Cubic.easeOut',
        delay: index * 38,
        onComplete: () => card.destroy(),
      });
    }
  }

  private playBloodReturn(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number): void {
    const orb = this.add.circle(from.x, from.y - 18, 10, color, 0.82).setDepth(27);
    orb.setStrokeStyle(3, 0xffffff, 0.38);
    this.tweens.add({
      targets: orb,
      x: to.x,
      y: to.y,
      scale: 1.35,
      duration: PASSIVE_EFFECT_TIMING.bloodReturn,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.playImpactBurst(to.x, to.y, color);
        orb.destroy();
      },
    });
  }

  private playCombatAnimation(event: BattleCombatPresentationEvent): void {
    const enemy = this.battle.enemies.find((item) => event.enemyInstanceId
      ? item.instanceId === event.enemyInstanceId : item.id === event.enemyId);
    if (!enemy) {
      return;
    }

    const enemyIndex = this.battle.enemies.indexOf(enemy);
    const positions = this.combatPositions(enemy);
    if (event.type === 'clash') {
      this.playEnemyPortraitAttackMotion(enemyIndex, () => {
        this.playClashAnimation(positions.player, positions.enemy, enemy);
      });
      return;
    }

    if (!event.attacker) {
      return;
    }

    if (event.attacker === 'player') {
      if (event.guard) {
        this.playBladeToRescueCombatAnimation(event, enemy, positions.player, positions.enemy);
        return;
      }

      this.playPlayerAttackEffect(positions.player, positions.enemy, event.resonance, event.amount, (damage) => {
        if (damage > 0) {
          this.setEnemyPortraitPose(enemyIndex, 'hurt');
        }
        const explosive = event.resonance === 'strong' || event.resonance === 'boom';
        this.sound.play('damageExplosion', { volume: explosive ? 0.72 : event.resonance === 'resonance' ? 0.6 : 0.5, rate: explosive ? 0.78 : event.resonance === 'resonance' ? 0.9 : 1 });
        this.applyVisualDamage(event, enemy, damage);
        this.playCrimsonHitSplash(positions.player, positions.enemy, event.resonance, damage);
        this.playImpactBurst(positions.enemy.x, positions.enemy.y, event.resonance === 'boom' ? 0xff4633 : explosive ? 0xf5d66b : SKILL_COLORS.player);
        this.playDamageText(positions.enemy.x, positions.enemy.y - 42, damage, event.resonance);
        this.shakeSeat(enemy.id, event.resonance === 'boom' ? 16 : event.resonance === 'strong' ? 13 : event.resonance === 'resonance' ? 11 : 9);
      });
      return;
    }

    this.playEnemyPortraitAttackMotion(enemyIndex, () => {
      const finishAttackPose = () => {
        if (
          enemy.id === 'viking_warrior'
          || enemy.id === 'rune_shaman'
          || enemy.id === 'valkyrie'
          || enemy.id === 'einherjar'
          || enemy.id === 'swordsman'
          || enemy.id === 'songstress'
          || enemy.id === 'taoist'
          || enemy.id === 'shogun_samurai'
          || enemy.id === 'ninja'
          || enemy.id === 'oiran'
        ) {
          this.setEnemyPortraitPose(enemyIndex, 'idle');
        }
      };
      if (event.shielded) {
        this.playEnemyAttackProjectile(enemy, positions.enemy, positions.player, event.resonance, event.iaijutsuBonus !== undefined, () => {
          this.playHolyShieldBlock(event.originalAmount ?? 0, () => this.consumeVisualShieldCharge());
        }, finishAttackPose);
        return;
      }

      this.playEnemyAttackProjectile(enemy, positions.enemy, positions.player, event.resonance, event.iaijutsuBonus !== undefined, () => {
        this.setPlayerPortraitPose('hurt');
        this.sound.play('damageExplosion', { volume: 0.5 });
        this.applyVisualDamage(event, enemy);
        this.playCrimsonHitSplash(positions.enemy, positions.player, event.resonance, event.amount);
        this.playImpactBurst(positions.player.x, positions.player.y, SKILL_COLORS[enemy.id]);
        this.playDamageText(positions.player.x, positions.player.y - 42, event.amount, event.resonance);
        this.shakeSeat('player', event.resonance === 'boom' ? 16 : event.resonance === 'strong' ? 13 : event.resonance === 'resonance' ? 11 : 9);
      }, finishAttackPose);
    });
  }

  private consumeVisualShieldCharge(): void {
    if (this.visualPlayerShieldChargesOverride === undefined) {
      return;
    }

    this.visualPlayerShieldChargesOverride = Math.max(0, this.visualPlayerShieldChargesOverride - 1);
    this.render();
  }

  private createResonanceImpactFeedback(
    position: Phaser.Math.Vector2,
    resonance: ScoreResult['resonance'] | undefined,
    onHit: () => void,
    onComplete: () => void = () => undefined,
  ): { hit: () => void; complete: () => void } {
    if (!resonance || resonance === 'none') return { hit: onHit, complete: onComplete };
    const priorTweens = new Set(this.tweens.getTweens());
    const strong = resonance === 'strong' || resonance === 'boom';
    const hold = resonance === 'boom' ? 90 : strong ? 80 : 55;
    let hitStarted = false;
    let holding = false;
    let completionQueued = false;
    let completed = false;
    const complete = () => {
      if (completed) return;
      if (holding) { completionQueued = true; return; }
      completed = true;
      onComplete();
    };
    return {
      complete,
      hit: () => {
        if (hitStarted) return;
        hitStarted = true;
        holding = true;
        const flash = this.add.ellipse(position.x, position.y, strong ? 90 : 64, strong ? 66 : 46,
          0xfff2be, strong ? 0.65 : 0.45).setDepth(46).setBlendMode(Phaser.BlendModes.ADD);
        // Capture after the weapon's callback has spawned its impact particles.
        // Existing UI/passive tweens and the scene clock keep running.
        this.time.delayedCall(0, () => {
          const paused = this.tweens.getTweens().filter((tween) => !priorTweens.has(tween) && !tween.isPaused());
          paused.forEach((tween) => tween.pause());
          this.time.delayedCall(hold, () => {
            paused.forEach((tween) => { if (tween.isPaused()) tween.resume(); });
            if (this.time.now - this.lastResonanceImpactAt >= 180) {
              this.lastResonanceImpactAt = this.time.now;
              this.cameras.main.shake(strong ? 170 : 110, strong ? 0.006 : 0.003);
              this.sound.play('resonanceEcho', { volume: strong ? 0.38 : 0.24, rate: strong ? 0.72 : 0.9 });
            }
            this.tweens.add({ targets: flash, scaleX: strong ? 1.6 : 1.35, scaleY: 0.35,
              alpha: 0, duration: 180, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
            onHit();
            holding = false;
            if (completionQueued) complete();
          });
        });
      },
    };
  }

  private playPlayerAttackEffect(
    from: Phaser.Math.Vector2,
    to: Phaser.Math.Vector2,
    resonance: ScoreResult['resonance'] | undefined,
    damage: number,
    onHit: (damage: number) => void,
    onComplete?: () => void,
  ): void {
    this.playPlayerFrameAttackMotion(() => {
      this.playEquippedPlayerAttackEffect(from, to, resonance, damage, onHit, onComplete);
    });
  }

  private playEquippedPlayerAttackEffect(
    from: Phaser.Math.Vector2,
    to: Phaser.Math.Vector2,
    resonance: ScoreResult['resonance'] | undefined,
    damage: number,
    onHit: (damage: number) => void,
    onComplete?: () => void,
  ): void {
    const equippedAttackEffect = getProgress().equippedAttackEffect;
    const feedback = this.createResonanceImpactFeedback(to, resonance, () => onHit(damage), onComplete);
    const hit = () => feedback.hit();
    const complete = () => feedback.complete();

    if (equippedAttackEffect === 'sakura_slash') {
      const sakuraTier = resonance === 'boom' ? 'boom'
        : resonance === 'strong' ? 'strong'
          : resonance === 'resonance' ? 'resonance' : 'normal';
      this.playSakuraSlashAttack(from, to, sakuraTier, damage, hit, complete);
      return;
    }

    if (equippedAttackEffect === 'thunder_hammer') {
      playThunderHammerEffect(this, {
        from,
        to,
        tier: resonance === 'boom' ? 'boom'
          : resonance === 'strong' ? 'strong'
            : resonance === 'resonance' ? 'resonance' : 'normal',
        onHit: hit,
        onComplete: complete,
      });
      return;
    }

    if (equippedAttackEffect === 'jade_sword_array') {
      const jadeTier = resonance === 'strong' || resonance === 'boom' ? 'strong'
        : resonance === 'resonance' ? 'resonance' : undefined;
      this.playJadeSwordArray(from, to, jadeTier, () => {
        hit();
        complete();
      });
      return;
    }

    playDefaultFateAttackEffect(this, {
      from,
      to,
      resonance,
      onHit: hit,
      onComplete: complete,
    });
  }

  private playBladeToRescueCombatAnimation(
    event: Extract<BattleCombatPresentationEvent, { type: 'damage' }>,
    protectedEnemy: EnemyState,
    playerPosition: Phaser.Math.Vector2,
    protectedPosition: Phaser.Math.Vector2,
  ): void {
    const guard = event.guard;
    if (!guard) {
      return;
    }

    const protector = this.battle.enemies[guard.protectorEnemyIndex];
    const protectorPanel = protector && this.seatContainers.get(protector.id);
    const protectorFrame = this.enemyFrameContainers.get(guard.protectorEnemyIndex);
    if (!protector || !protectorPanel || !protectorFrame) {
      return;
    }

    this.playBladeToRescueSequence(
      event,
      protectedEnemy,
      protector,
      protectorPanel,
      protectorFrame,
      playerPosition,
      protectedPosition,
    );
  }

  private playBladeToRescueSequence(
    event: Extract<BattleCombatPresentationEvent, { type: 'damage' }>,
    protectedEnemy: EnemyState,
    protector: EnemyState,
    protectorPanel: Phaser.GameObjects.Container,
    protectorFrame: Phaser.GameObjects.Container,
    playerPosition: Phaser.Math.Vector2,
    protectedPosition: Phaser.Math.Vector2,
  ): void {
    const guard = event.guard;
    if (!guard) {
      return;
    }

    const red = 0xf05f42;
    const gold = 0xf5d66b;
    const frameHome = new Phaser.Math.Vector2(protectorFrame.x, protectorFrame.y);
    const frameHomeScale = new Phaser.Math.Vector2(protectorFrame.scaleX, protectorFrame.scaleY);
    const incomingDirection = new Phaser.Math.Vector2(
      playerPosition.x - protectedPosition.x,
      playerPosition.y - protectedPosition.y,
    ).normalize();
    const blockPosition = new Phaser.Math.Vector2(
      protectedPosition.x + incomingDirection.x * 76,
      protectedPosition.y + incomingDirection.y * 76,
    );
    const blockLocalPosition = new Phaser.Math.Vector2(
      blockPosition.x - protectorPanel.x,
      blockPosition.y - protectorPanel.y,
    );
    const panelHomeDepth = protectorPanel.depth;
    const frameHomeDepth = protectorFrame.depth;

    this.setEnemyPortraitPose(guard.protectorEnemyIndex, 'cast');
    this.flashEnemySeat(guard.protectorEnemyIndex, red, t('battle.passive.chivalry'), '#ff9a72');
    this.sound.play('attackWind', { volume: 0.42, rate: 0.9 });
    protectorPanel.setDepth(27);
    protectorFrame.setDepth(20);
    this.tweens.killTweensOf(protectorFrame);
    this.tweens.add({
      targets: protectorFrame,
      x: blockLocalPosition.x,
      y: blockLocalPosition.y,
      scaleX: frameHomeScale.x,
      scaleY: frameHomeScale.y,
      alpha: 1,
      duration: 320,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        this.playPlayerAttackEffect(playerPosition, blockPosition, event.resonance, event.amount, () => {
          this.sound.play('damageExplosion', { volume: 0.5 });
          this.setEnemyVisualHp(guard.protectorEnemyIndex, guard.protectorHpAfter);
          this.setEnemyPortraitPose(guard.protectorEnemyIndex, 'hurt');
          this.playDamageText(blockPosition.x, blockPosition.y - 48, guard.preventedDamage);
          this.tweens.add({
            targets: protectorFrame,
            scaleX: frameHomeScale.x * 1.08,
            scaleY: frameHomeScale.y * 1.08,
            duration: 90,
            yoyo: true,
            ease: 'Sine.easeInOut',
          });

          if (!guard.legacyAttackBonus) {
            this.time.delayedCall(360, () => {
              this.tweens.add({
                targets: protectorFrame,
                x: frameHome.x,
                y: frameHome.y,
                scaleX: frameHomeScale.x,
                scaleY: frameHomeScale.y,
                duration: 420,
                ease: 'Cubic.easeInOut',
                onComplete: () => {
                  protectorFrame.setDepth(frameHomeDepth);
                  protectorPanel.setDepth(panelHomeDepth);
                  this.setEnemyPortraitPose(guard.protectorEnemyIndex, 'idle');
                },
              });
            });
            return;
          }

          this.time.delayedCall(420, () => {
            this.tweens.add({
              targets: protectorFrame,
              alpha: 0,
              scaleX: frameHomeScale.x * 0.94,
              scaleY: frameHomeScale.y * 0.94,
              duration: 360,
              ease: 'Cubic.easeOut',
              onComplete: () => {
                protectorFrame.setDepth(frameHomeDepth);
                protectorPanel.setDepth(panelHomeDepth);
                this.playStatusGainText(this.enemySeatCenter(this.battle.enemies.indexOf(protectedEnemy)), 'attack', guard.legacyAttackBonus ?? 0);
                this.flashEnemySeat(
                  this.battle.enemies.indexOf(protectedEnemy),
                  gold,
                  t('battle.passive.chivalryLegacy'),
                  '#ffe29a',
                );
              },
            });
          });
        });
      },
    });
  }

  private playBladeGuardBurst(x: number, y: number, red: number, gold: number): void {
    const burst = this.add.graphics().setDepth(29);
    burst.lineStyle(8, gold, 0.95);
    burst.beginPath();
    burst.moveTo(x - 44, y + 36);
    burst.lineTo(x + 44, y - 36);
    burst.moveTo(x - 38, y - 42);
    burst.lineTo(x + 38, y + 42);
    burst.strokePath();
    burst.lineStyle(3, 0xffffff, 0.94);
    burst.beginPath();
    burst.moveTo(x - 48, y);
    burst.lineTo(x + 48, y);
    burst.strokePath();
    playDriftingParticleAura(this, {
      x,
      y,
      colors: [0x351014, red, gold, 0xf2d58b],
      count: 22,
      minRadius: 16,
      maxRadius: 54,
      duration: 520,
      depth: 28,
      upwardDrift: 16,
    });
    this.tweens.add({
      targets: burst,
      alpha: 0,
      scale: 2.4,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        burst.destroy();
      },
    });
  }

  private playSakuraSlashAttack(
    from: Phaser.Math.Vector2,
    to: Phaser.Math.Vector2,
    tier: 'normal' | 'resonance' | 'strong' | 'boom',
    damage: number,
    onHit: (damage: number) => void,
    onComplete: () => void,
  ): void {
    const pink = 0xff79bd;
    const softPink = 0xffb7dc;
    const gold = 0xffefbd;
    const tierRank = tier === 'boom' ? 3 : tier === 'strong' ? 2 : tier === 'resonance' ? 1 : 0;
    const pivot = new Phaser.Math.Vector2(from.x, from.y - 8);
    const swing = this.add.container(pivot.x, pivot.y).setDepth(31).setAngle(-180).setAlpha(0);
    const katanaGlow = this.add.image(22, 0, SAKURA_KATANA_TEXTURE_KEY).setOrigin(0.18, 0.5)
      .setDisplaySize(190, 21).setTint(tierRank >= 2 ? gold : pink)
      .setAlpha(tierRank >= 2 ? 0.3 : 0.2).setBlendMode(Phaser.BlendModes.ADD);
    const katana = this.add.image(22, 0, SAKURA_KATANA_TEXTURE_KEY).setOrigin(0.18, 0.5)
      .setDisplaySize(184, 20);
    swing.add([katanaGlow, katana]);
    const chargePetalCounts = [10, 16, 24, 30];
    const afterimageCounts = [14, 24, 34, 42];
    this.playSakuraChargePetals(pivot.x, pivot.y, chargePetalCounts[tierRank], pink, tierRank);
    if (tierRank > 0) playResonanceGather(this, pivot, pink, tierRank >= 2);
    this.sound.play('attackWind', { volume: 0.54 + tierRank * 0.06 });
    this.tweens.add({ targets: swing, alpha: 1, duration: 190, ease: 'Cubic.easeOut' });

    this.time.delayedCall(330, () => {
      let lastTrailAt = -Infinity;
      let nextAfterimage = 0;
      const afterimageCount = afterimageCounts[tierRank];
      this.tweens.add({
        targets: swing,
        angle: 0,
        duration: tierRank >= 2 ? 390 : 440,
        ease: 'Cubic.easeIn',
        onUpdate: () => {
          const swingProgress = Phaser.Math.Clamp((swing.angle + 180) / 180, 0, 1);
          while (nextAfterimage < afterimageCount
            && swingProgress >= nextAfterimage / Math.max(1, afterimageCount - 1)) {
            const echoAngle = -180 + nextAfterimage * 180 / Math.max(1, afterimageCount - 1);
            this.createSakuraKatanaAfterimage(
              pivot.x,
              pivot.y,
              echoAngle,
              pink,
              gold,
              tierRank,
              nextAfterimage,
              afterimageCount,
            );
            nextAfterimage += 1;
          }
          if (this.time.now - lastTrailAt >= 34) {
            lastTrailAt = this.time.now;
            this.createSakuraSwingTrail(pivot.x, pivot.y, swing.angle, pink, softPink, gold, tierRank);
          }
        },
        onComplete: () => {
          swing.destroy(true);
          const bladeTip = new Phaser.Math.Vector2(pivot.x + 174, pivot.y);
          this.playSakuraSpaceCut(bladeTip, to, pink, softPink, gold, tierRank, () => {
            if (damage <= 0) {
              this.playSakuraCutImpact(to.x, to.y, pink, softPink, gold, tierRank);
              onHit(damage);
              this.time.delayedCall(360, onComplete);
              return;
            }

            const wound = this.createSakuraWound(to.x, to.y, pink, gold, tierRank);
            this.time.delayedCall(90, () => {
              onHit(damage);
              this.playSakuraCutImpact(to.x, to.y, pink, softPink, gold, tierRank);
              this.tweens.add({
                targets: wound,
                alpha: 0,
                scaleX: 1.34,
                scaleY: 0.72,
                duration: 430,
                delay: 170,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                  wound.destroy(true);
                  onComplete();
                },
              });
            });
          });
        },
      });
    });
  }

  private createSakuraWound(
    x: number,
    y: number,
    pink: number,
    gold: number,
    tierRank: number,
  ): Phaser.GameObjects.Container {
    const wound = this.add.container(x, y).setDepth(30);
    const size = 68 + tierRank * 8;
    const shadow = this.add.graphics();
    shadow.lineStyle(11 + tierRank, 0x16080d, 0.86);
    shadow.beginPath();
    shadow.moveTo(-size, size * 0.58);
    shadow.lineTo(-size * 0.38, size * 0.16);
    shadow.lineTo(size * 0.06, -size * 0.02);
    shadow.lineTo(size * 0.48, -size * 0.38);
    shadow.lineTo(size, -size * 0.58);
    shadow.strokePath();

    const edge = this.add.graphics();
    edge.lineStyle(6 + tierRank, tierRank >= 2 ? gold : 0x9e173f, 0.96);
    edge.beginPath();
    edge.moveTo(-size * 0.96, size * 0.55);
    edge.lineTo(-size * 0.34, size * 0.13);
    edge.lineTo(size * 0.08, -size * 0.04);
    edge.lineTo(size * 0.5, -size * 0.4);
    edge.lineTo(size * 0.96, -size * 0.55);
    edge.strokePath();

    const core = this.add.graphics();
    core.lineStyle(tierRank >= 2 ? 3 : 2, tierRank >= 1 ? 0xfff5fb : pink, 0.98);
    core.beginPath();
    core.moveTo(-size * 0.9, size * 0.54);
    core.lineTo(size * 0.9, -size * 0.54);
    core.strokePath();

    const cracks = this.add.graphics();
    cracks.lineStyle(2, 0x69132d, 0.9);
    cracks.beginPath();
    cracks.moveTo(-size * 0.28, size * 0.1);
    cracks.lineTo(-size * 0.42, -size * 0.2);
    cracks.moveTo(size * 0.18, -size * 0.14);
    cracks.lineTo(size * 0.36, size * 0.12);
    cracks.strokePath();

    const glow = this.add.ellipse(0, 0, size * 1.35, size * 0.66, 0x6d0d2b, 0.16)
      .setBlendMode(Phaser.BlendModes.ADD);
    wound.add([glow, shadow, edge, core, cracks]);
    wound.setScale(0.84);
    this.tweens.add({
      targets: wound,
      scale: 1.06,
      duration: tierRank >= 2 ? 230 : 190,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    });
    return wound;
  }

  private playSakuraChargePetals(x: number, y: number, count: number, pink: number, tierRank: number): void {
    for (let index = 0; index < count; index += 1) {
      this.time.delayedCall(index * 28, () => {
        const startX = x + Phaser.Math.Between(-112, 112);
        const startY = y - Phaser.Math.Between(48, 126);
        const petal = this.add.ellipse(startX, startY, 8 + tierRank, 14 + tierRank * 2,
          index % 5 === 0 ? 0xffedf6 : pink, 0.82 + tierRank * 0.04)
          .setDepth(34)
          .setAngle(Phaser.Math.Between(-80, 80))
          .setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: petal,
          alpha: 0,
          x: startX + Phaser.Math.Between(-48, 64),
          y: y + Phaser.Math.Between(24, 82),
          angle: petal.angle + Phaser.Math.Between(180, 380),
          scaleX: 0.48,
          scaleY: 0.72,
          duration: Phaser.Math.Between(620, 900),
          ease: 'Sine.easeInOut',
          onComplete: () => petal.destroy(),
        });
      });
    }
  }

  private createSakuraSwingTrail(
    x: number,
    y: number,
    angle: number,
    pink: number,
    softPink: number,
    gold: number,
    tierRank: number,
  ): void {
    const trail = this.add.graphics().setDepth(27).setBlendMode(Phaser.BlendModes.ADD);
    const radius = 171;
    const bladeRootRadius = 58;
    const bladeCenterRadius = 116;
    const end = Phaser.Math.DegToRad(angle);
    const span = 0.34 + tierRank * 0.09;
    const segments = 7;
    for (let index = 0; index < segments; index += 1) {
      const t0 = index / segments;
      const t1 = (index + 1) / segments;
      const taper = Math.sin(Math.PI * (t0 + t1) * 0.5);
      const a0 = end - span + span * t0;
      const a1 = end - span + span * t1;
      const outerColor = tierRank >= 1 && index % 3 === 0 ? gold : pink;
      trail.fillStyle(outerColor, 0.035 + taper * (0.075 + tierRank * 0.045));
      trail.fillPoints([
        new Phaser.Geom.Point(x + Math.cos(a0) * bladeRootRadius, y + Math.sin(a0) * bladeRootRadius),
        new Phaser.Geom.Point(x + Math.cos(a0) * radius, y + Math.sin(a0) * radius),
        new Phaser.Geom.Point(x + Math.cos(a1) * radius, y + Math.sin(a1) * radius),
        new Phaser.Geom.Point(x + Math.cos(a1) * bladeRootRadius, y + Math.sin(a1) * bladeRootRadius),
      ], true);
      trail.lineStyle(0.4 + taper * (3.2 + tierRank * 0.5), outerColor, 0.22 + taper * 0.34);
      trail.beginPath();
      trail.moveTo(x + Math.cos(a0) * bladeCenterRadius, y + Math.sin(a0) * bladeCenterRadius);
      trail.lineTo(x + Math.cos(a1) * bladeCenterRadius, y + Math.sin(a1) * bladeCenterRadius);
      trail.strokePath();
      trail.lineStyle(1 + taper * (10 + tierRank * 2), 0x541025, 0.18 + taper * 0.2);
      trail.beginPath();
      trail.moveTo(x + Math.cos(a0) * radius, y + Math.sin(a0) * radius);
      trail.lineTo(x + Math.cos(a1) * radius, y + Math.sin(a1) * radius);
      trail.strokePath();
      trail.lineStyle(0.5 + taper * (5 + tierRank), outerColor, 0.38 + taper * 0.34);
      trail.beginPath();
      trail.moveTo(x + Math.cos(a0) * radius, y + Math.sin(a0) * radius);
      trail.lineTo(x + Math.cos(a1) * radius, y + Math.sin(a1) * radius);
      trail.strokePath();
      trail.lineStyle(0.35 + taper * 1.6, softPink, 0.66 + taper * 0.28);
      trail.beginPath();
      trail.moveTo(x + Math.cos(a0) * radius, y + Math.sin(a0) * radius);
      trail.lineTo(x + Math.cos(a1) * radius, y + Math.sin(a1) * radius);
      trail.strokePath();
    }
    this.tweens.add({
      targets: trail,
      alpha: 0,
      scale: 1.025,
      duration: 290 + tierRank * 35,
      ease: 'Quad.easeOut',
      onComplete: () => trail.destroy(),
    });
  }

  private playSakuraSpaceCut(
    from: Phaser.Math.Vector2,
    to: Phaser.Math.Vector2,
    pink: number,
    softPink: number,
    gold: number,
    tierRank: number,
    onArrive: () => void,
  ): void {
    const cut = this.add.graphics().setDepth(46).setBlendMode(Phaser.BlendModes.ADD);
    const segments = 14;
    for (let index = 0; index < segments; index += 1) {
      const t0 = index / segments;
      const t1 = (index + 1) / segments;
      const taper = Math.sin(Math.PI * (t0 + t1) * 0.5);
      const x0 = Phaser.Math.Linear(from.x, to.x, t0);
      const y0 = Phaser.Math.Linear(from.y, to.y, t0);
      const x1 = Phaser.Math.Linear(from.x, to.x, t1);
      const y1 = Phaser.Math.Linear(from.y, to.y, t1);
      const outerColor = tierRank >= 2 && index % 4 === 0 ? gold : pink;
      cut.lineStyle(0.4 + taper * (5 + tierRank), outerColor, 0.3 + taper * 0.44);
      cut.beginPath();
      cut.moveTo(x0, y0);
      cut.lineTo(x1, y1);
      cut.strokePath();
      cut.lineStyle(0.3 + taper * 1.5, softPink, 0.72 + taper * 0.24);
      cut.beginPath();
      cut.moveTo(x0, y0);
      cut.lineTo(x1, y1);
      cut.strokePath();
    }
    const duration = tierRank >= 2 ? 72 : 90;
    this.time.delayedCall(duration, onArrive);
    this.tweens.add({
      targets: cut,
      alpha: 0,
      duration: duration + 55,
      ease: 'Cubic.easeOut',
      onComplete: () => cut.destroy(),
    });
  }

  private createSakuraKatanaAfterimage(
    x: number,
    y: number,
    angle: number,
    pink: number,
    gold: number,
    tierRank: number,
    index: number,
    total: number,
  ): void {
    const radians = Phaser.Math.DegToRad(angle);
    const recency = total <= 1 ? 1 : index / (total - 1);
    const afterimage = this.add.image(x + Math.cos(radians) * 22, y + Math.sin(radians) * 22,
      SAKURA_KATANA_TEXTURE_KEY).setOrigin(0.18, 0.5)
      .setDisplaySize(184, 20)
      .setTint(tierRank >= 1 && index % (tierRank >= 2 ? 2 : 4) === 0 ? gold : recency > 0.68 ? 0xffedf7 : pink)
      .setAlpha(0.14 + recency * 0.28 + tierRank * 0.055)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(23)
      .setAngle(angle);
    const targetScaleX = afterimage.scaleX;
    const targetScaleY = afterimage.scaleY;
    this.tweens.add({
      targets: afterimage,
      alpha: 0,
      scaleX: targetScaleX * (0.9 - (1 - recency) * 0.08),
      scaleY: targetScaleY * 0.7,
      delay: 70 + tierRank * 20,
      duration: 330 + tierRank * 35,
      ease: 'Quad.easeOut',
      onComplete: () => afterimage.destroy(),
    });
  }

  private playSakuraCutImpact(
    x: number,
    y: number,
    pink: number,
    softPink: number,
    gold: number,
    tierRank: number,
  ): void {
    const shade = this.add.ellipse(x, y, 156 + tierRank * 18, 128 + tierRank * 14, 0x12060c, 0.2 + tierRank * 0.025)
      .setDepth(29);
    this.tweens.add({
      targets: shade,
      alpha: 0,
      scale: 1.15,
      duration: 260 + tierRank * 30,
      ease: 'Quad.easeOut',
      onComplete: () => shade.destroy(),
    });
    const flash = this.add.ellipse(x, y, 48 + tierRank * 12, 28 + tierRank * 8, 0xffffff, 0.2 + tierRank * 0.04)
      .setDepth(47).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2.5,
      scaleY: 1.7,
      duration: 300 + tierRank * 45,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });
    const count = [20, 34, 52, 68][tierRank];
    for (let index = 0; index < count; index += 1) {
      const angle = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
      const distance = Phaser.Math.Between(34, 82 + tierRank * 25);
      const color = tierRank >= 1 && index % (tierRank >= 2 ? 6 : 9) === 0
        ? gold : index % 7 === 0 ? softPink : pink;
      const particle = index % 4 === 0
        ? this.add.ellipse(x, y, 9 + tierRank * 2, 3, color, 0.94)
        : this.add.circle(x, y, Phaser.Math.Between(2, 5), color, 0.92);
      particle.setDepth(49).setRotation(angle).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance + Phaser.Math.Between(-16, 22),
        alpha: 0,
        scale: 0.18,
        angle: particle.angle + Phaser.Math.Between(-100, 100),
        duration: Phaser.Math.Between(380, 600 + tierRank * 80),
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
    this.playSakuraPetals(x, y, 7 + tierRank * 4, pink, tierRank >= 2);
    if (tierRank > 0) playResonanceBloom(this, { x, y }, pink, tierRank >= 2, true);
  }

  private playSakuraPetals(x: number, y: number, count: number, color: number, strong: boolean): void {
    for (let index = 0; index < count; index += 1) {
      const petal = this.add.ellipse(
        x + Phaser.Math.Between(-18, 18),
        y + Phaser.Math.Between(-18, 18),
        strong ? 10 : 8,
        strong ? 18 : 14,
        color,
        strong ? 0.9 : 0.78,
      ).setDepth(26).setAngle(Phaser.Math.Between(-50, 50));
      const angle = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
      const distance = Phaser.Math.Between(strong ? 48 : 30, strong ? 112 : 76);
      this.tweens.add({
        targets: petal,
        x: petal.x + Math.cos(angle) * distance,
        y: petal.y + Math.sin(angle) * distance - Phaser.Math.Between(6, 28),
        angle: petal.angle + Phaser.Math.Between(-150, 150),
        alpha: 0,
        duration: strong ? 520 : 400,
        ease: 'Sine.easeOut',
        onComplete: () => petal.destroy(),
      });
    }
  }

  private playJadeSwordArray(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, resonance: 'resonance' | 'strong' | undefined, onHit: () => void): void {
    const resonant = resonance !== undefined;
    const strong = resonance === 'strong';
    const jade = 0x65dfbd;
    const gold = 0xf5d66b;
    const center = new Phaser.Math.Vector2(from.x, from.y - 58);
    const ghostOffsets = [
      { x: -60, y: 2, angle: -28 },
      { x: -30, y: -28, angle: -14 },
      { x: 0, y: -42, angle: 0 },
      { x: 30, y: -28, angle: 14 },
      { x: 60, y: 2, angle: 28 },
    ];
    this.sound.play('attackWind', { volume: strong ? 0.68 : 0.54 });
    this.playJadeChargeWind(center.x, center.y, jade, gold, resonant, strong);
    if (resonant) playResonanceGather(this, center, jade, strong);
    const ghosts = ghostOffsets.map((offset, index) => {
      const ghost = this.add.image(center.x + offset.x, center.y + offset.y, JADE_SWORD_TEXTURE_KEY)
        .setDisplaySize(strong ? 45 : 41, strong ? 140 : 124)
        .setAngle(offset.angle)
        .setDepth(23)
        .setAlpha(0)
        .setTint(resonant && (index === 2 || (strong && index % 2 === 0)) ? gold : jade)
        .setBlendMode(Phaser.BlendModes.ADD);
      const targetScaleX = ghost.scaleX;
      const targetScaleY = ghost.scaleY;
      ghost.setScale(targetScaleX * 0.72, targetScaleY * 0.72);
      this.tweens.add({
        targets: ghost,
        alpha: strong ? 0.62 : 0.48,
        scaleX: targetScaleX,
        scaleY: targetScaleY,
        y: ghost.y - 5,
        delay: index * 36,
        duration: 220,
        ease: 'Back.easeOut',
      });
      return ghost;
    });

    const mainSword = this.createJadeSword(center.x, center.y, jade, gold, resonant, strong, 0)
      .setAlpha(0)
      .setScale(0.68);
    this.time.delayedCall(350, () => {
      ghosts.forEach((ghost, index) => {
        const mergeDelay = (2 - Math.abs(index - 2)) * (resonant ? 42 : 66);
        this.tweens.add({
          targets: ghost,
          x: center.x,
          y: center.y,
          angle: 0,
          alpha: 0,
          scaleX: ghost.scaleX * 0.42,
          scaleY: ghost.scaleY * 0.42,
          delay: mergeDelay,
          duration: resonant ? 210 : 250,
          ease: resonant ? 'Expo.easeIn' : 'Cubic.easeIn',
          onComplete: () => {
            this.playJadeMergeParticles(center.x, center.y, jade, gold,
              resonant && (index === 2 || (strong && index % 2 === 0)));
            ghost.destroy();
          },
        });
      });
      this.tweens.add({
        targets: mainSword,
        alpha: 1,
        scale: 1,
        duration: 360,
        ease: 'Back.easeOut',
      });
    });

    this.time.delayedCall(850, () => {
      this.launchMergedJadeSword(mainSword, center, to, jade, gold, resonant, strong, onHit);
    });
  }

  private createJadeSword(
    x: number,
    y: number,
    jade: number,
    gold: number,
    resonant: boolean,
    gilded: boolean,
    angle: number,
  ): Phaser.GameObjects.Container {
    const sword = this.add.container(x, y).setDepth(24).setAngle(angle);
    const aura = this.add.ellipse(0, 0, gilded ? 53 : 47, 151, gilded ? gold : jade, gilded ? 0.16 : 0.11)
      .setBlendMode(Phaser.BlendModes.ADD);
    const core = this.add.image(0, 0, JADE_SWORD_TEXTURE_KEY).setDisplaySize(35, 159);
    const edgeGlow = this.add.image(0, 0, JADE_SWORD_TEXTURE_KEY).setDisplaySize(28, 148)
      .setTint(resonant ? gold : jade)
      .setAlpha(gilded ? 0.32 : 0.16)
      .setBlendMode(Phaser.BlendModes.ADD);
    sword.add([aura, edgeGlow, core]);
    this.tweens.add({
      targets: aura,
      alpha: gilded ? 0.28 : 0.2,
      scaleX: 1.28,
      duration: gilded ? 150 : 220,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return sword;
  }

  private launchMergedJadeSword(
    sword: Phaser.GameObjects.Container,
    from: Phaser.Math.Vector2,
    to: Phaser.Math.Vector2,
    jade: number,
    gold: number,
    resonant: boolean,
    strong: boolean,
    onHit: () => void,
  ): void {
    const direction = to.clone().subtract(from).normalize();
    const angle = Phaser.Math.RadToDeg(Math.atan2(direction.y, direction.x));
    sword.setAngle(angle + 90).setDepth(27);
    const companions = resonant ? Array.from({ length: strong ? 3 : 2 }, (_, index) => {
      return this.add.image(from.x, from.y, JADE_SWORD_TEXTURE_KEY).setDisplaySize(18, 76)
        .setAngle(angle + 90).setTint(index % 2 === 0 ? gold : 0xe5fff7).setAlpha(strong ? 0.5 : 0.35)
        .setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
    }) : [];
    sword.once(Phaser.GameObjects.Events.DESTROY, () => companions.forEach((image) => image.destroy()));
    const progress = { value: 0 };
    let lastTrailAt = -Infinity;
    let lastWindAt = -Infinity;
    let windIndex = 0;
    this.tweens.add({
      targets: progress,
      value: 1,
      duration: strong ? 500 : 440,
      ease: 'Cubic.easeIn',
      onUpdate: () => {
        sword.setPosition(
          Phaser.Math.Linear(from.x, to.x, progress.value),
          Phaser.Math.Linear(from.y, to.y, progress.value),
        );
        companions.forEach((image, index) => {
          const offset = (index - (companions.length - 1) / 2) * 26;
          image.setPosition(sword.x - direction.y * offset - direction.x * 22,
            sword.y + direction.x * offset - direction.y * 22);
        });
        if (this.time.now - lastTrailAt >= (strong ? 28 : 40)) {
          lastTrailAt = this.time.now;
          this.createJadeMeteorTrail(sword.x, sword.y, angle, jade, gold, resonant, strong);
        }
        if (this.time.now - lastWindAt >= (strong ? 46 : 64)) {
          lastWindAt = this.time.now;
          this.createJadeFlightWind(sword.x, sword.y, angle, jade, gold, resonant, strong, windIndex++);
        }
      },
      onComplete: () => {
        onHit();
        this.playSwordImpact(to.x, to.y, jade, gold, resonant, strong);
        if (!resonant) this.cameras.main.shake(130, 0.005);
        sword.destroy(true);
      },
    });
  }

  private playJadeChargeWind(
    x: number,
    y: number,
    jade: number,
    gold: number,
    resonant: boolean,
    strong: boolean,
  ): void {
    const arcCount = strong ? 7 : 5;
    for (let index = 0; index < arcCount; index += 1) {
      const radius = 46 + index * 9;
      const wind = this.add.graphics().setPosition(x, y).setDepth(21).setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.drawJadeWindArc(wind, radius, -0.78, 0.78, index % 2 === 0, strong);
      wind.setAngle(index * (360 / arcCount));
      this.tweens.add({
        targets: wind,
        alpha: { from: 0, to: strong ? 0.72 : 0.54 },
        angle: wind.angle + (index % 2 === 0 ? 210 : -210),
        scale: 0.34,
        duration: 780 + index * 18,
        ease: 'Cubic.easeIn',
        onComplete: () => wind.destroy(),
      });
    }

    const particleCount = strong ? 18 : 12;
    for (let index = 0; index < particleCount; index += 1) {
      const orbit = this.add.container(x, y).setDepth(22).setAngle(Phaser.Math.Between(0, 359));
      const radius = Phaser.Math.Between(54, strong ? 104 : 88);
      const color = resonant && index % (strong ? 4 : 7) === 0 ? gold : jade;
      const particle = this.add.ellipse(radius, 0, Phaser.Math.Between(8, 15), 3, color, 0.72)
        .setBlendMode(Phaser.BlendModes.ADD);
      orbit.add(particle);
      this.tweens.add({
        targets: orbit,
        angle: orbit.angle + (index % 2 === 0 ? 230 : -230),
        duration: Phaser.Math.Between(560, 790),
        delay: index * 18,
        ease: 'Cubic.easeIn',
      });
      this.tweens.add({
        targets: particle,
        x: 0,
        alpha: 0,
        scaleX: 0.25,
        duration: Phaser.Math.Between(560, 790),
        delay: index * 18,
        ease: 'Cubic.easeIn',
        onComplete: () => orbit.destroy(true),
      });
    }
  }

  private createJadeFlightWind(
    x: number,
    y: number,
    angle: number,
    jade: number,
    gold: number,
    resonant: boolean,
    strong: boolean,
    index: number,
  ): void {
    const radians = Phaser.Math.DegToRad(angle);
    const direction = new Phaser.Math.Vector2(Math.cos(radians), Math.sin(radians));
    const normal = new Phaser.Math.Vector2(-direction.y, direction.x);
    const side = index % 2 === 0 ? -1 : 1;
    const offset = side * (strong ? 21 : 15);
    const wind = this.add.graphics()
      .setPosition(x + normal.x * offset, y + normal.y * offset)
      .setDepth(25)
      .setRotation(radians)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.drawJadeWindArc(wind, strong ? 29 : 22, -0.94, 0.94, side < 0, strong);
    this.tweens.add({
      targets: wind,
      x: wind.x - direction.x * (strong ? 62 : 46),
      y: wind.y - direction.y * (strong ? 62 : 46),
      alpha: 0,
      scaleX: 1.55,
      scaleY: 0.72,
      angle: wind.angle + side * 38,
      duration: strong ? 320 : 260,
      ease: 'Quad.easeOut',
      onComplete: () => wind.destroy(),
    });
  }

  private createJadeMeteorTrail(
    x: number,
    y: number,
    angle: number,
    jade: number,
    gold: number,
    resonant: boolean,
    strong: boolean,
  ): void {
    const radians = Phaser.Math.DegToRad(angle);
    const length = strong ? Phaser.Math.Between(112, 160) : resonant ? Phaser.Math.Between(88, 124) : Phaser.Math.Between(62, 96);
    const width = strong ? Phaser.Math.Between(10, 16) : Phaser.Math.Between(7, 11);
    const color = resonant && Phaser.Math.Between(0, strong ? 2 : 7) === 0 ? gold : jade;
    const trail = this.add.rectangle(
      x - Math.cos(radians) * length * 0.5,
      y - Math.sin(radians) * length * 0.5,
      length,
      width,
      color,
      strong ? 0.4 : resonant ? 0.3 : 0.2,
    ).setDepth(22).setAngle(angle).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: trail,
      alpha: 0,
      scaleX: 0.52,
      scaleY: 1.6,
      duration: strong ? 300 : 240,
      ease: 'Quad.easeOut',
      onComplete: () => trail.destroy(),
    });
  }

  private playJadeMergeParticles(x: number, y: number, jade: number, gold: number, gilded: boolean): void {
    for (let index = 0; index < (gilded ? 5 : 3); index += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const particle = this.add.circle(x, y, Phaser.Math.Between(2, 4), gilded && index === 0 ? gold : jade, 0.86)
        .setDepth(25)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * Phaser.Math.Between(18, 42),
        y: y + Math.sin(angle) * Phaser.Math.Between(18, 42),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(220, 360),
        onComplete: () => particle.destroy(),
      });
    }
  }

  private playSwordImpact(x: number, y: number, jade: number, gold: number, resonant: boolean, strong: boolean): void {
    this.playJadeWindImpact(x, y, jade, gold, resonant, strong);
    if (resonant) playResonanceBloom(this, { x, y }, jade, strong);
    const ring = this.add.circle(x, y, strong ? 24 : 18, jade, strong ? 0.18 : 0.14)
      .setDepth(23)
      .setStrokeStyle(strong ? 4 : 3, resonant ? gold : jade, 0.84);
    for (let index = 0; index < (strong ? 44 : 28); index += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(strong ? 54 : 36, strong ? 142 : 104);
      const color = resonant && index % (strong ? 6 : 9) === 0 ? gold : index % 7 === 0 ? 0xe9fff5 : jade;
      const particle = this.add.rectangle(x, y, index % 5 === 0 ? 12 : 5, index % 5 === 0 ? 3 : 5, color, 0.94)
        .setDepth(48)
        .setRotation(angle)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(330, strong ? 620 : 480),
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: strong ? 2.6 : 2.1,
      duration: strong ? 410 : 300,
      ease: 'Quad.easeOut',
      onComplete: () => {
        ring.destroy();
      },
    });
  }

  private playJadeWindImpact(
    x: number,
    y: number,
    jade: number,
    gold: number,
    resonant: boolean,
    strong: boolean,
  ): void {
    const count = strong ? 14 : 9;
    for (let index = 0; index < count; index += 1) {
      const blade = this.add.graphics().setPosition(x, y).setDepth(47)
        .setAngle(index * (360 / count) + Phaser.Math.Between(-12, 12))
        .setBlendMode(Phaser.BlendModes.ADD);
      this.drawJadeWindArc(blade, Phaser.Math.Between(24, 38), -0.74, 0.74, index % 2 === 0, strong);
      const radians = Phaser.Math.DegToRad(blade.angle);
      const distance = Phaser.Math.Between(strong ? 86 : 58, strong ? 152 : 108);
      this.tweens.add({
        targets: blade,
        x: x + Math.cos(radians) * distance,
        y: y + Math.sin(radians) * distance,
        angle: blade.angle + (index % 2 === 0 ? 72 : -72),
        alpha: 0,
        scale: strong ? 1.7 : 1.42,
        duration: Phaser.Math.Between(380, strong ? 680 : 540),
        ease: 'Cubic.easeOut',
        onComplete: () => blade.destroy(),
      });
    }
  }

  private drawJadeWindArc(
    graphics: Phaser.GameObjects.Graphics,
    radius: number,
    startAngle: number,
    endAngle: number,
    clockwise: boolean,
    strong: boolean,
  ): void {
    const segments = 12;
    const direction = clockwise ? -1 : 1;
    const sweep = Math.abs(endAngle - startAngle) * direction;
    const cyan = 0x72f5e3;
    const white = 0xedffff;
    for (let index = 0; index < segments; index += 1) {
      const t0 = index / segments;
      const t1 = (index + 1) / segments;
      const middle = (t0 + t1) * 0.5;
      const taper = Math.sin(Math.PI * middle);
      const angle0 = startAngle + sweep * t0;
      const angle1 = startAngle + sweep * t1;
      const x0 = Math.cos(angle0) * radius;
      const y0 = Math.sin(angle0) * radius;
      const x1 = Math.cos(angle1) * radius;
      const y1 = Math.sin(angle1) * radius;
      const outerWidth = 0.35 + taper * (strong ? 5.4 : 4.1);
      graphics.lineStyle(outerWidth, cyan, (strong ? 0.68 : 0.54) * taper);
      graphics.beginPath();
      graphics.moveTo(x0, y0);
      graphics.lineTo(x1, y1);
      graphics.strokePath();
      graphics.lineStyle(Math.max(0.3, outerWidth * 0.32), white, (strong ? 0.94 : 0.82) * taper);
      graphics.beginPath();
      graphics.moveTo(x0, y0);
      graphics.lineTo(x1, y1);
      graphics.strokePath();
    }
  }

  private applyVisualDamage(event: Extract<BattleCombatPresentationEvent, { type: 'damage' }>, enemy: EnemyState, amount = event.amount): void {
    if (!this.visualHpOverride) {
      return;
    }

    if (event.attacker === 'player') {
      const enemyIndex = this.battle.enemies.indexOf(enemy);
      const hpAfterHit = Math.max(0, this.visualHpOverride.enemies[enemyIndex] - amount);
      this.setEnemyVisualHp(enemyIndex, hpAfterHit);
      return;
    }

    const hpAfterHit = Math.max(0, this.visualHpOverride.player - amount);
    this.visualHpOverride.player = hpAfterHit;
    this.playerSoulStoneMeter?.setHp(hpAfterHit, true);
  }

  private setEnemyVisualHp(enemyIndex: number, hp: number): void {
    const enemy = this.battle.enemies[enemyIndex];
    if (!enemy || !this.visualHpOverride) {
      return;
    }

    this.visualHpOverride.enemies[enemyIndex] = hp;
    this.visualEnemyDefeated![enemyIndex] = hp <= 0;
    this.enemySoulStoneMeters.get(enemy.id)?.setHp(hp, true);
  }

  private combatPositions(enemy: EnemyState): { player: Phaser.Math.Vector2; enemy: Phaser.Math.Vector2 } {
    const enemyIndex = this.battle.enemies.indexOf(enemy);
    const enemySeat = this.enemySeatForIndex(enemyIndex);
    const enemyLayout = this.enemyHudLayout(enemyIndex);
    return {
      enemy: new Phaser.Math.Vector2(enemySeat.x + enemyLayout.portrait.x, enemySeat.y + enemyLayout.portrait.y),
      player: this.playerSeatCenter(),
    };
  }

  private enemySeatForIndex(index: number): { x: number; y: number; width: number; height: number } {
    return this.battle.enemies.length === 1 ? this.battleLayout.seats.enemies[1] : this.battleLayout.seats.enemies[index];
  }

  private playerSeatCenter(): Phaser.Math.Vector2 {
    const seat = this.battleLayout.seats.player;
    const hud = this.battleLayout.playerHud;
    return new Phaser.Math.Vector2(seat.x + hud.portrait.x, seat.y + hud.portrait.y);
  }

  private playerHandEffectCenter(): Phaser.Math.Vector2 {
    const seat = this.battleLayout.seats.player;
    const hud = this.battleLayout.playerHud;
    return new Phaser.Math.Vector2(
      seat.x + this.playerHandCenterX(this.battle.player.hand.length),
      seat.y + hud.hand.y,
    );
  }

  private enemyHandEffectCenter(enemyIndex: number): Phaser.Math.Vector2 {
    const enemy = this.battle.enemies[enemyIndex];
    const seat = this.enemySeatForIndex(enemyIndex);
    const hud = this.enemyHudLayout(enemyIndex);
    return new Phaser.Math.Vector2(
      seat.x + this.enemyHandCenterX(enemyIndex, enemy?.hand.length ?? 0),
      seat.y + hud.hand.y,
    );
  }

  private enemyHudSeat(index: number): keyof BattleLayoutConfig['enemyHud'] {
    if (this.battle.enemies.length === 1 || index === 1) {
      return 'top';
    }

    return index === 0 ? 'left' : 'right';
  }

  private enemyHudLayout(index: number): BattleLayoutConfig['enemyHud']['left'] {
    return this.battleLayout.enemyHud[this.enemyHudSeat(index)];
  }

  private enemyHandCenterX(index: number, cardCount: number): number {
    const hud = this.enemyHudLayout(index);
    const handWidth = cardCount > 0
      ? this.battleLayout.cards.enemyWidth + Math.max(0, cardCount - 1) * this.battleLayout.cards.enemySpacing
      : 0;
    const portraitHalfWidth = hud.portrait.width / 2;
    const gap = 20;

    if (this.enemyHudSeat(index) === 'right') {
      return hud.portrait.x - portraitHalfWidth - gap - handWidth / 2;
    }

    return hud.portrait.x + portraitHalfWidth + gap + handWidth / 2;
  }

  private playerHandCenterX(cardCount: number): number {
    const hud = this.battleLayout.playerHud;
    const handWidth = cardCount > 0
      ? this.battleLayout.cards.width + Math.max(0, cardCount - 1) * this.battleLayout.cards.spacing
      : 0;
    return hud.portrait.x + hud.portrait.width / 2 + hud.handGap + handWidth / 2;
  }

  private playProjectile(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, color: number, label: string, resonantAttack: boolean, onHit: () => void): void {
    let lastTrailAt = 0;
    const projectile = this.add.container(from.x, from.y).setDepth(20);
    projectile.add(this.add.circle(0, 0, 28, color, 0.16));
    projectile.add(this.add.circle(0, 0, 18, color, 0.34));
    projectile.add(this.add.circle(0, 0, 9, 0xffffff, 0.92));
    const rune = this.add.text(0, 0, label.slice(0, 2), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '13px',
      color: this.currentUIColors().text,
    }).setOrigin(0.5);
    rune.setShadow(0, 0, '#ffffff', 8, true, true);
    projectile.add(rune);

    this.sound.play(resonantAttack ? 'attackWind' : 'attackFire', { volume: resonantAttack ? 0.48 : 0.45 });
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

  private playEnemyAttackProjectile(
    enemy: EnemyState,
    from: Phaser.Math.Vector2,
    to: Phaser.Math.Vector2,
    resonance: ScoreResult['resonance'] | undefined,
    iaijutsu: boolean,
    onHit: () => void,
    onComplete: () => void = () => undefined,
  ): void {
    const feedback = this.createResonanceImpactFeedback(to, resonance, onHit, onComplete);
    onHit = feedback.hit;
    onComplete = feedback.complete;
    const playedEdoAttack = playEdoEnemyAttackEffect(this, {
      enemyId: enemy.id,
      from,
      to,
      resonance,
      iaijutsu,
      onHit,
      onComplete,
    });
    if (playedEdoAttack) {
      return;
    }

    const playedDragonGateAttack = playDragonGateEnemyAttackEffect(this, {
      enemyId: enemy.id,
      from,
      to,
      resonance,
      onHit,
      onComplete,
    });
    if (playedDragonGateAttack) {
      return;
    }

    const playedNorthernAttack = playNorthernEnemyAttackEffect(this, {
      enemyId: enemy.id,
      from,
      to,
      resonance,
      onHit,
      onComplete,
    });
    if (playedNorthernAttack) {
      return;
    }

    const playedThemedAttack = playEvernightEnemyAttackEffect(this, {
      enemyId: enemy.id,
      from,
      to,
      resonance,
      onHit,
      onComplete,
    });
    if (playedThemedAttack) {
      return;
    }

    this.playProjectile(
      from,
      to,
      SKILL_COLORS[enemy.id],
      enemyName(enemy.id),
      resonance !== undefined && resonance !== 'none',
      () => {
        onHit();
        this.time.delayedCall(240, onComplete);
      },
    );
  }

  private playClashAnimation(playerPosition: Phaser.Math.Vector2, enemyPosition: Phaser.Math.Vector2, enemy: EnemyState): void {
    const midpoint = new Phaser.Math.Vector2((playerPosition.x + enemyPosition.x) / 2, (playerPosition.y + enemyPosition.y) / 2);
    let playerArrived = false;
    let enemyArrived = false;
    let clashResolved = false;
    const resolveClash = () => {
      if (!playerArrived || !enemyArrived || clashResolved) {
        return;
      }
      clashResolved = true;
      this.playImpactBurst(midpoint.x, midpoint.y, 0xffffff);
      this.playClashText(midpoint.x, midpoint.y - 34);
    };
    const onPlayerArrive = () => {
      playerArrived = true;
      resolveClash();
    };
    const onEnemyArrive = () => {
      enemyArrived = true;
      resolveClash();
    };

    this.playEquippedPlayerAttackEffect(
      playerPosition,
      midpoint,
      'none',
      0,
      onPlayerArrive,
      () => undefined,
    );
    this.playEnemyAttackProjectile(enemy, enemyPosition, midpoint, 'none', false, onEnemyArrive, () => {
      const enemyIndex = this.battle.enemies.indexOf(enemy);
      if (
        enemyIndex >= 0
        && (
          enemy.id === 'viking_warrior'
          || enemy.id === 'rune_shaman'
          || enemy.id === 'valkyrie'
          || enemy.id === 'einherjar'
          || enemy.id === 'swordsman'
          || enemy.id === 'songstress'
          || enemy.id === 'taoist'
          || enemy.id === 'shogun_samurai'
          || enemy.id === 'ninja'
          || enemy.id === 'oiran'
        )
      ) {
        this.setEnemyPortraitPose(enemyIndex, 'idle');
      }
    });
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

  private playCrimsonHitSplash(
    from: Phaser.Math.Vector2,
    to: Phaser.Math.Vector2,
    resonance: ScoreResult['resonance'] | undefined,
    damage: number,
  ): void {
    const baseAngle = Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y);
    const boom = resonance === 'boom';
    const strong = resonance === 'strong' || boom;
    const resonant = resonance !== undefined && resonance !== 'none';
    const count = strong ? 12 : resonant ? 9 : Phaser.Math.Clamp(5 + damage, 6, 8);
    const colors = [0x7a1018, 0xb51f2e, 0xe0444f, 0x5a0b12];

    for (let index = 0; index < count; index += 1) {
      const spreadAngle = baseAngle + Phaser.Math.FloatBetween(-0.72, 0.72);
      const distance = Phaser.Math.Between(strong ? 58 : 38, strong ? 112 : resonant ? 88 : 70);
      const width = Phaser.Math.Between(strong ? 7 : 5, strong ? 14 : 10);
      const height = Phaser.Math.Between(2, strong ? 6 : 4);
      const droplet = this.add.ellipse(
        to.x + Phaser.Math.Between(-8, 8),
        to.y + Phaser.Math.Between(-7, 7),
        width,
        height,
        colors[index % colors.length],
        strong ? 0.94 : 0.82,
      ).setRotation(spreadAngle).setDepth(46);
      this.tweens.add({
        targets: droplet,
        x: droplet.x + Math.cos(spreadAngle) * distance,
        y: droplet.y + Math.sin(spreadAngle) * distance + Phaser.Math.Between(4, 18),
        scaleX: Phaser.Math.FloatBetween(0.35, 0.7),
        scaleY: Phaser.Math.FloatBetween(0.2, 0.55),
        alpha: 0,
        duration: Phaser.Math.Between(360, strong ? 620 : 520),
        ease: 'Quad.easeOut',
        onComplete: () => droplet.destroy(),
      });
    }
  }

  private playDamageText(
    x: number,
    y: number,
    amount: number,
    resonance?: ScoreResult['resonance'],
  ): void {
    const boom = resonance === 'boom';
    const strong = resonance === 'strong' || boom;
    const resonant = resonance !== undefined && resonance !== 'none';
    const textColor = boom ? '#ffd36a' : strong ? '#fff0a6' : resonant ? '#ffd86b' : '#ff9a92';
    const glowColor = boom ? '#ff3b24' : strong ? '#ffd34d' : resonant ? '#ffb52e' : '#ef3348';
    const text = this.add.text(x, y, `-${amount} HP`, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: boom ? '44px' : strong ? '40px' : resonant ? '35px' : '30px',
      color: textColor,
      stroke: '#35070b',
      strokeThickness: 6,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(75).setScale(strong ? 0.6 : 0.74);
    text.setData('statusFloatingText', true);
    text.setShadow(0, 3, glowColor, strong ? 18 : resonant ? 15 : 12, true, true);

    this.tweens.add({
      targets: text,
      scaleX: strong ? 1.42 : resonant ? 1.28 : 1.16,
      scaleY: strong ? 1.42 : resonant ? 1.28 : 1.16,
      duration: 120,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!text.active) {
          return;
        }
        this.tweens.add({
          targets: text,
          scaleX: 1,
          scaleY: 1,
          duration: 100,
          ease: 'Sine.easeOut',
        });
      },
    });

    this.tweens.add({
      targets: text,
      y: y - (strong ? 66 : resonant ? 56 : 48),
      alpha: 0,
      delay: strong ? 300 : resonant ? 220 : 150,
      duration: strong ? 950 : 780,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private playStatusGainText(anchor: { x: number; y: number }, kind: 'attack' | 'heal' | 'risk' | 'shield', amount: number): void {
    this.playStatusFloatingText(anchor.x, anchor.y - 86, kind, amount);
  }

  private playHealGainText(x: number, y: number, amount: number, _depth = 21): void {
    this.playStatusFloatingText(x, y, 'heal', amount);
  }

  private playStatusFloatingText(x: number, y: number, kind: 'attack' | 'heal' | 'risk' | 'shield', amount: number): void {
    if (amount <= 0) return;
    const color = { attack: '#ffab62', heal: '#8ff0a4', risk: '#ec83d8', shield: '#85dcff' }[kind];
    // Keep live floating text through UI refreshes; stagger simultaneous gains at the same seat.
    const overlapping = this.children.getChildren().filter((item) => item.getData('statusFloatingText')
      && Math.abs(item.getData('statusAnchorX') - x) < 60
      && Math.abs(item.getData('statusAnchorY') - y) < 60).length;
    const startY = y - overlapping * 32;
    const text = this.add.text(x, startY, t(`battle.floating.${kind}`, { amount }), {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '30px',
      color,
      stroke: '#101114',
      strokeThickness: 6,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(75).setScale(0.78);
    text.setData({ statusFloatingText: true, statusAnchorX: x, statusAnchorY: y });
    text.setShadow(0, 0, color, 12, true, true);
    this.tweens.add({ targets: text, scale: 1.12, duration: 120, yoyo: true, ease: 'Sine.easeOut' });
    this.tweens.add({
      targets: text, y: startY - 52, alpha: 0, delay: 220, duration: 900,
      ease: 'Cubic.easeOut', onComplete: () => text.destroy(),
    });
  }

  private playClashText(x: number, y: number): void {
    const text = this.add.text(x, y, t('battle.clashText'), {
      fontFamily: GAME_FONT_FAMILY,
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

  private shakeSeat(id: string, intensity = 9): void {
    const container = this.seatContainers.get(id);
    if (!container) {
      return;
    }

    const startX = container.x;
    this.tweens.add({
      targets: container,
      x: startX + intensity,
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

    if (this.dealing || this.actionDealing) {
      const enemyIndex = this.battle.enemies.indexOf(enemy);
      const visibleCount = Math.min(this.dealtEnemyCards[enemyIndex] ?? 0, enemy.hand.length);
      return enemy.hand.slice(0, visibleCount).map((card, index) => (index === 0 ? formatCard(card) : '??')).join(' ');
    }

    if (enemy.revealed || (this.battle.roundRevealed && this.battle.results.some((result) => result.enemy === enemy))) {
      return enemy.hand.map(formatCard).join(' ');
    }

    return [formatCard(enemy.hand[0]), ...enemy.hand.slice(1).map(() => '??')].join(' ');
  }

  private playerCardsText(): string {
    if (this.dealing || this.actionDealing) {
      return this.battle.player.hand.slice(0, this.dealtPlayerCards).map(() => '??').join(' ');
    }

    if (this.playerRedealing) {
      return this.battle.player.hand.slice(0, this.dealtPlayerCards).map(formatCard).join(' ');
    }

    if (this.battle.phase === 'choice') {
      return this.battle.player.hand.map(() => '??').join(' ');
    }

    if (this.battle.player.fateMode && !this.battle.roundRevealed) {
      return this.battle.player.hand.map(() => '??').join(' ');
    }

    return this.battle.player.hand.map(formatCard).join(' ');
  }

  private phaseText(uiState: BattleUIState = this.createUIState()): string {
    const params = { ...(uiState.center.phaseTextParams ?? {}) };
    if (uiState.center.phaseRiskTextKey) {
      params.risk = t(uiState.center.phaseRiskTextKey);
    }

    return t(uiState.center.phaseTextKey, params);
  }

  private scoreEnemy(enemy: EnemyState) {
    return this.battle.results.find((result) => result.enemy === enemy)?.enemyScore ?? scoreHand(enemy.hand);
  }

  private shouldShowEnemyScore(enemy: EnemyState): boolean {
    if (this.dealing || this.actionDealing) {
      const enemyIndex = this.battle.enemies.indexOf(enemy);
      const visibleCount = Math.min(this.dealtEnemyCards[enemyIndex] ?? 0, enemy.hand.length);
      if (visibleCount < enemy.hand.length) {
        return false;
      }
    }

    return !(this.revealFocusPlaying && this.revealFocusPendingEnemyIds.has(enemy.id))
      && (enemy.revealed || this.battle.roundRevealed)
      && this.battle.results.some((result) => result.enemy === enemy);
  }

  private isResultPhase(): boolean {
    return this.battle.phase === 'round-result' || this.battle.phase === 'battle-result';
  }
}
