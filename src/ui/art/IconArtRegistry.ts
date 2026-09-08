import Phaser from 'phaser';

export type BattleIconId =
  | 'resonance-shift'
  | 'resonance-summon'
  | 'inventory-bag'
  | 'fate-beer'
  | 'fate-reroll'
  | 'resonance-horn'
  | 'holy-shield'
  | 'soul-redeem'
  | 'goblin-instinct'
  | 'gambler-blessing'
  | 'werewolf-lifesteal'
  | 'war-horn'
  | 'rune-blessing'
  | 'einherjar-summon'
  | 'chivalry'
  | 'red-silk-toast'
  | 'heavenly-insight'
  | 'status-attack-bonus'
  | 'status-incoming-damage'
  | 'status-holy-shield'
  | 'status-iaijutsu'
  | 'status-hanami-fan'
  | 'status-smoke-evasion';

export interface BattleIconArt {
  id: BattleIconId;
  textureKey: string;
  path: string;
  pixelArt: boolean;
}

export const ABILITY_SLOT_ART = {
  textureKey: 'ui-common-ability-slot',
  path: '/image/ui/common/ability-slot.png',
} as const;

export const SOUL_STONE_ART = {
  textureKey: 'ui-common-soul-stone',
  path: '/image/ui/common/soul-stone.png',
  pixelArt: true,
} as const;

export const SCORE_BADGE_ART = {
  textureKey: 'ui-common-score-badge',
  path: '/image/ui/common/score-badge.png',
} as const;

export const ITEM_CARD_FRAME_ART = {
  textureKey: 'ui-common-item-card-frame',
  path: '/image/ui/common/item-card-frame.png',
} as const;

const BATTLE_ICON_ART: Record<BattleIconId, BattleIconArt> = {
  'resonance-shift': {
    id: 'resonance-shift',
    textureKey: 'icon-skill-resonance-shift',
    path: '/image/icons/skills/resonance-shift.png',
    pixelArt: true,
  },
  'resonance-summon': {
    id: 'resonance-summon',
    textureKey: 'icon-skill-resonance-summon',
    path: '/image/icons/skills/resonance-summon.png',
    pixelArt: true,
  },
  'inventory-bag': {
    id: 'inventory-bag',
    textureKey: 'icon-item-inventory-bag',
    path: '/image/icons/items/inventory-bag.png',
    pixelArt: true,
  },
  'fate-beer': {
    id: 'fate-beer',
    textureKey: 'icon-item-fate-beer',
    path: '/image/icons/items/fate-beer.png',
    pixelArt: true,
  },
  'fate-reroll': {
    id: 'fate-reroll',
    textureKey: 'icon-item-fate-reroll',
    path: '/image/icons/items/fate-reroll.png',
    pixelArt: true,
  },
  'resonance-horn': {
    id: 'resonance-horn',
    textureKey: 'icon-item-resonance-horn',
    path: '/image/icons/items/resonance-horn.png',
    pixelArt: true,
  },
  'holy-shield': {
    id: 'holy-shield',
    textureKey: 'icon-item-holy-shield',
    path: '/image/icons/items/holy-shield.png',
    pixelArt: true,
  },
  'soul-redeem': {
    id: 'soul-redeem',
    textureKey: 'icon-passive-soul-redeem',
    path: '/image/icons/passives/soul-redeem.png',
    pixelArt: true,
  },
  'goblin-instinct': {
    id: 'goblin-instinct',
    textureKey: 'icon-passive-goblin-instinct',
    path: '/image/icons/passives/goblin-instinct.png',
    pixelArt: true,
  },
  'gambler-blessing': {
    id: 'gambler-blessing',
    textureKey: 'icon-passive-gambler-blessing',
    path: '/image/icons/passives/gambler-blessing.png',
    pixelArt: true,
  },
  'werewolf-lifesteal': {
    id: 'werewolf-lifesteal',
    textureKey: 'icon-passive-werewolf-lifesteal',
    path: '/image/icons/passives/werewolf-lifesteal.png',
    pixelArt: true,
  },
  'war-horn': {
    id: 'war-horn',
    textureKey: 'icon-passive-war-horn',
    path: '/image/icons/passives/war-horn.png',
    pixelArt: true,
  },
  'rune-blessing': {
    id: 'rune-blessing',
    textureKey: 'icon-passive-rune-blessing',
    path: '/image/icons/passives/rune-blessing.png',
    pixelArt: true,
  },
  'einherjar-summon': {
    id: 'einherjar-summon',
    textureKey: 'icon-passive-einherjar-summon',
    path: '/image/icons/passives/einherjar-summon.png',
    pixelArt: true,
  },
  'chivalry': {
    id: 'chivalry',
    textureKey: 'icon-passive-chivalry',
    path: '/image/icons/passives/chivalry.png',
    pixelArt: true,
  },
  'red-silk-toast': {
    id: 'red-silk-toast',
    textureKey: 'icon-passive-red-silk-toast',
    path: '/image/icons/passives/red-silk-toast.png',
    pixelArt: true,
  },
  'heavenly-insight': {
    id: 'heavenly-insight',
    textureKey: 'icon-passive-heavenly-insight',
    path: '/image/icons/passives/heavenly-insight.png',
    pixelArt: true,
  },
  'status-attack-bonus': {
    id: 'status-attack-bonus',
    textureKey: 'icon-status-attack-bonus',
    path: '/image/icons/status/attack-bonus.png',
    pixelArt: true,
  },
  'status-incoming-damage': {
    id: 'status-incoming-damage',
    textureKey: 'icon-status-incoming-damage',
    path: '/image/icons/status/incoming-damage.png',
    pixelArt: true,
  },
  'status-holy-shield': {
    id: 'status-holy-shield',
    textureKey: 'icon-status-holy-shield',
    path: '/image/icons/status/holy-shield.png',
    pixelArt: true,
  },
  'status-iaijutsu': {
    id: 'status-iaijutsu',
    textureKey: 'icon-status-iaijutsu',
    path: '/image/icons/status/iaijutsu.png',
    pixelArt: true,
  },
  'status-hanami-fan': {
    id: 'status-hanami-fan',
    textureKey: 'icon-status-hanami-fan',
    path: '/image/icons/status/hanami-fan.png',
    pixelArt: true,
  },
  'status-smoke-evasion': {
    id: 'status-smoke-evasion',
    textureKey: 'icon-status-smoke-evasion',
    path: '/image/icons/status/smoke-evasion.png',
    pixelArt: true,
  },
};

