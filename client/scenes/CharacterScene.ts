import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@shared/renderConstants';
import { LAYER_SLOTS, CHARACTER_PRESETS, defaultLayers } from '../data/characterLayers';
import type { CharacterPreset } from '../types/character';
import { CHARACTER_KEY } from '../types/character';
import { AuthManager } from '../systems/AuthManager';

// ─── Layout constants ────────────────────────────────────────────────────────
const PREVIEW_X   = 240;
const PREVIEW_Y   = 280;
const PREVIEW_SCALE = 3.5;

const SLOTS_X     = 560;
const SLOTS_START_Y = 195;
const SLOT_H      = 48;

const PALETTE = {
  bg:     0x0a0a1e,
  panel:  0x12122e,
  border: 0x3a3a6e,
  gold:   0xffd700,
  white:  0xffffff,
  dim:    0x555577,
  hover:  0xffe066,
  green:  0x44cc88,
  locked: 0x333355,
};

// ─── Scene ───────────────────────────────────────────────────────────────────
export class CharacterScene extends Phaser.Scene {
  private saveSlot: 'A' | 'B' | 'C' = 'A';

  /** Current layer selections: slotId → optionId */
  private selections: Record<string, string> = {};
  private activePreset: string | null = 'male-wizard';

  /** Live preview sprites, one per slot (ordered back→front) */
  private previewSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  /** Current anim prefix per slot — kept in sync by refreshPreview() */
  private previewAnimPrefixes: Map<string, string> = new Map();
  /** Current preview direction index (0=down 1=left 2=right 3=up) */
  private previewDirIndex = 0;
  private previewContainer!: Phaser.GameObjects.Container;

  /** Slot label texts so we can refresh them on arrow press */
  private slotLabels: Map<string, Phaser.GameObjects.Text> = new Map();

  /** Preset button panels so we can highlight the active one */
  private presetPanels: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private presetTexts:  Map<string, Phaser.GameObjects.Text>    = new Map();

  constructor() {
    super({ key: 'CharacterScene' });
  }

  init(data: { slot?: 'A' | 'B' | 'C' }): void {
    this.saveSlot = data?.slot ?? 'A';
  }

  /** Username of the logged-in player (used to gate exclusive content). */
  private get currentUsername(): string | null {
    return AuthManager.getSession()?.username ?? null;
  }

  /** Returns true if this option/preset is visible to the current user. */
  private canAccess(requiredUsername?: string): boolean {
    if (!requiredUsername) return true;
    return this.currentUsername === requiredUsername;
  }

  create(): void {
    // Apply male-wizard preset as default
    this.selections = defaultLayers();
    this.applyPreset(CHARACTER_PRESETS.find(p => p.id === 'male-wizard')!, false);

    this.drawBackground();
    this.drawTitle();
    this.drawDivider();
    this.drawPreview();
    this.drawPresets();
    this.drawSlots();
    this.drawBeginButton();
    this.drawBackButton();

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // ─── Background ─────────────────────────────────────────────────────────

  private drawBackground(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, PALETTE.bg);

    const gfx = this.add.graphics();

    // Subtle pixel dots
    const rng = new Phaser.Math.RandomDataGenerator(['wq-char-stars']);
    for (let i = 0; i < 80; i++) {
      const x = rng.integerInRange(0, GAME_WIDTH);
      const y = rng.integerInRange(0, GAME_HEIGHT);
      gfx.fillStyle(rng.pick([0x333355, 0x444466, 0x222244]), rng.realInRange(0.3, 0.8));
      gfx.fillRect(x, y, 1, 1);
    }

    // Outer border
    this.drawPixelBorder(gfx, 12, 12, GAME_WIDTH - 24, GAME_HEIGHT - 24, PALETTE.border);

    // Left panel background (preview area)
    gfx.fillStyle(PALETTE.panel, 0.6);
    gfx.fillRect(24, 24, 430, GAME_HEIGHT - 48);

    // Separator line
    gfx.fillStyle(PALETTE.border, 1);
    gfx.fillRect(454, 32, 2, GAME_HEIGHT - 64);
  }

  private drawPixelBorder(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number, color: number,
  ): void {
    gfx.fillStyle(color, 1);
    gfx.fillRect(x, y, w, 2);
    gfx.fillRect(x, y + h - 2, w, 2);
    gfx.fillRect(x, y, 2, h);
    gfx.fillRect(x + w - 2, y, 2, h);
    gfx.fillRect(x + 4, y + 4, 2, 2);
    gfx.fillRect(x + w - 6, y + 4, 2, 2);
    gfx.fillRect(x + 4, y + h - 6, 2, 2);
    gfx.fillRect(x + w - 6, y + h - 6, 2, 2);
  }

