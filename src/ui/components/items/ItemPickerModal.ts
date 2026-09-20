import Phaser from 'phaser';
import type { NineSliceArtAsset } from '../../art';
import { GAME_FONT_FAMILY } from '../../themes/typography';
import { MedievalButton } from '../MedievalButton';
import { MedievalPanel } from '../MedievalPanel';
import { BattleItemCard } from './BattleItemCard';
import type { BattleItemCardState } from './BattleItemCardState';
import { addTutorialGuide } from '../TutorialGuide';

export interface ItemPickerModalOptions {
  items: BattleItemCardState[];
  page: number;
  pageSize?: number;
  animateOpen: boolean;
  cardFrameTextureKey?: string;
  title: string;
  usageLabel: string;
  phaseHint: string;
  selectHint: string;
  emptyLabel: string;
  useLabel: string;
  closeLabel: string;
  panelSkin?: NineSliceArtAsset;
  buttonSkin?: NineSliceArtAsset;
  colors: {
    panel: number;
    line: number;
    text: string;
    muted: string;
    accent: number;
    accentText: string;
    dangerText: string;
  };
  onSelect: (id: BattleItemCardState['id']) => void;
  onUse: (id: BattleItemCardState['id']) => void;
  onPageChange: (page: number) => void;
  onClose: () => void;
  guideItemId?: BattleItemCardState['id'];
  guideUseButton?: boolean;
}

const PANEL_WIDTH = 960;
const PANEL_HEIGHT = 520;
const CARD_WIDTH = 188;
const CARD_HEIGHT = 300;
const CARD_GAP = 20;
const DEFAULT_PAGE_SIZE = 4;

export class ItemPickerModal {
  static render(scene: Phaser.Scene, options: ItemPickerModalOptions): Phaser.GameObjects.Container {
    const container = scene.add.container(640, 360).setDepth(80);
    const overlay = scene.add.rectangle(0, 0, 1280, 720, 0x050608, 0.68).setInteractive();
    const panel = MedievalPanel.render(scene, {
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      skin: options.panelSkin,
      fallbackFill: options.colors.panel,
      fallbackLine: options.colors.accent,
    });
    const title = scene.add.text(0, -224, options.title, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '30px',
      color: options.colors.accentText,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 0, options.colors.accentText, 9, true, true);
    const usage = scene.add.text(0, -188, options.usageLabel, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '15px',
      color: options.colors.muted,
    }).setOrigin(0.5);
    const hint = scene.add.text(0, -161, options.phaseHint, {
      fontFamily: GAME_FONT_FAMILY,
      fontSize: '14px',
      color: options.colors.muted,
    }).setOrigin(0.5);
    container.add([overlay, panel, title, usage, hint]);

    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(options.items.length / pageSize));
    const page = Phaser.Math.Clamp(options.page, 0, pageCount - 1);
    const visibleItems = options.items.slice(page * pageSize, page * pageSize + pageSize);
    const cardContainers = new Map<BattleItemCardState['id'], Phaser.GameObjects.Container>();

    if (options.items.length === 0) {
      const emptySlot = scene.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0x211713, 0.72)
        .setStrokeStyle(2, 0x6f5a3c, 0.58);
      const emptyMark = scene.add.text(0, -26, '—', {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '52px',
        color: options.colors.muted,
      }).setOrigin(0.5);
      const emptyText = scene.add.text(0, 38, options.emptyLabel, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '17px',
        color: options.colors.muted,
        align: 'center',
        lineSpacing: 6,
        wordWrap: { width: CARD_WIDTH - 28, useAdvancedWrap: true },
      }).setOrigin(0.5);
      container.add([emptySlot, emptyMark, emptyText]);
    } else {
      const totalWidth = visibleItems.length * CARD_WIDTH + Math.max(0, visibleItems.length - 1) * CARD_GAP;
      const startX = -totalWidth / 2 + CARD_WIDTH / 2;
      visibleItems.forEach((item, index) => {
        const card = new BattleItemCard(scene, {
          x: startX + index * (CARD_WIDTH + CARD_GAP),
          y: -6,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          state: item,
          frameTextureKey: options.cardFrameTextureKey,
          onSelect: options.onSelect,
        }).container;
        if (options.items.some((candidate) => candidate.selected) && !item.selected) {
          card.setAlpha(item.available ? 0.58 : 0.42);
        }
        cardContainers.set(item.id, card);
        container.add(card);
        if (item.id === options.guideItemId) {
          addTutorialGuide(scene, container, card.x, card.y, CARD_WIDTH, CARD_HEIGHT);
        }
      });
    }

    const selected = options.items.find((item) => item.selected);
    const footerY = PANEL_HEIGHT / 2 - 48;
    const footerObjects: Phaser.GameObjects.GameObject[] = [];
    let useButton: Phaser.GameObjects.Container | undefined;
    if (selected?.available) {
      useButton = MedievalButton.render(scene, {
        x: -196,
        y: footerY - 24,
        width: 184,
        height: 48,
        label: options.useLabel,
        variant: 'primary',
        skin: options.buttonSkin,
        onActivate: () => playUseTransition(scene, {
          root: container,
          panel,
          title,
          usage,
          hint,
          cards: cardContainers,
          selectedId: selected.id,
          footerObjects,
          onComplete: () => options.onUse(selected.id),
        }),
      });
      container.add(useButton);
      footerObjects.push(useButton);
      if (options.guideUseButton) {
        addTutorialGuide(scene, container, -104, footerY, 184, 48);
      }
    } else {
      const selectionHint = scene.add.text(-104, footerY, selected?.unavailableReason ?? options.selectHint, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '14px',
        color: selected ? options.colors.dangerText : options.colors.muted,
        align: 'center',
        wordWrap: { width: 280, useAdvancedWrap: true },
      }).setOrigin(0.5);
      container.add(selectionHint);
      footerObjects.push(selectionHint);
    }

    const closeButton = MedievalButton.render(scene, {
      x: 12,
      y: footerY - 24,
      width: 184,
      height: 48,
      label: options.closeLabel,
      variant: 'secondary',
      skin: options.buttonSkin,
      onActivate: options.onClose,
    });
    container.add(closeButton);
    footerObjects.push(closeButton);

    if (pageCount > 1) {
      const pageY = -161;
      const pageText = scene.add.text(0, pageY, `${page + 1} / ${pageCount}`, {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: '14px',
        color: options.colors.text,
      }).setOrigin(0.5);
      const previous = MedievalButton.render(scene, {
        x: -78,
        y: pageY - 18,
        width: 48,
        height: 36,
        label: '‹',
        fontSize: '24px',
        enabled: page > 0,
        variant: 'secondary',
        skin: options.buttonSkin,
        onActivate: () => options.onPageChange(page - 1),
      });
      const next = MedievalButton.render(scene, {
        x: 30,
        y: pageY - 18,
        width: 48,
        height: 36,
        label: '›',
        fontSize: '24px',
        enabled: page < pageCount - 1,
        variant: 'secondary',
        skin: options.buttonSkin,
        onActivate: () => options.onPageChange(page + 1),
      });
      container.add([pageText, previous, next]);
      hint.setX(-230).setOrigin(0, 0.5);
    }

    if (options.animateOpen && visibleItems.length > 0) {
      playOpenTransition(scene, container, cardContainers);
    }
    return container;
  }
}

