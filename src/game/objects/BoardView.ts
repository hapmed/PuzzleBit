import Phaser from "phaser";
import { INGREDIENT_TEXTURE, textureForPiece } from "../art";
import type { Engine, GameEvent, TurnResult } from "../engine/engine";
import { playSfx } from "../sfx";

/** Vista animada del tablero: sprites, overlays, input y tweens. */
export class BoardView extends Phaser.GameObjects.Container {
  private cellSize: number;
  private boardX: number;
  private boardY: number;
  private engine: Engine;
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private jellyOverlays = new Map<number, Phaser.GameObjects.Image>();
  private crateOverlays = new Map<number, Phaser.GameObjects.Image>();
  private bg: Phaser.GameObjects.Graphics;
  private selectBox?: Phaser.GameObjects.Rectangle;
  private busy = false;
  private selected: { r: number; c: number } | null = null;
  private hammerMode = false;
  private pointerDownCell: { r: number; c: number } | null = null;
  private pointerStart = { x: 0, y: 0 };
  private dragDone = false;
  private pointerMoveHandler: (p: Phaser.Input.Pointer) => void;
  private onTurnEnd: (result: TurnResult) => void;

  constructor(scene: Phaser.Scene, engine: Engine, originX: number, originY: number, cellSize: number, onTurnEnd: (r: TurnResult) => void) {
    super(scene, 0, 0);
    this.engine = engine;
    this.boardX = originX;
    this.boardY = originY;
    this.cellSize = cellSize;
    this.onTurnEnd = onTurnEnd;

    const board = engine.board;
    const w = board.cols * cellSize;
    const h = board.rows * cellSize;

    // Fondo del tablero (cuadros alternos).
    this.bg = scene.add.graphics();
    this.bg.fillStyle(0x241d3f, 1);
    this.bg.fillRect(-4, -4, w + 8, h + 8);
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        this.bg.fillStyle((r + c) % 2 === 0 ? 0x2c2452 : 0x352b63, 1);
        this.bg.fillRect(originX + c * cellSize, originY + r * cellSize, cellSize, cellSize);
      }
    }
    this.bg.fillStyle(0x6a56ad, 1);
    this.bg.fillRect(originX - 2, originY - 2, w + 4, 2);
    this.bg.fillRect(originX - 2, originY + h, w + 4, 2);
    this.bg.fillRect(originX - 2, originY - 2, 2, h + 4);
    this.bg.fillRect(originX + w, originY - 2, 2, h + 4);
    this.add(this.bg);

    this.syncSprites(true);

    // Hit area para el input.
    const hit = scene.add.zone(originX + w / 2, originY + h / 2, w, h);
    hit.setInteractive();
    this.add(hit);
    hit.on("pointerdown", (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    hit.on("pointerup", (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.pointerMoveHandler = (p: Phaser.Input.Pointer) => this.onPointerMove(p);
    scene.input.on("pointermove", this.pointerMoveHandler);

    scene.add.existing(this);
  }

  /** Posición en píxeles de una celda (springs desde esquina superior-izquierda). */
  private pos(r: number, c: number): { x: number; y: number } {
    return { x: this.boardX + c * this.cellSize, y: this.boardY + r * this.cellSize };
  }

  private pieceTexture(r: number, c: number): string {
    const cell = this.engine.board.get(r, c);
    if (!cell) return "piece1";
    if (cell.ingredient) return INGREDIENT_TEXTURE;
    return textureForPiece(cell.type, cell.special);
  }

  /** Reconstruye todos los sprites del tablero (primer render o reshuffle). */
  private syncSprites(animate = false): void {
    for (const [, img] of this.sprites) img.destroy();
    this.sprites.clear();
    const board = this.engine.board;
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const cell = board.get(r, c);
        if (!cell) continue;
        const { x, y } = this.pos(r, c);
        const sprite = this.scene.add.image(x + this.cellSize / 2, y + this.cellSize / 2, this.pieceTexture(r, c));
        sprite.setOrigin(0.5, 0.5);
        const finalScale = (this.cellSize * 0.92) / 48;
        sprite.setScale(finalScale);
        if (animate) sprite.setAlpha(0).setScale(finalScale * 0.2);
        this.add(sprite);
        this.sprites.set(cell.id, sprite);
        if (animate) {
          this.scene.tweens.add({ targets: sprite, alpha: 1, scale: finalScale, duration: 180, delay: (r + c) * 12 });
        }
      }
    }
    this.refreshOverlays();
  }

  /** Actualiza overlays de jelly/caja conforme al estado actual del motor. */
  refreshOverlays(): void {
    this.jellyOverlays.forEach((img) => img.destroy());
    this.crateOverlays.forEach((img) => img.destroy());
    this.jellyOverlays.clear();
    this.crateOverlays.clear();
    const board = this.engine.board;
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const posKey = board.key(r, c);
        const { x, y } = this.pos(r, c);
        if (board.jelly.get(posKey)) {
          const img = this.scene.add.image(x + this.cellSize / 2, y + this.cellSize / 2, "overlay-jelly");
          img.setDisplaySize(this.cellSize * 1.0, this.cellSize * 1.0);
          img.setDepth(20);
          img.setAlpha(0.85);
          this.add(img);
          this.jellyOverlays.set(posKey, img);
        }
        if (board.isLocked(r, c)) {
          const img = this.scene.add.image(x + this.cellSize / 2, y + this.cellSize / 2, "overlay-crate");
          img.setDisplaySize(this.cellSize * 1.06, this.cellSize * 1.06);
          img.setDepth(30);
          this.add(img);
          this.crateOverlays.set(posKey, img);
        }
      }
    }
  }

  // ——— Input ———
  private cellAt(pointerX: number, pointerY: number): { r: number; c: number } | null {
    const c = Math.floor((pointerX - this.boardX) / this.cellSize);
    const r = Math.floor((pointerY - this.boardY) / this.cellSize);
    if (!this.engine.board.inBounds(r, c)) return null;
    return { r, c };
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.busy) return;
    this.pointerDownCell = this.cellAt(p.worldX, p.worldY);
    this.pointerStart = { x: p.worldX, y: p.worldY };
    this.dragDone = false;
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (this.busy || !this.pointerDownCell || this.dragDone) return;
    const dx = p.worldX - this.pointerStart.x;
    const dy = p.worldY - this.pointerStart.y;
    const threshold = this.cellSize * 0.4;
    let target: { r: number; c: number } | null = null;
    if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > threshold) {
      target = { r: this.pointerDownCell.r, c: this.pointerDownCell.c + (dx > 0 ? 1 : -1) };
    } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > threshold) {
      target = { r: this.pointerDownCell.r + (dy > 0 ? 1 : -1), c: this.pointerDownCell.c };
    }
    if (target && this.engine.board.inBounds(target.r, target.c)) {
      this.dragDone = true;
      playSfx(this.scene, "swap");
      void this.tryTurn(this.pointerDownCell, target);
      this.pointerDownCell = null;
    }
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    if (this.busy) return;
    const cell = this.cellAt(p.worldX, p.worldY);
    if (this.dragDone || !cell) {
      this.pointerDownCell = null;
      return;
    }
    if (this.hammerMode) {
      this.setHammerMode(false);
      void this.runTurn(() => this.engine.useHammer(cell));
      return;
    }
    if (!this.selected) {
      this.select(cell);
      return;
    }
    if (this.selected.r === cell.r && this.selected.c === cell.c) {
      this.deselect();
      return;
    }
    const adj = Math.abs(this.selected.r - cell.r) + Math.abs(this.selected.c - cell.c) === 1;
    if (adj) {
      const from = this.selected;
      this.deselect();
      void this.tryTurn(from, cell);
    } else {
      this.select(cell);
    }
  }

  private select(cell: { r: number; c: number }): void {
    this.deselect();
    this.selected = cell;
    const { x, y } = this.pos(cell.r, cell.c);
    const rect = this.scene.add.rectangle(x + this.cellSize / 2, y + this.cellSize / 2, this.cellSize * 0.95, this.cellSize * 0.95);
    rect.setStrokeStyle(3, 0xffd95e, 1);
    rect.isFilled = false;
    this.add(rect);
    this.selectBox = rect;
  }

  private deselect(): void {
    if (this.selectBox) {
      this.selectBox.destroy();
      this.selectBox = undefined;
    }
    this.selected = null;
  }

  private tryTurn(a: { r: number; c: number }, b: { r: number; c: number }): Promise<void> {
    return this.runTurn(() => this.engine.attemptSwap(a, b));
  }

  /** Ejecuta un turno (motor + animaciones) bloqueando el input mientras dura. */
  runTurn(run: () => TurnResult): Promise<void> {
    if (this.busy) return Promise.resolve();
    this.busy = true;
    this.deselect();
    const result = run();
    if (!result.ok && result.events.length === 0) {
      // Movimiento ilegal inofensivo: nada que animar.
      this.busy = false;
      return Promise.resolve();
    }
    return this.playEvents(result.events).then(() => {
      this.refreshOverlays();
      this.busy = false;
      this.onTurnEnd(result);
    });
  }

  // ——— Animaciones ———
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }

  private async playEvents(events: GameEvent[]): Promise<void> {
    for (const ev of events) {
      switch (ev.kind) {
        case "swap":
        case "revert": {          // Mueve los sprites A→pos destino y B→pos origen (veces "from"/"posA").
          const spriteA = this.sprites.get(ev.aId);
          const spriteB = this.sprites.get(ev.bId);
          const toB = ev.kind === "swap" ? ev.to : ev.posB;
          const toA = ev.kind === "swap" ? ev.from : ev.posA;
          const targetB = this.pos(toB.r, toB.c);
          const targetA = this.pos(toA.r, toA.c);
          if (spriteA) {
            this.scene.tweens.add({ targets: spriteA, x: targetB.x + this.cellSize / 2, y: targetB.y + this.cellSize / 2, duration: 130, ease: "Sine.easeInOut" });
          }
          if (spriteB) {
            this.scene.tweens.add({ targets: spriteB, x: targetA.x + this.cellSize / 2, y: targetA.y + this.cellSize / 2, duration: 130, ease: "Sine.easeInOut" });
            if (ev.kind === "revert") {
              this.scene.tweens.add({ targets: spriteB, alpha: { from: 0.4, to: 1 }, duration: 130 });
            }
          }
          await this.wait(140);
          break;
        }
        case "remove": {
          playSfx(this.scene, ev.triggers.length > 0 ? "special" : "match");
          // Flash de las especiales activadas.
          for (const t of ev.triggers) {
            const { x, y } = this.pos(t.r, t.c);
            const ring = this.scene.add.circle(x + this.cellSize / 2, y + this.cellSize / 2, this.cellSize * 0.2, 0xffffff, 0.9);
            ring.setDepth(50);
            this.add(ring);
            this.scene.tweens.add({ targets: ring, radius: this.cellSize * 1.4, alpha: 0, duration: 220, onComplete: () => ring.destroy() });
          }
          // Piezas eliminadas: destello + encogimiento.
          for (const cell of ev.cells) {
            const sprite = this.sprites.get(cell.id);
            if (!sprite) continue;
            sprite.setDepth(40);
            this.scene.tweens.add({
              targets: sprite,
              scale: sprite.scale * 0.15,
              alpha: 0,
              duration: 170,
              onComplete: () => sprite.destroy(),
            });
            this.sprites.delete(cell.id);
          }
          // Especiales recién creadas: latido.
          if (ev.created.length) {
            for (const cr of ev.created) {
              const { x, y } = this.pos(cr.r, cr.c);
              const ghost = this.scene.add.image(x + this.cellSize / 2, y + this.cellSize / 2, textureForPiece(cr.type, cr.special));
              ghost.setDisplaySize(this.cellSize * 0.92, this.cellSize * 0.92);
              ghost.setAlpha(0);
              ghost.setDepth(45);
              this.add(ghost);
              this.scene.tweens.add({ targets: ghost, alpha: 1, scale: ghost.scale * 1.08, yoyo: true, duration: 130, onComplete: () => ghost.destroy() });
            }
          }
          await this.wait(190);
          this.refreshOverlays();
          break;
        }
        case "fall": {
          for (const fall of ev.falls) {
            const sprite = this.sprites.get(fall.id);
            if (!sprite) continue;
            const to = this.pos(fall.to.r, fall.to.c);
            this.scene.tweens.add({ targets: sprite, x: to.x + this.cellSize / 2, y: to.y + this.cellSize / 2, duration: 150, ease: "Bounce.easeOut" });
          }
          await this.wait(165);
          break;
        }
        case "spawn": {
          for (const sp of ev.spawns) {
            const { x, y } = this.pos(sp.row, sp.col);
            const sprite = this.scene.add.image(x + this.cellSize / 2, y - this.cellSize, `piece${sp.type}`);
            sprite.setOrigin(0.5, 0.5);
            sprite.setScale((this.cellSize * 0.92) / 48);
            sprite.setDepth(10);
            this.add(sprite);
            this.sprites.set(sp.id, sprite);
            this.scene.tweens.add({ targets: sprite, y: y + this.cellSize / 2, duration: 160, ease: "Sine.easeOut" });
          }
          await this.wait(170);
          break;
        }
        case "ingredient": {
          for (const co of ev.collected) {
            const sprite = this.sprites.get(co.id);
            if (!sprite) continue;
            this.sprites.delete(co.id);
            this.scene.tweens.add({ targets: sprite, y: sprite.y + this.cellSize, alpha: 0, duration: 240, onComplete: () => sprite.destroy() });
          }
          this.refreshOverlays();
          await this.wait(250);
          break;
        }
        case "reshuffle": {
          this.scene.cameras.main.flash(120, 255, 255, 255);
          this.sprites.forEach((s) => s.destroy());
          this.sprites.clear();
          this.syncSprites(true);
          await this.wait(220);
          break;
        }
      }
      // La pieza puede cambiar de textura (especial creada en un turno anterior).
      if (ev.kind === "remove" || ev.kind === "fall") {
        // noop — las texturas de piezas ocultas se actualizan al final del turno.
      }
    }
    // Sincroniza texturas (por si alguna pieza cambió a especial).
    this.syncTexturesFromEngine();
  }

  private syncTexturesFromEngine(): void {
    const board = this.engine.board;
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const cell = board.get(r, c);
        if (!cell) continue;
        const sprite = this.sprites.get(cell.id);
        if (!sprite) continue;
        const tex = cell.ingredient ? INGREDIENT_TEXTURE : textureForPiece(cell.type, cell.special);
        if (sprite.texture.key !== tex) {
          sprite.setTexture(tex);
          sprite.setDisplaySize(this.cellSize * 0.92, this.cellSize * 0.92);
        }
      }
    }
    this.refreshOverlays();
  }

  setHammerMode(on: boolean): void {
    this.hammerMode = on;
  }

  isBusy(): boolean {
    return this.busy;
  }

  destroy(fromScene?: boolean): void {
    if (this.pointerMoveHandler) this.scene.input.off("pointermove", this.pointerMoveHandler);
    super.destroy(fromScene);
  }
}