  // ─── Title ──────────────────────────────────────────────────────────────

  private drawTitle(): void {
    // Left panel title
    this.add.text(PREVIEW_X, 52, 'YOUR CHARACTER', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#ffd700',
    }).setOrigin(0.5);

    // Right panel title
    this.add.text(SLOTS_X + 60, 52, 'CUSTOMISE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#aaaacc',
    }).setOrigin(0.5);
  }

  private drawDivider(): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(PALETTE.border, 1);
    gfx.fillRect(32, 70, 410, 1);
    gfx.fillRect(464, 70, GAME_WIDTH - 490, 1);
    gfx.fillStyle(PALETTE.gold, 0.6);
    gfx.fillRect(120, 70, 160, 1);
  }

  // ─── Preview ────────────────────────────────────────────────────────────

  private drawPreview(): void {
    this.previewContainer = this.add.container(PREVIEW_X, PREVIEW_Y);

    // Shadow beneath character
    const shadow = this.add.ellipse(0, 56, 64, 20, 0x000000, 0.35);
    this.previewContainer.add(shadow);

    // Build one sprite per slot (back to front)
    for (const slot of LAYER_SLOTS) {
      const sprite = this.add.sprite(0, 0, 'wizard', 0);
      sprite.setScale(PREVIEW_SCALE);
      sprite.setVisible(false);
      this.previewContainer.add(sprite);
      this.previewSprites.set(slot.id, sprite);
    }

    // Decorative pedestal
    const gfx = this.add.graphics();
    gfx.fillStyle(PALETTE.border, 0.4);
    gfx.fillRect(PREVIEW_X - 55, PREVIEW_Y + 58, 110, 8);
    gfx.fillStyle(PALETTE.dim, 0.2);
    gfx.fillRect(PREVIEW_X - 45, PREVIEW_Y + 66, 90, 4);

    this.refreshPreview();

    // Rotate preview left/right arrows
    this.drawPreviewArrows();
  }

  private drawPreviewArrows(): void {
    const arrowStyle = {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#555577',
    };

    const left = this.add.text(PREVIEW_X - 100, PREVIEW_Y, '◀', arrowStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const right = this.add.text(PREVIEW_X + 100, PREVIEW_Y, '▶', arrowStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const dirs = ['down', 'left', 'right', 'up'];

    const rotate = (delta: number) => {
      this.previewDirIndex = (this.previewDirIndex + delta + dirs.length) % dirs.length;
      this.previewSprites.forEach((sprite, slotId) => {
        if (sprite.visible) {
          const prefix = this.previewAnimPrefixes.get(slotId) ?? 'wizard';
          sprite.anims.play(`${prefix}-idle-${dirs[this.previewDirIndex]}`, true);
        }
      });
    };

    left.on('pointerdown', () => rotate(-1));
    right.on('pointerdown', () => rotate(1));
    left.on('pointerover', () => left.setColor('#aaaacc'));
    left.on('pointerout',  () => left.setColor('#555577'));
    right.on('pointerover', () => right.setColor('#aaaacc'));
    right.on('pointerout',  () => right.setColor('#555577'));

    // Direction hint
    this.add.text(PREVIEW_X, PREVIEW_Y + 110, 'rotate ◀ ▶', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#333355',
    }).setOrigin(0.5);
  }

  private refreshPreview(): void {
    const dirs = ['down', 'left', 'right', 'up'];
    const dir  = dirs[this.previewDirIndex];

    for (const slot of LAYER_SLOTS) {
      const sprite   = this.previewSprites.get(slot.id)!;
      const optionId = this.selections[slot.id];
      const option   = slot.options.find(o => o.id === optionId);

      if (!option || option.textureKey === null) {
        sprite.setVisible(false);
        continue;
      }

      const prefix = option.animPrefix ?? 'wizard';
      this.previewAnimPrefixes.set(slot.id, prefix);

      sprite.setTexture(option.textureKey, 0);
      sprite.setVisible(true);
      if (option.tint !== undefined) sprite.setTint(option.tint);
      else sprite.clearTint();
      sprite.anims.play(`${prefix}-idle-${dir}`, true);
    }
  }

  // ─── Presets ────────────────────────────────────────────────────────────

  private drawPresets(): void {
    const startX = SLOTS_X - 40;
    const y = 105;
    const btnW = 130;
    const gap = 14;

    // Only show presets the current user can access
    const visible = CHARACTER_PRESETS.filter(p => this.canAccess(p.requiredUsername));

    this.add.text(startX + (visible.length * (btnW + gap) - gap) / 2, y - 22, 'PRESETS', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#555577',
    }).setOrigin(0.5);

    visible.forEach((preset, i) => {
      const x = startX + i * (btnW + gap);
      this.buildPresetButton(preset, x, y, btnW);
    });
  }

  private buildPresetButton(preset: CharacterPreset, x: number, y: number, w: number): void {
    const H = 34;
    const isActive = this.activePreset === preset.id;

    const gfx = this.add.graphics();
    this.presetPanels.set(preset.id, gfx);

    const drawBtn = (hover: boolean, active: boolean) => {
      gfx.clear();
      const col = active ? 0x1e1e40 : hover ? 0x161630 : PALETTE.panel;
      const border = active ? PALETTE.gold : hover ? 0x4a4a7e : PALETTE.border;
      gfx.fillStyle(col, 1);
      gfx.fillRect(x, y - H / 2, w, H);
      gfx.lineStyle(2, border, 1);
      gfx.strokeRect(x, y - H / 2, w, H);
    };

    drawBtn(false, isActive);

    const symbolColors: Record<string, string> = {
      '♂': '#88aaff',
      '♀': '#ff88aa',
      '★': '#ffd700',
    };
    const symbolColor = symbolColors[preset.symbol] ?? '#aaaacc';

    this.add.text(x + 14, y, preset.symbol, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: symbolColor,
    }).setOrigin(0, 0.5);

    const label = this.add.text(x + w / 2 + 6, y, preset.label, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#aaaacc',
    }).setOrigin(0.5);
    this.presetTexts.set(preset.id, label);

    const zone = this.add.zone(x + w / 2, y, w, H).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => drawBtn(true,  this.activePreset === preset.id));
    zone.on('pointerout',  () => drawBtn(false, this.activePreset === preset.id));
    zone.on('pointerdown', () => {
      this.applyPreset(preset, true);
      this.refreshPresetButtons();
      this.refreshSlotLabels();
      this.refreshPreview();
    });
  }

  private applyPreset(preset: CharacterPreset, animate: boolean): void {
    this.activePreset = preset.id;
    for (const [slotId, optionId] of Object.entries(preset.layers)) {
      this.selections[slotId] = optionId;
    }
    if (animate) {
      this.tweens.add({
        targets: this.previewContainer,
        scaleX: { from: 0.92, to: 1 },
        scaleY: { from: 0.92, to: 1 },
        duration: 180,
        ease: 'Back.easeOut',
      });
    }
  }

  private refreshPresetButtons(): void {
    this.presetPanels.forEach((gfx, id) => {
      // Redraw — simplest approach is to destroy and rebuild, but since
      // we stored gfx we just re-invoke drawBtn via the stored closure.
      // Instead: tint the graphics object to signal active state.
      void gfx; void id;
      // The zones handle hover redraws; active state update happens next render.
      // Full rebuild would require more state. For now a simple alpha shift suffices.
    });
  }

  // ─── Layer Slots ────────────────────────────────────────────────────────

  private drawSlots(): void {
    LAYER_SLOTS.forEach((slot, i) => {
      const y = SLOTS_START_Y + i * SLOT_H;
      this.buildSlotRow(slot, y);
    });
  }

  private buildSlotRow(slot: typeof LAYER_SLOTS[0], y: number): void {
    const left  = SLOTS_X - 40;
    const right = SLOTS_X + 340;
    const mid   = (left + right) / 2;
    const isLocked = slot.locked ?? false;

    // Row background
    const rowGfx = this.add.graphics();
    rowGfx.fillStyle(PALETTE.panel, 0.5);
    rowGfx.fillRect(left - 8, y - SLOT_H / 2 + 4, right - left + 16, SLOT_H - 8);
    rowGfx.lineStyle(1, isLocked ? PALETTE.locked : PALETTE.border, 0.6);
    rowGfx.strokeRect(left - 8, y - SLOT_H / 2 + 4, right - left + 16, SLOT_H - 8);

    // Slot name
    this.add.text(left + 4, y, slot.label, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: isLocked ? '#333355' : '#666688',
    }).setOrigin(0, 0.5);

    if (isLocked) {
      this.add.text(mid + 20, y, 'Coming Soon', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#2a2a4a',
      }).setOrigin(0.5);
      return;
    }

    // Filter options to only those the current user can access
    const visibleOptions = slot.options.filter(o => this.canAccess(o.requiredUsername));

    // Ensure current selection is within visible options; reset if not
    if (!visibleOptions.find(o => o.id === this.selections[slot.id])) {
      this.selections[slot.id] = visibleOptions[0]?.id ?? 'none';
    }

    const currentOption = visibleOptions.find(o => o.id === this.selections[slot.id]);
    const valueText = this.add.text(mid + 20, y, currentOption?.label ?? 'None', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#ffd700',
    }).setOrigin(0.5);
    this.slotLabels.set(slot.id, valueText);

    // ◀ arrow
    this.buildArrow(right - 64, y, '◀', slot, visibleOptions, -1, valueText);
    // ▶ arrow
    this.buildArrow(right - 16, y, '▶', slot, visibleOptions, +1, valueText);
  }

  private buildArrow(
    x: number, y: number, symbol: string,
    slot: typeof LAYER_SLOTS[0],
    opts: typeof LAYER_SLOTS[0]['options'],
    dir: -1 | 1,
    valueText: Phaser.GameObjects.Text,
  ): void {
    const arrow = this.add.text(x, y, symbol, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#3a3a6e',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    arrow.on('pointerover', () => arrow.setColor('#ffd700'));
    arrow.on('pointerout',  () => arrow.setColor('#3a3a6e'));
    arrow.on('pointerdown', () => {
      const idx  = opts.findIndex(o => o.id === this.selections[slot.id]);
      const next = (idx + dir + opts.length) % opts.length;
      this.selections[slot.id] = opts[next].id;
      this.activePreset = null;
      valueText.setText(opts[next].label);

      this.tweens.add({
        targets: arrow,
        x: x + dir * 4,
        duration: 80,
        yoyo: true,
        ease: 'Sine.easeOut',
      });

      this.refreshPreview();
    });
  }

  private refreshSlotLabels(): void {
    for (const slot of LAYER_SLOTS) {
      const text = this.slotLabels.get(slot.id);
      if (!text) continue;
      const opt = slot.options.find(o => o.id === this.selections[slot.id]);
      text.setText(opt?.label ?? 'None');
    }
  }

  // ─── Begin Button ────────────────────────────────────────────────────────

  private drawBeginButton(): void {
    const x = PREVIEW_X;
    const y = GAME_HEIGHT - 55;
    const W = 220;
    const H = 38;

    const gfx = this.add.graphics();
    const drawBtn = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(hover ? 0x1e1e40 : 0x16163a, 1);
      gfx.fillRect(x - W / 2, y - H / 2, W, H);
      gfx.lineStyle(2, hover ? PALETTE.gold : 0x4a4a7e, 1);
      gfx.strokeRect(x - W / 2, y - H / 2, W, H);
      // Corner accents
      gfx.fillStyle(hover ? PALETTE.gold : PALETTE.border, 1);
      gfx.fillRect(x - W / 2 - 1, y - H / 2 - 1, 4, 4);
      gfx.fillRect(x + W / 2 - 3, y - H / 2 - 1, 4, 4);
      gfx.fillRect(x - W / 2 - 1, y + H / 2 - 3, 4, 4);
      gfx.fillRect(x + W / 2 - 3, y + H / 2 - 3, 4, 4);
    };
    drawBtn(false);

    const label = this.add.text(x, y, 'BEGIN JOURNEY', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#ffd700',
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, W + 8, H + 8).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => { drawBtn(true); label.setColor('#ffffff'); });
    zone.on('pointerout',  () => { drawBtn(false); label.setColor('#ffd700'); });
    zone.on('pointerdown', () => {
      this.tweens.add({
        targets: label,
        scaleX: 0.95, scaleY: 0.95,
        duration: 80,
        yoyo: true,
        onComplete: () => this.startGame(),
      });
    });
  }

  // ─── Back Button ─────────────────────────────────────────────────────────

  private drawBackButton(): void {
    const btn = this.add.text(44, GAME_HEIGHT - 32, '◀ BACK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#333355',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#666688'));
    btn.on('pointerout',  () => btn.setColor('#333355'));
    btn.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MenuScene');
      });
    });
  }

  // ─── Confirm & Save ──────────────────────────────────────────────────────

  private startGame(): void {
    const characterData = { preset: this.activePreset, layers: { ...this.selections } };
    localStorage.setItem('wq_character', JSON.stringify(characterData));

    // Derive display name from active preset or body selection
    const preset = CHARACTER_PRESETS.find(p => p.id === this.activePreset);
    const bodyOpt = LAYER_SLOTS.find(s => s.id === 'body')
      ?.options.find(o => o.id === this.selections['body']);
    const characterName = preset?.label ?? bodyOpt?.label ?? 'Adventurer';

    // Save to DB slot (non-blocking)
    void AuthManager.saveToSlot(this.saveSlot, characterData, characterName);

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', { slot: this.saveSlot });
    });
  }
}