interface UseTransitionOptions {
  root: Phaser.GameObjects.Container;
  panel: Phaser.GameObjects.Container;
  title: Phaser.GameObjects.Text;
  usage: Phaser.GameObjects.Text;
  hint: Phaser.GameObjects.Text;
  cards: Map<BattleItemCardState['id'], Phaser.GameObjects.Container>;
  selectedId: BattleItemCardState['id'];
  footerObjects: Phaser.GameObjects.GameObject[];
  onComplete: () => void;
}

function playOpenTransition(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  cards: Map<BattleItemCardState['id'], Phaser.GameObjects.Container>,
): void {
  const blocker = scene.add.rectangle(0, 0, 1280, 720, 0x000000, 0.001).setInteractive();
  root.add(blocker);
  scene.sound.play('cardPlace', { volume: 0.28 });
  const cardList = [...cards.values()];
  cardList.forEach((card, index) => {
    const targetX = card.x;
    const targetY = card.y;
    const targetAlpha = card.alpha;
    card.setPosition(0, 316).setAlpha(0).setScale(0.82).setAngle(index % 2 === 0 ? -7 : 7);
    scene.tweens.add({
      targets: card,
      x: targetX,
      y: targetY,
      alpha: targetAlpha,
      scale: 1,
      angle: 0,
      duration: 340,
      delay: index * 70,
      ease: 'Cubic.easeOut',
    });
  });
  scene.time.delayedCall(360 + Math.max(0, cardList.length - 1) * 70, () => blocker.destroy());
}

function playUseTransition(scene: Phaser.Scene, options: UseTransitionOptions): void {
  const selectedCard = options.cards.get(options.selectedId);
  if (!selectedCard?.active) {
    options.onComplete();
    return;
  }

  const blocker = scene.add.rectangle(0, 0, 1280, 720, 0x000000, 0.001).setInteractive();
  options.root.add(blocker);
  scene.sound.play('cardPlace', { volume: 0.42 });

  options.cards.forEach((card, id) => {
    if (id === options.selectedId) {
      return;
    }
    scene.tweens.add({
      targets: card,
      alpha: 0,
      y: card.y + 18,
      duration: 180,
      ease: 'Sine.easeIn',
    });
  });
  scene.tweens.add({ targets: [options.title, options.usage, options.hint], alpha: 0, duration: 180 });
  options.footerObjects.forEach((object) => scene.tweens.add({ targets: object, alpha: 0, duration: 160 }));
  scene.tweens.add({
    targets: selectedCard,
    x: 0,
    y: -4,
    scale: 1.12,
    alpha: 1,
    duration: 300,
    ease: 'Cubic.easeInOut',
    onComplete: () => {
      scene.tweens.add({
        targets: [options.panel, selectedCard],
        alpha: 0,
        scale: selectedCard.scale * 1.04,
        duration: 220,
        ease: 'Sine.easeIn',
        onComplete: options.onComplete,
      });
    },
  });
}