export function getBattleIconArt(id: BattleIconId): BattleIconArt {
  return BATTLE_ICON_ART[id];
}

export function getBattleIconArtByResourceKey(resourceKey?: string): BattleIconArt | undefined {
  const iconIdByResourceKey: Partial<Record<string, BattleIconId>> = {
    item_fate_beer: 'fate-beer',
    item_fate_reroll: 'fate-reroll',
    item_resonance_horn: 'resonance-horn',
    item_holy_shield: 'holy-shield',
  };
  const iconId = resourceKey ? iconIdByResourceKey[resourceKey] : undefined;
  return iconId ? BATTLE_ICON_ART[iconId] : undefined;
}

export function preloadBattleIcons(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ABILITY_SLOT_ART.textureKey)) {
    scene.load.image(ABILITY_SLOT_ART.textureKey, ABILITY_SLOT_ART.path);
  }
  if (!scene.textures.exists(SOUL_STONE_ART.textureKey)) {
    scene.load.image(SOUL_STONE_ART.textureKey, SOUL_STONE_ART.path);
  }
  if (!scene.textures.exists(SCORE_BADGE_ART.textureKey)) {
    scene.load.image(SCORE_BADGE_ART.textureKey, SCORE_BADGE_ART.path);
  }
  if (!scene.textures.exists(ITEM_CARD_FRAME_ART.textureKey)) {
    scene.load.image(ITEM_CARD_FRAME_ART.textureKey, ITEM_CARD_FRAME_ART.path);
  }
  Object.values(BATTLE_ICON_ART).forEach((icon) => {
    if (!scene.textures.exists(icon.textureKey)) {
      scene.load.image(icon.textureKey, icon.path);
    }
  });
}

export function configureBattleIconTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(SOUL_STONE_ART.textureKey)) {
    scene.textures.get(SOUL_STONE_ART.textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  Object.values(BATTLE_ICON_ART).forEach((icon) => {
    if (icon.pixelArt && scene.textures.exists(icon.textureKey)) {
      scene.textures.get(icon.textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  });
}
