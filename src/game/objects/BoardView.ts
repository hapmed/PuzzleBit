import Phaser from "phaser";
import { INGREDIENT_TEXTURE, PIECE_TINTS, textureForPiece } from "../art";
import { colorSweep, comboZoom, megaBreak, pixelRain, screenPunch, shockwave } from "../fx";
import type { Engine, GameEvent, TurnResult } from "../engine/engine";
import { announce, playSfx } from "../sfx";

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
  private cascadeCount = 0;
  private lastRemoval?: { x: number; y: number; cells: number };
  private shadows = new Map<number, Phaser.GameObjects.Image>();

  /** Cascadas que vencieron en el último turno (0 = ninguna). */
  get lastCascade(): number {
    return this.cascadeCount;
  }


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

    // Fondo del tablero (cuadros alternos) — solo la zona del tablero,
    // sin tapar toda la pantalla (arrastraba al HUD y al fondo animado).
    this.bg = scene.add.graphics();
    this.bg.fillStyle(0x241d3f, 1);
    this.bg.fillRect(originX - 4, originY - 4, w + 8, h + 8);
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

  /** Escala base de una pieza (texturas de 48 px). */
  private baseScale(): number {
    return (this.cellSize * 0.98) / 48;
  }

  /** Crea o recoloca la sombra que le da cuerpo a una pieza. */
  private ensureShadow(id: number, cx: number, groundY: number): Phaser.GameObjects.Image {
    let img = this.shadows.get(id);
    if (!img) {
      img = this.scene.add.image(cx, groundY, "shadow").setDepth(4);
      img.setDisplaySize(this.cellSize * 0.9, this.cellSize * 0.44);
      this.add(img);
      this.shadows.set(id, img);
    }
    return img;
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
    for (const [, img] of this.shadows) img.destroy();
    this.shadows.clear();
    const board = this.engine.board;
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const cell = board.get(r, c);
        if (!cell) continue;
        const { x, y } = this.pos(r, c);
        const sprite = this.scene.add.image(x + this.cellSize / 2, y + this.cellSize / 2, this.pieceTexture(r, c));
        sprite.setOrigin(0.5, 0.5);
        const finalScale = this.baseScale();
        sprite.setScale(finalScale).setDepth(10);
        sprite.setData("base", finalScale);
        if (animate) sprite.setAlpha(0).setScale(finalScale * 0.2);
        this.add(sprite);
        this.sprites.set(cell.id, sprite);
        this.ensureShadow(cell.id, x + this.cellSize / 2 + 5, y + this.cellSize * 0.96).setAlpha(0.92);
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
    this.scene.tweens.add({
      targets: rect,
      alpha: { from: 1, to: 0.55 },
      duration: 320,
      yoyo: true,
      repeat: -1,
    });
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
    const scoreBefore = this.engine.score;
    this.cascadeCount = 0;
    const result = run();
    if (!result.ok && result.events.length === 0) {
      // Movimiento ilegal inofensivo: nada que animar.
      this.busy = false;
      return Promise.resolve();
    }
    return this.playEvents(result.events).then(() => {
      this.refreshOverlays();
      // Efectos de puntuación: +delta flotante y banner de cascada.
      const delta = this.engine.score - scoreBefore;
      if (delta > 0 && this.lastRemoval) {
        this.spawnScorePop(`${delta >= 100 ? "+" + Math.round(delta) : "+" + delta}`, this.lastRemoval.x, this.lastRemoval.y);
      }
      if (this.cascadeCount >= 2) {
        this.spawnCascadeBanner(this.cascadeCount);
      }
      this.busy = false;
      this.onTurnEnd(result);
    });
  }

  // ——— Animaciones ———
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }

  /** Explosión corta de partículas del color de la pieza. */
  private spawnBurst(x: number, y: number, tint: number): void {
    if (this.scene.tweens.getGlobalTimeScale() === 0) return;
    const tex = this.scene.textures.exists("star") ? "star" : "piece1";
    try {
      const emitter = this.scene.add.particles(x, y, tex, {
        speed: { min: 60, max: 170 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 240, max: 420 },
        scale: { start: 0.28, end: 0 },
        alpha: { start: 0.95, end: 0 },
        gravityY: 260,
        tint,
        quantity: 4,
        emitting: false,
      });
      emitter.setDepth(60);
      emitter.explode(4);
      this.scene.time.delayedCall(480, () => emitter.destroy());
    } catch {
      /* sin partículas, nada grave */
    }
  }

  /** "+N" flotante en el centro del match. */
  private spawnScorePop(text: string, x: number, y: number): void {
    const pop = this.scene.add.text(x, y, text, {
      fontFamily: '"Courier New", monospace',
      fontSize: "26px",
      color: "#ffd95e",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(70).setStroke("#14102b", 4);
    this.scene.tweens.add({
      targets: pop,
      y: y - this.cellSize * 1.3,
      scale: { from: 0.5, to: 1.15 },
      alpha: { from: 1, to: 0 },
      duration: 620,
      ease: "Sine.easeOut",
      onComplete: () => pop.destroy(),
    });
  }

  /** Banner grande ¡CASCADA xN! + stinger + voz de presentador, estilo arcade. */
  private spawnCascadeBanner(n: number): void {
    const w = this.scene.scale.width;
    const colors = ["#ffd95e", "#ff9a3d", "#ff5fa2", "#b06bff"];
    const color = colors[Math.min(n - 2, colors.length - 1)];
    const tiers = [
      { msg: "¡DOBLE CASCADA!", tint: 0xffe14d, punch: 0.5 },
      { msg: "¡TRIPLE CASCADA!", tint: 0xff9a3d, punch: 0.75 },
      { msg: "¡CASCADA BRUTAL!", tint: 0xff5fa2, punch: 1 },
      { msg: "¡CATACLISMO!", tint: 0xb06bff, punch: 1.25 },
      { msg: "¡¡IMPARABLE!!", tint: 0xffffff, punch: 1.5 },
    ];
    const voxKeys = ["vox2", "vox3", "vox4", "vox5"] as const;
    const tierIdx = Math.min(n - 2, tiers.length - 1);
    const tier = tiers[tierIdx];
    playSfx(this.scene, voxKeys[Math.min(n - 2, voxKeys.length - 1)]);
    announce(tier.msg, this.scene);
    screenPunch(this.scene, tier.tint, tier.punch);
    comboZoom(this.scene, 0.7 + tier.punch); // zoom de cámara con cada cascada
    const banner = this.scene.add.text(w / 2, this.scene.scale.height * 0.36, tier.msg, {
      fontFamily: '"Courier New", monospace',
      fontSize: "34px",
      color,
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(80).setStroke("#14102b", 6);
    banner.setScale(0.3).setAlpha(0);
    this.scene.tweens.add({
      targets: banner,
      scale: 1,
      alpha: 1,
      duration: 180,
      ease: "Back.easeOut",
      onComplete: () => {
        this.scene.tweens.add({
          targets: banner,
          y: "-=60",
          alpha: 0,
          delay: 220,
          duration: 320,
          ease: "Sine.easeIn",
          onComplete: () => banner.destroy(),
        });
      },
    });
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
          const lift = (spr: Phaser.GameObjects.Image | undefined, dest: { x: number; y: number }, id: number): void => {
            if (!spr) return;
            const bs = (spr.getData("base") as number) ?? spr.scaleX;
            this.scene.tweens.add({ targets: spr, x: dest.x + this.cellSize / 2, y: dest.y + this.cellSize / 2, duration: 92, ease: "Sine.easeInOut" });
            // Levantada: crece un cacho mientras cruza, luego vuelve (da volumen).
            this.scene.tweens.add({ targets: spr, scale: bs * 1.16, duration: 46, yoyo: true, ease: "Sine.easeOut" });
            const sh = this.shadows.get(id);
            if (sh) {
              this.scene.tweens.add({ targets: sh, x: dest.x + this.cellSize / 2 + 5, duration: 92, ease: "Sine.easeInOut" });
              this.scene.tweens.add({ targets: sh, alpha: 0.35, duration: 46, yoyo: true });
            }
          };
          lift(spriteA, targetB, ev.aId);
          lift(spriteB, targetA, ev.bId);
          if (spriteB && ev.kind === "revert") {
            this.scene.tweens.add({ targets: spriteB, alpha: { from: 0.4, to: 1 }, duration: 110 });
          }
          await this.wait(95);
          break;
        }
        case "remove": {
          playSfx(this.scene, ev.triggers.length > 0 ? "special" : "match");
          this.cascadeCount++;
          // Flash de las especiales activadas.
          for (const t of ev.triggers) {
            const { x, y } = this.pos(t.r, t.c);
            const ring = this.scene.add.circle(x + this.cellSize / 2, y + this.cellSize / 2, this.cellSize * 0.2, 0xffffff, 0.9);
            ring.setDepth(50);
            this.add(ring);
            this.scene.tweens.add({ targets: ring, radius: this.cellSize * 1.4, alpha: 0, duration: 220, onComplete: () => ring.destroy() });
          }
          // Sacudida cuando el turno removió mucho (especial grande o cascada).
          if (ev.cells.length >= 6 || this.cascadeCount >= 2) {
            this.scene.cameras.main.shake(130, this.cascadeCount >= 2 ? 0.004 : 0.0025);
          }
          // Efecto de pantalla por especial potente.
          if (ev.triggers.length >= 2 || ev.cells.length >= 8) {
            screenPunch(this.scene, 0xffd95e, 0.55);
          }
          // Piezas eliminadas: destello + encogimiento + partículas del color.
          for (const cell of ev.cells) {
            const sprite = this.sprites.get(cell.id);
            if (!sprite) continue;
            const { x, y } = this.pos(cell.r, cell.c);
            sprite.setDepth(40);
            this.spawnBurst(x + this.cellSize / 2, y + this.cellSize / 2, cell.type === 0 || cell.ingredient ? 6 : PIECE_TINTS[cell.type]);
            this.scene.tweens.add({
              targets: sprite,
              scale: sprite.scale * 0.15,
              alpha: 0,
              duration: 120,
              onComplete: () => sprite.destroy(),
            });
            this.sprites.delete(cell.id);
            const sh = this.shadows.get(cell.id);
            if (sh) {
              sh.destroy();
              this.shadows.delete(cell.id);
            }
          }
          // Repintados del dado: cambian de color con un pulso.
          for (const rp of ev.repainted) {
            const sprite = this.sprites.get(rp.id);
            if (!sprite) continue;
            sprite.setTexture(textureForPiece(rp.type, "none"));
            this.scene.tweens.add({
              targets: sprite,
              scaleX: sprite.scale * 1.15,
              scaleY: sprite.scale * 1.15,
              duration: 90,
              yoyo: true,
            });
            this.spawnBurst(sprite.x, sprite.y, PIECE_TINTS[rp.type]);
          }
          if (ev.cells.length > 0) {
            const mid = ev.cells[Math.floor(ev.cells.length / 2)];
            const { x, y } = this.pos(mid.r, mid.c);
            const cx = x + this.cellSize / 2;
            const cy = y + this.cellSize / 2 - this.cellSize * 0.4;
            this.lastRemoval = { x: cx, y: cy, cells: ev.cells.length };
            // ——— Pantalla completa: cada rompe tiene su show ———
            const power = ev.squares >= 2 ? 1.2 : ev.triggers.length > 0 ? 0.95 : 0.55;
            shockwave(this.scene, cx, cy, ev.triggers.length > 0 ? 0xffffff : 0xffd95e, power);
            if (ev.created.length > 0) pixelRain(this.scene, 0xffe14d);
            if (ev.triggers.length >= 2 || this.cascadeCount >= 2) colorSweep(this.scene, 0xff9a3d);
            // Rompe con especial resuelta en cadena: mega espectáculo.
            if (ev.created.length > 0 && ev.triggers.length > 0) megaBreak(this.scene, cx, cy, 0xffe14d);
            // Doble cuadro: triple onda + aguacero dorado + anuncio.
            if (ev.squares >= 2) {
              pixelRain(this.scene, 0xffe14d, 44);
              announce("¡Doble cuadro!", this.scene);
            }
            // Cascada larga: estrellas lloviendo.
            if (this.cascadeCount >= 3) pixelRain(this.scene, 0xffffff, 36);
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
          await this.wait(140);
          this.refreshOverlays();
          break;
        }
        case "fall": {
          for (const fall of ev.falls) {
            const sprite = this.sprites.get(fall.id);
            if (!sprite) continue;
            const to = this.pos(fall.to.r, fall.to.c);
            const bs = (sprite.getData("base") as number) ?? sprite.scaleX;
            // Cae estirándose; aterriza con aplaste. La sombra viaja con ella.
            if (to.y > sprite.y - this.cellSize) sprite.setScale(bs * 0.86, bs * 1.2);
            this.scene.tweens.add({
              targets: sprite,
              x: to.x + this.cellSize / 2,
              y: to.y + this.cellSize / 2,
              scaleX: bs,
              scaleY: bs,
              duration: 118,
              ease: "Bounce.easeOut",
              onComplete: () => {
                this.scene.tweens.add({
                  targets: sprite,
                  scaleX: bs * 1.06,
                  scaleY: bs * 0.86,
                  duration: 55,
                  yoyo: true,
                });
              },
            });
            const sh = this.shadows.get(fall.id);
            if (sh) {
              this.scene.tweens.add({ targets: sh, x: to.x + this.cellSize / 2 + 5, y: to.y + this.cellSize * 0.96, duration: 118, ease: "Sine.easeOut" });
            }
          }
          await this.wait(125);
          break;
        }
        case "spawn": {
          for (const sp of ev.spawns) {
            const { x, y } = this.pos(sp.row, sp.col);
            const sprite = this.scene.add.image(x + this.cellSize / 2, y - this.cellSize, `piece${sp.type}`);
            sprite.setOrigin(0.5, 0.5);
            const bs = this.baseScale();
            sprite.setScale(bs).setDepth(10);
            sprite.setData("base", bs);
            sprite.setDepth(10);
            this.add(sprite);
            this.sprites.set(sp.id, sprite);
            this.scene.tweens.add({
              targets: sprite,
              y: y + this.cellSize / 2,
              duration: 118,
              ease: "Sine.easeOut",
            });
            const sh = this.ensureShadow(sp.id, x + this.cellSize / 2 + 5, y + this.cellSize * 0.96);
            sh.setAlpha(0);
            this.scene.tweens.add({ targets: sh, alpha: 0.92, duration: 118 });
          }
          await this.wait(125);
          break;
        }
        case "ingredient": {
          for (const co of ev.collected) {
            const sprite = this.sprites.get(co.id);
            if (!sprite) continue;
            this.sprites.delete(co.id);
            const sh = this.shadows.get(co.id);
            if (sh) {
              sh.destroy();
              this.shadows.delete(co.id);
            }
            this.spawnBurst(sprite.x, sprite.y, 0xffe14d);
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
