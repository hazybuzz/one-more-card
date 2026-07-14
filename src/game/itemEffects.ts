import { Battle } from './battle';
import { formatCard } from './card';
import { ItemId } from './items';
import { t } from './i18n';

export interface ItemUseResult {
  used: boolean;
  message: string;
  healed?: number;
  revealAfterFeedback?: boolean;
  feedback?: {
    title: string;
    message: string;
    success: boolean;
  };
}

export function useBattleItem(itemId: ItemId, battle: Battle): ItemUseResult {
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

  if (itemId === 'cooling_charm') {
    const cards = battle.rerollPlayerHandByFate();
    const message = t('itemEffect.fateReroll.used', { cards: cards.map(formatCard).join(' ') });
    battle.addLog(message);
    return { used: true, message };
  }

  return { used: false, message: t('itemEffect.unavailablePhase') };
}
