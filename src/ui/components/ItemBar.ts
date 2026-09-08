import Phaser from 'phaser';
import { getBattleIconArt } from '../art';
import { AbilitySlot } from './AbilitySlot';

interface ItemBarOptions {
  x: number;
  y: number;
  enabled: boolean;
  label: string;
  colors: {
    accent: number;
    accentText: string;
    line: number;
    muted: string;
    panelEnabled: number;
    panelDisabled: number;
    panelHover: number;
    text: string;
  };
  badge?: string;
  onShowTooltip?: () => void;
  onHideTooltip?: () => void;
  onOpen: () => void;
}

export class ItemBar {
  static render(scene: Phaser.Scene, options: ItemBarOptions): Phaser.GameObjects.Container {
    return new AbilitySlot(scene, {
      x: options.x,
      y: options.y,
      icon: '□',
      iconTextureKey: getBattleIconArt('inventory-bag').textureKey,
      variant: 'item',
      color: 0x69c98b,
      textColor: options.colors.accentText,
      enabled: options.enabled,
      badge: options.badge,
      badgeColor: 0x23884d,
      badgeStrokeColor: 0x78d18a,
      badgeTextColor: '#eaffef',
      backgroundColor: options.colors.panelEnabled,
      disabledBackgroundColor: options.colors.panelDisabled,
      hoverBackgroundColor: options.colors.panelHover,
      onShowTooltip: options.onShowTooltip,
      onHideTooltip: options.onHideTooltip,
      onActivate: options.onOpen,
    }).container;
  }
}
