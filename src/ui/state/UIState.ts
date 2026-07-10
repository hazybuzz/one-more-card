import type { BattleAction } from '../../game/engine';
import type { BattleState } from '../../game/engine';
import type { ItemId } from '../../game/types/item';
import type { BattleActionId, BattleMechanicId } from '../../game/types/level';

export type SkillSlotId = 'shift' | 'summon';

export interface BattleUIRuntimeFlags {
  dealing: boolean;
  playerRedealing: boolean;
  actionDealing: boolean;
  stageBannerPlaying: boolean;
  actionAnimationPlaying: boolean;
  ownedItemCount: number;
}

export interface BattleActionButtonState {
  id: 'view-hand' | 'invite-one' | 'compare' | 'player-draw' | 'player-stand';
  action: BattleAction;
  enabled: boolean;
  danger?: boolean;
  labelKey: string;
  width: number;
  x: number;
}

export interface SkillSlotState {
  id: SkillSlotId;
  enabled: boolean;
  cooldown: number;
  titleKey: string;
  tooltipKey: string;
  icon: string;
}

export interface ItemButtonState {
  enabled: boolean;
}

export interface BattleCenterUIState {
  phaseTextKey: string;
  phaseTextParams?: Record<string, string | number>;
  phaseRiskTextKey?: string;
  currentTargetId?: string;
}

export interface BattleUIState {
  inputLocked: boolean;
  center: BattleCenterUIState;
  actionButtons: BattleActionButtonState[];
  skills: Record<SkillSlotId, SkillSlotState>;
  itemButton: ItemButtonState;
  autoAdvanceRound: boolean;
}

export function createBattleUIState(state: BattleState, flags: BattleUIRuntimeFlags): BattleUIState {
  const inputLocked = flags.dealing
    || flags.playerRedealing
    || flags.actionDealing
    || flags.stageBannerPlaying
    || flags.actionAnimationPlaying;
  const currentEnemy = state.currentEnemyId
    ? state.enemies.find((enemy) => enemy.id === state.currentEnemyId)
    : undefined;

  return {
    inputLocked,
    center: createCenterState(state),
    actionButtons: inputLocked ? [] : createActionButtons(state, currentEnemy?.invited),
    skills: {
      shift: createShiftSkillState(state, inputLocked),
      summon: createSummonSkillState(state, inputLocked),
    },
    itemButton: {
      enabled: hasMechanic(state, 'items') && flags.ownedItemCount > 0 && !inputLocked,
    },
    autoAdvanceRound: !inputLocked && state.phase === 'round-result',
  };
}

export function canUseBattleItemFromState(itemId: ItemId, state: BattleState): boolean {
  if (!hasMechanic(state, 'items')) {
    return false;
  }

  if (itemId === 'heal_potion' || itemId === 'resonance_dust') {
    return state.phase === 'choice';
  }

  if (itemId === 'cooling_charm') {
    return state.phase === 'player-turn';
  }

  return false;
}

function createCenterState(state: BattleState): BattleCenterUIState {
  if (state.phase === 'player-turn') {
    return {
      phaseTextKey: 'battle.phase.playerTurn',
      phaseTextParams: {
        remaining: Math.max(0, state.maxPlayerDrawsThisRound - state.player.drawCountThisRound),
      },
      phaseRiskTextKey: state.player.incomingDamageBonus > 0 ? 'battle.phase.playerRiskActive' : 'battle.phase.playerRiskPending',
      currentTargetId: state.currentEnemyId,
    };
  }

  return {
    phaseTextKey: phaseTextKey(state),
    currentTargetId: state.currentEnemyId,
  };
}

