import Phaser from 'phaser';
import { t } from '../../game/i18n';
import type { BattleActionButtonState } from '../state/UIState';
import { addTutorialGuide } from './TutorialGuide';

export type ButtonSound = 'button' | 'card' | 'none';

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
    primary: number;
    danger: number;
  };
  createButton: ButtonFactory;
  onAction: (button: BattleActionButtonState) => void;
  centered?: boolean;
  guideTarget?: BattleActionButtonState['id'];
  onTargetRendered?: (id: BattleActionButtonState['id'], x: number, y: number, width: number, height: number) => void;
}

export class ActionPanel {
  static render(scene: Phaser.Scene, options: ActionPanelOptions): Phaser.GameObjects.Container {
    const container = scene.add.container(options.x, options.y);
    const rightEdge = options.buttons.reduce((maximum, button) => Math.max(maximum, button.x + button.width), 0);
    const offsetX = options.centered && options.buttons.length > 0 ? -rightEdge / 2 : 0;

    options.buttons.forEach((buttonState) => {
      options.onTargetRendered?.(buttonState.id, buttonState.x + offsetX + buttonState.width / 2, 24, buttonState.width, 48);
      const primaryAction = buttonState.id === 'compare'
        || buttonState.id === 'player-stand'
        || buttonState.id === 'view-hand';
      container.add(options.createButton(
        buttonState.x + offsetX,
        0,
        buttonState.width,
        48,
        t(buttonState.labelKey),
        () => options.onAction(buttonState),
        buttonState.danger
          ? options.colors.danger
          : primaryAction ? options.colors.primary : options.colors.button,
        '19px',
        buttonState.id === 'view-hand' ? 'card' : buttonState.id === 'invite-one' ? 'none' : 'button',
      ));
      if (buttonState.id === options.guideTarget) {
        addTutorialGuide(scene, container, buttonState.x + offsetX + buttonState.width / 2, 24, buttonState.width, 48);
      }
    });

    return container;
  }
}
