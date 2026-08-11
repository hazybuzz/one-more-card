import Phaser from 'phaser';
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
      color: options.colors.accent,
      textColor: options.colors.accentText,
      enabled: options.enabled,
      badge: options.badge,
      badgeColor: 0x23884d,
      badgeStrokeColor: 0x78d18a,
      badgeTextColor: '#eaffef',
      onShowTooltip: options.onShowTooltip,
      onHideTooltip: options.onHideTooltip,
      onActivate: options.onOpen,
    }).container;
  }
}
