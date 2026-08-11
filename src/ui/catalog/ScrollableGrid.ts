import Phaser from 'phaser';

export interface ScrollableGridOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  columns: number;
  cellWidth: number;
  cellHeight: number;
  columnGap?: number;
  rowGap?: number;
  wheelStep?: number;
  scrollbar?: {
    width?: number;
    minThumbHeight?: number;
    trackColor?: number;
    trackAlpha?: number;
    thumbColor?: number;
    thumbHoverColor?: number;
  };
}

export type ScrollableGridRenderer<T> = (
  scene: Phaser.Scene,
  item: T,
  index: number,
) => Phaser.GameObjects.Container;

export class ScrollableGrid<T> {
  readonly container: Phaser.GameObjects.Container;

  private readonly content: Phaser.GameObjects.Container;
  private readonly viewportZone: Phaser.GameObjects.Rectangle;
  private readonly maskGraphics: Phaser.GameObjects.Graphics;
  private readonly mask: Phaser.Display.Masks.GeometryMask;
  private readonly scrollbarTrack: Phaser.GameObjects.Rectangle;
  private readonly scrollbarThumb: Phaser.GameObjects.Rectangle;
  private readonly options: Required<Pick<ScrollableGridOptions, 'columnGap' | 'rowGap' | 'wheelStep'>> & ScrollableGridOptions;
  private contentHeight = 0;
  private scrollOffset = 0;
  private dragPointerId?: number;
  private dragStartY = 0;
  private dragStartOffset = 0;
  private draggingScrollbar = false;
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene, options: ScrollableGridOptions) {
    this.options = {
      ...options,
      columnGap: options.columnGap ?? 16,
      rowGap: options.rowGap ?? 16,
      wheelStep: options.wheelStep ?? Math.max(48, options.cellHeight * 0.55),
    };

    this.container = scene.add.container(options.x, options.y);
    this.viewportZone = scene.add.rectangle(
      options.width / 2,
      options.height / 2,
      options.width,
      options.height,
      0x000000,
      0.001,
    ).setInteractive();
    this.content = scene.add.container(0, 0);
    this.container.add([this.viewportZone, this.content]);

    const maskConfig = { x: 0, y: 0, add: false };
    this.maskGraphics = scene.make.graphics(maskConfig);
    this.maskGraphics.fillStyle(0xffffff, 1);
    this.maskGraphics.fillRect(options.x, options.y, options.width, options.height);
    this.mask = this.maskGraphics.createGeometryMask();
    this.content.setMask(this.mask);

    const scrollbar = options.scrollbar ?? {};
    const scrollbarWidth = scrollbar.width ?? 8;
    this.scrollbarTrack = scene.add.rectangle(
      options.width - scrollbarWidth / 2,
      options.height / 2,
      scrollbarWidth,
      options.height,
      scrollbar.trackColor ?? 0x252832,
      scrollbar.trackAlpha ?? 0.9,
    );
    this.scrollbarThumb = scene.add.rectangle(
      options.width - scrollbarWidth / 2,
      0,
      scrollbarWidth,
      scrollbar.minThumbHeight ?? 42,
      scrollbar.thumbColor ?? 0x6f7687,
      1,
    ).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    this.container.add([this.scrollbarTrack, this.scrollbarThumb]);

    this.scrollbarThumb.on(Phaser.Input.Events.POINTER_OVER, this.handleThumbOver, this);
    this.scrollbarThumb.on(Phaser.Input.Events.POINTER_OUT, this.handleThumbOut, this);
    this.scrollbarThumb.on(Phaser.Input.Events.POINTER_DOWN, this.handleThumbDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    this.container.once(Phaser.GameObjects.Events.DESTROY, this.cleanup, this);
    this.updateScrollbar();
  }

  setItems(items: T[], renderer: ScrollableGridRenderer<T>): void {
    this.content.removeAll(true);
    const { columns, cellWidth, cellHeight, columnGap, rowGap } = this.options;
    const rows = Math.ceil(items.length / columns);
    const gridWidth = columns * cellWidth + Math.max(0, columns - 1) * columnGap;
    const startX = Math.max(0, (this.options.width - gridWidth) / 2);

    items.forEach((item, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const view = renderer(this.scene, item, index);
      view.setPosition(
        startX + cellWidth / 2 + column * (cellWidth + columnGap),
        cellHeight / 2 + row * (cellHeight + rowGap),
      );
      this.content.add(view);
    });

    this.contentHeight = rows === 0 ? 0 : rows * cellHeight + Math.max(0, rows - 1) * rowGap;
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, this.maxScrollOffset());
    this.applyScrollOffset();
  }

  scrollToTop(): void {
    this.setScrollOffset(0);
  }

  scrollBy(delta: number): void {
    this.setScrollOffset(this.scrollOffset + delta);
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.cleanup();
    if (this.container.active) {
      this.container.destroy(true);
    }
  }

  private setScrollOffset(value: number): void {
    const nextOffset = Phaser.Math.Clamp(value, 0, this.maxScrollOffset());
    if (nextOffset === this.scrollOffset) {
      return;
    }

    this.scrollOffset = nextOffset;
    this.applyScrollOffset();
  }

  private applyScrollOffset(): void {
    this.content.y = -this.scrollOffset;
    this.updateScrollbar();
  }

  private updateScrollbar(): void {
    const maxOffset = this.maxScrollOffset();
    const visible = maxOffset > 0;
    this.scrollbarTrack.setVisible(visible);
    this.scrollbarThumb.setVisible(visible);
    this.scrollbarThumb.disableInteractive();
    if (!visible) {
      return;
    }

    this.scrollbarThumb.setInteractive({ useHandCursor: true });
    const minimumHeight = this.options.scrollbar?.minThumbHeight ?? 42;
    const thumbHeight = Math.max(minimumHeight, this.options.height * (this.options.height / this.contentHeight));
    const travel = this.options.height - thumbHeight;
    const progress = maxOffset === 0 ? 0 : this.scrollOffset / maxOffset;
    this.scrollbarThumb.setDisplaySize(this.options.scrollbar?.width ?? 8, thumbHeight);
    this.scrollbarThumb.y = travel * progress;
  }

  private maxScrollOffset(): number {
    return Math.max(0, this.contentHeight - this.options.height);
  }

  private pointerInsideViewport(pointer: Phaser.Input.Pointer): boolean {
    const x = pointer.worldX - this.options.x;
    const y = pointer.worldY - this.options.y;
    return x >= 0 && x <= this.options.width && y >= 0 && y <= this.options.height;
  }

  private handleWheel(
    pointer: Phaser.Input.Pointer,
    _over: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    if (!this.pointerInsideViewport(pointer) || this.maxScrollOffset() === 0) {
      return;
    }

    this.scrollBy(Math.sign(deltaY) * this.options.wheelStep);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.pointerInsideViewport(pointer) || this.maxScrollOffset() === 0) {
      return;
    }

    this.dragPointerId = pointer.id;
    this.dragStartY = pointer.worldY;
    this.dragStartOffset = this.scrollOffset;
  }

  private handleThumbDown(pointer: Phaser.Input.Pointer): void {
    this.draggingScrollbar = true;
    this.dragPointerId = pointer.id;
    this.dragStartY = pointer.worldY;
    this.dragStartOffset = this.scrollOffset;
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.dragPointerId !== pointer.id || !pointer.isDown) {
      return;
    }

    const deltaY = pointer.worldY - this.dragStartY;
    if (this.draggingScrollbar) {
      const thumbHeight = this.scrollbarThumb.displayHeight;
      const travel = Math.max(1, this.options.height - thumbHeight);
      this.setScrollOffset(this.dragStartOffset + (deltaY / travel) * this.maxScrollOffset());
      return;
    }

    this.setScrollOffset(this.dragStartOffset - deltaY);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.dragPointerId !== pointer.id) {
      return;
    }

    this.dragPointerId = undefined;
    this.draggingScrollbar = false;
  }

  private handleThumbOver(): void {
    this.scrollbarThumb.setFillStyle(this.options.scrollbar?.thumbHoverColor ?? 0x9aa3b8);
  }

  private handleThumbOut(): void {
    this.scrollbarThumb.setFillStyle(this.options.scrollbar?.thumbColor ?? 0x6f7687);
  }

  private cleanup(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    this.scrollbarThumb.off(Phaser.Input.Events.POINTER_OVER, this.handleThumbOver, this);
    this.scrollbarThumb.off(Phaser.Input.Events.POINTER_OUT, this.handleThumbOut, this);
    this.scrollbarThumb.off(Phaser.Input.Events.POINTER_DOWN, this.handleThumbDown, this);
    this.content.clearMask(false);
    this.mask.destroy();
    this.maskGraphics.destroy();
  }
}