function createActionButtons(state: BattleState, currentEnemyInvited?: boolean): BattleActionButtonState[] {
  if (state.phase === 'choice') {
    if (!canUseAction(state, 'view_hand')) {
      return [];
    }

    return [{
      id: 'view-hand',
      action: { type: 'choose-view-hand' },
      enabled: true,
      labelKey: 'battle.button.viewHand',
      width: 190,
      x: 0,
    }];
  }

  if (state.phase === 'enemy-turn') {
    const buttons: BattleActionButtonState[] = [];
    const showInvite = hasMechanic(state, 'invite') && canUseAction(state, 'invite') && currentEnemyInvited === undefined;
    if (showInvite) {
      buttons.push({
        id: 'invite-one',
        action: { type: 'invite-current-enemy' },
        enabled: true,
        labelKey: 'battle.button.inviteOne',
        width: 190,
        x: 0,
      });
    }

    if (canUseAction(state, 'compare')) {
      buttons.push({
        id: 'compare',
        action: { type: 'compare-current-enemy' },
        enabled: true,
        labelKey: 'battle.button.compare',
        width: 170,
        x: showInvite ? 210 : 0,
      });
    }
    return buttons;
  }

  if (state.phase === 'player-turn') {
    const buttons: BattleActionButtonState[] = [];
    const showPlayerDraw = hasMechanic(state, 'player_draw')
      && canUseAction(state, 'player_draw')
      && !state.player.drawLocked
      && state.player.drawCountThisRound < state.maxPlayerDrawsThisRound;
    if (showPlayerDraw) {
      const isSecondDraw = state.player.drawCountThisRound === 1;
      buttons.push({
        id: 'player-draw',
        action: { type: 'player-draw' },
        enabled: true,
        danger: isSecondDraw,
        labelKey: isSecondDraw ? 'battle.button.drawRisk' : 'battle.button.draw',
        width: isSecondDraw ? 236 : 200,
        x: 0,
      });
    }

    if (canUseAction(state, 'reveal')) {
      buttons.push({
        id: 'player-stand',
        action: { type: 'player-stand' },
        enabled: true,
        labelKey: 'battle.button.stand',
        width: 180,
        x: showPlayerDraw ? 256 : 0,
      });
    }
    return buttons;
  }

  return [];
}

function canUseAction(state: BattleState, action: BattleActionId): boolean {
  return !state.availableActions || state.availableActions.includes(action);
}

function createShiftSkillState(state: BattleState, inputLocked: boolean): SkillSlotState {
  const cooldown = state.player.resonanceShiftCooldown;
  const canShift = state.phase === 'player-turn'
    && hasMechanic(state, 'skills')
    && !inputLocked
    && state.player.canUseResonanceShift;
  return {
    id: 'shift',
    enabled: canShift,
    cooldown,
    titleKey: 'skill.resonanceShift.name',
    tooltipKey: cooldown > 0 ? 'skill.cooldown.tooltip' : 'skill.resonanceShift.tooltip',
    icon: '◇',
  };
}

function createSummonSkillState(state: BattleState, inputLocked: boolean): SkillSlotState {
  const cooldown = state.player.resonanceSummonCooldown;
  const canSummon = state.phase === 'player-turn'
    && hasMechanic(state, 'skills')
    && !inputLocked
    && state.player.canUseResonanceSummon;
  return {
    id: 'summon',
    enabled: canSummon,
    cooldown,
    titleKey: 'skill.resonanceSummon.name',
    tooltipKey: cooldown > 0 ? 'skill.cooldown.tooltip' : 'skill.resonanceSummon.tooltip',
    icon: '✦',
  };
}

function phaseTextKey(state: BattleState): string {
  if (state.phase === 'choice') {
    if (!hasMechanic(state, 'invite')) {
      return 'battle.phase.tutorialChoice';
    }

    return 'battle.phase.choice';
  }

  if (state.phase === 'enemy-turn') {
    if (!hasMechanic(state, 'invite')) {
      return 'battle.phase.tutorialCompare';
    }

    return 'battle.phase.enemyTurn';
  }

  if (state.phase === 'round-result') {
    return 'battle.phase.roundResult';
  }

  return state.battleOutcome === 'victory' ? 'battle.phase.victory' : 'battle.phase.defeat';
}

function hasMechanic(state: BattleState, mechanic: BattleMechanicId): boolean {
  if (!state.levelConfig) {
    return true;
  }

  return state.levelConfig.unlockedMechanics.includes(mechanic);
}
