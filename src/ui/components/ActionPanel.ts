import Phaser from 'phaser';
import { t } from '../../game/i18n';
import type { BattleActionButtonState } from '../state/UIState';

export type ButtonSound = 'button' | 'card';

export type ButtonFactory = (
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  fill?: number,
  fontSize?: string,
  sound?: ButtonSound,
) => Phaser.GameObjects.Container;

interface ActionPanelOptions {
  x: number;
  y: number;
  buttons: BattleActionButtonState[];
  colors: {
    button: number;
    danger: number;
  };
  createButton: ButtonFactory;
  onAction: (button: BattleActionButtonState) => void;
  centered?: boolean;
}

export class ActionPanel {
  static render(scene: Phaser.Scene, options: ActionPanelOptions): Phaser.GameObjects.Container {
    const container = scene.add.container(options.x, options.y);
    const rightEdge = options.buttons.reduce((maximum, button) => Math.max(maximum, button.x + button.width), 0);
    const offsetX = options.centered && options.buttons.length > 0 ? -rightEdge / 2 : 0;

    options.buttons.forEach((buttonState) => {
      container.add(options.createButton(
        buttonState.x + offsetX,
        0,
        buttonState.width,
        48,
        t(buttonState.labelKey),
        () => options.onAction(buttonState),
        buttonState.danger ? options.colors.danger : options.colors.button,
        '19px',
        buttonState.id === 'view-hand' || buttonState.id === 'invite-one' ? 'card' : 'button',
      ));
    });

    return container;
  }
}
