import { Battle } from './battle';
import { formatCard } from './card';
import { ItemId } from './items';
import { t } from './i18n';

export interface ItemUseResult {
  used: boolean;
  message: string;
  healed?: number;
  shieldCharges?: number;
  revealAfterFeedback?: boolean;
  feedback?: {
    title: string;
    message: string;
    success: boolean;
  };
}

export function useBattleItem(itemId: ItemId, battle: Battle): ItemUseResult {
  if (battle.mode === 'endless') {
    try { return battle.endlessTransaction(() => useEndlessItem(itemId, battle)); }
    catch { return { used: false, message: t('endless.save.storage-unavailable') }; }
  }
  return applyBattleItemEffect(itemId, battle);
}

function useEndlessItem(itemId: ItemId, battle: Battle): ItemUseResult {
    const shop = battle.endlessLedger!.shop;
    if (shop.isOpen || battle.pendingSoulRedeem || battle.pendingEnemySoulRedeem || battle.battleOutcome
      || !(shop.ownedItems[itemId]! > 0)) return { used: false, message: t('endless.items.unavailable') };
    const result = applyBattleItemEffect(itemId, battle);
    if (result.used) { shop.consume(itemId); if (result.revealAfterFeedback) battle.pendingItemReveal = true; }
    return result;
}

function applyBattleItemEffect(itemId: ItemId, battle: Battle): ItemUseResult {
  battle.clearDamageEvents();

  if (itemId === 'heal_potion') {
    if (battle.phase !== 'choice') {
      return { used: false, message: t('itemEffect.healPotion.choiceOnly') };
    }

    const healed = battle.healPlayer(3);
    if (healed <= 0) {
      return { used: false, message: t('itemEffect.healPotion.fullHp') };
    }

    const message = t('itemEffect.healPotion.used', { amount: healed });
    battle.addLog(message);
    return { used: true, message, healed, revealAfterFeedback: true };
  }

  if (itemId === 'resonance_dust') {
    if (battle.phase !== 'choice') {
      return { used: false, message: t('itemEffect.resonanceHorn.choiceOnly') };
    }

    const result = battle.useResonanceHorn();
    return {
      used: true,
      message: t('itemEffect.resonanceHorn.usedSuccess'),
      feedback: {
        title: t('itemEffect.resonanceHorn.feedbackTitle'),
        message: t('itemEffect.resonanceHorn.feedbackSuccess'),
        success: result.success,
      },
    };
  }

  if (battle.phase !== 'player-turn') {
    return { used: false, message: t('itemEffect.unavailablePhase') };
  }

  if (itemId === 'resonance_dice') {
    if (battle.playerScore().resonance === 'none') return { used: false, message: t('itemEffect.resonanceDice.requiresResonance') };
    const before = battle.playerScore().point;
    if (!battle.rerollPlayerResonance()) return { used: false, message: t('itemEffect.unavailablePhase') };
    return { used: true, message: t('itemEffect.resonanceDice.used', { before, after: battle.playerScore().point }) };
  }

  if (itemId === 'cooling_charm') {
    const cards = battle.rerollPlayerHandByFate();
    const message = t('itemEffect.fateReroll.used', { cards: cards.map(formatCard).join(' ') });
    battle.addLog(message);
    return { used: true, message };
  }

  if (itemId === 'holy_shield') {
    if (battle.player.shieldCharges > 0) {
      return { used: false, message: t('itemEffect.holyShield.active') };
    }

    if (!battle.activateHolyShield()) {
      return { used: false, message: t('itemEffect.unavailablePhase') };
    }

    return {
      used: true,
      message: t('itemEffect.holyShield.used', { charges: battle.player.shieldCharges }),
      shieldCharges: battle.player.shieldCharges,
    };
  }

  return { used: false, message: t('itemEffect.unavailablePhase') };
}
