import { MOBILE_BATTLE_LAYOUT_BLUEPRINT } from './mobileLayout';
import { PC_BATTLE_LAYOUT } from './pcLayout';
import type { BattleLayoutConfig } from './types';

export interface BattleLayoutRequest {
  width: number;
  height: number;
  target?: 'auto' | 'pc' | 'mobile';
}

export function resolveBattleLayout(request: BattleLayoutRequest): BattleLayoutConfig {
  const requestsMobile = request.target === 'mobile'
    || (request.target === 'auto' && request.height > request.width);

  if (requestsMobile && MOBILE_BATTLE_LAYOUT_BLUEPRINT.implemented) {
    // The mobile blueprint intentionally cannot resolve until its anchors are implemented and tested.
    return PC_BATTLE_LAYOUT;
  }

  return PC_BATTLE_LAYOUT;
}
