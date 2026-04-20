import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@shared/renderConstants';
import { AuthManager } from '../systems/AuthManager';
import type { SlotData } from '../systems/AuthManager';
import { LAYER_SLOTS } from '../data/characterLayers';
import { drawStarfield } from '../ui/uiHelpers';

type SlotKey = 'A' | 'B' | 'C';
type Mode = 'new' | 'resume';

const PALETTE = {
  bg:       0x0a0a1e,
  panel:    0x10102a,
  border:   0x3a3a6e,
  gold:     0xffd700,
  white:    0xffffff,
  dim:      0x333355,
  hover:    0x1e1e40,
  red:      0xff4444,
  green:    0x44cc88,
  disabled: 0x22223a,
};

const CARD_W  = 220;
const CARD_H  = 270;
const CARD_Y  = GAME_HEIGHT / 2 + 10;
const GAP     = 30;
const TOTAL_W = 3 * CARD_W + 2 * GAP;
const START_X = (GAME_WIDTH - TOTAL_W) / 2;
const CENTERS = [
  START_X + CARD_W / 2,
  START_X + CARD_W + GAP + CARD_W / 2,
  START_X + 2 * (CARD_W + GAP) + CARD_W / 2,
];

export class SlotSelectScene extends Phaser.Scene {
  private mode: Mode = 'new';
  private slots: Record<SlotKey, SlotData | null> = { A: null, B: null, C: null };
  private confirmOverlay!: Phaser.GameObjects.Container;
  private pendingSlot: SlotKey | null = null;

  constructor() {
    super({ key: 'SlotSelectScene' });
  }

  init(data: { mode?: Mode }): void {
    this.mode = data?.mode ?? 'new';
  }

  async create(): Promise<void> {
    this.drawBackground();
    this.drawTitle();
    this.drawBackButton();

    // Load spinner while fetching
    const spinner = this.add.text(GAME_WIDTH / 2, CARD_Y, '...', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#333355',
    }).setOrigin(0.5);

    this.slots = await AuthManager.getSlots() as Record<SlotKey, SlotData | null>;
    spinner.destroy();

    (['A', 'B', 'C'] as SlotKey[]).forEach((key, i) => {
      this.buildCard(key, CENTERS[i], CARD_Y, this.slots[key]);
    });

    this.buildConfirmOverlay();
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  // ─── Background ──────────────────────────────────────────────────────────

  private drawBackground(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, PALETTE.bg);
    const gfx = this.add.graphics();
    drawStarfield(gfx, 'wq-slots', 90);
    gfx.lineStyle(2, PALETTE.border, 1);
    gfx.strokeRect(12, 12, GAME_WIDTH - 24, GAME_HEIGHT - 24);
  }

  private drawTitle(): void {
    const label = this.mode === 'new' ? 'SELECT A SLOT' : 'RESUME JOURNEY';
    this.add.text(GAME_WIDTH / 2, 52, label, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#ffd700',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 78, this.mode === 'new'
      ? 'choose where to save your new character'
      : 'select your character to continue',
    {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#333355',
    }).setOrigin(0.5);
  }

  // ─── Slot Card ───────────────────────────────────────────────────────────

  private buildCard(key: SlotKey, cx: number, cy: number, data: SlotData | null): void {
    const filled   = data !== null;
    const clickable = this.mode === 'new' || filled;

    // Card background
    const gfx = this.add.graphics();
    const drawCard = (hover: boolean) => {
      gfx.clear();
      const bg     = !clickable ? PALETTE.disabled : hover ? PALETTE.hover : PALETTE.panel;
      const border = !clickable ? PALETTE.dim : hover ? PALETTE.gold : filled ? 0x5a5a9e : PALETTE.border;
      gfx.fillStyle(bg, 1);
      gfx.fillRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H);
      gfx.lineStyle(2, border, 1);
      gfx.strokeRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H);
      // Corner accents
      gfx.fillStyle(border, 1);
      [[-1,-1],[CARD_W-3,-1],[-1,CARD_H-3],[CARD_W-3,CARD_H-3]].forEach(([ox, oy]) => {
        gfx.fillRect(cx - CARD_W / 2 + ox, cy - CARD_H / 2 + oy, 4, 4);
      });
    };
    drawCard(false);

    // Slot letter badge
    const badgeColor = filled ? '#ffd700' : '#333355';
    this.add.text(cx, cy - CARD_H / 2 + 22, `SLOT  ${key}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: badgeColor,
    }).setOrigin(0.5);

    // Divider
    const div = this.add.graphics();
    div.fillStyle(filled ? PALETTE.border : PALETTE.dim, 0.6);
    div.fillRect(cx - CARD_W / 2 + 16, cy - CARD_H / 2 + 38, CARD_W - 32, 1);

    if (filled && data) {
      this.buildFilledCard(key, cx, cy, data);
    } else {
      this.buildEmptyCard(cx, cy, clickable);
    }

    // Hit zone
    if (clickable) {
      const zone = this.add.zone(cx, cy, CARD_W - 4, CARD_H - 4).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => drawCard(true));
      zone.on('pointerout',  () => drawCard(false));
      zone.on('pointerdown', () => this.onCardClick(key, filled));
    }
  }

  private buildFilledCard(key: SlotKey, cx: number, cy: number, data: SlotData): void {
    // Character sprite preview
    const bodyId  = data.characterData.layers?.['body'];
    const bodyOpt = LAYER_SLOTS.find(s => s.id === 'body')?.options.find(o => o.id === bodyId);
    if (bodyOpt?.textureKey && bodyOpt.animPrefix) {
      const sprite = this.add.sprite(cx, cy - 30, bodyOpt.textureKey, 0);
      sprite.setScale(2);
      sprite.anims.play(`${bodyOpt.animPrefix}-idle-down`, true);
    }

    // Character name
    this.add.text(cx, cy + 72, data.characterName, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#aaaacc',
    }).setOrigin(0.5);

    // Date
    const date = new Date(data.updatedAt).toLocaleDateString();
    this.add.text(cx, cy + 90, date, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#333355',
    }).setOrigin(0.5);

    // Action label
    const actionLabel = this.mode === 'new' ? '⚠ OVERWRITE' : '▶ PLAY';
    const actionColor = this.mode === 'new' ? '#ff6666' : '#44cc88';
    this.add.text(cx, cy + CARD_H / 2 - 22, actionLabel, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: actionColor,
    }).setOrigin(0.5);
  }

  private buildEmptyCard(cx: number, cy: number, clickable: boolean): void {
    this.add.text(cx, cy - 10, 'EMPTY', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: clickable ? '#333355' : '#222233',
    }).setOrigin(0.5);

    if (clickable && this.mode === 'new') {
      this.add.text(cx, cy + CARD_H / 2 - 22, '+ START HERE', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#44cc88',
      }).setOrigin(0.5);
    }
  }

  // ─── Card click handler ───────────────────────────────────────────────────

  private onCardClick(key: SlotKey, filled: boolean): void {
    if (this.mode === 'resume') {
      if (!filled) return;
      this.loadSlotAndPlay(key);
    } else {
      if (filled) {
        this.showConfirm(key);
      } else {
        this.goToCharacter(key);
      }
    }
  }

  private loadSlotAndPlay(key: SlotKey): void {
    const data = this.slots[key];
    if (!data) return;
    localStorage.setItem('wq_character', JSON.stringify(data.characterData));
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', { slot: key });
    });
  }

  private goToCharacter(key: SlotKey): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('CharacterScene', { slot: key });
    });
  }

  // ─── Confirm overwrite overlay ────────────────────────────────────────────

  private buildConfirmOverlay(): void {
    this.confirmOverlay = this.add.container(0, 0).setVisible(false).setDepth(100);

    // Dim background
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    this.confirmOverlay.add(dim);

    const DW = 340;
    const DH = 160;
    const DX = GAME_WIDTH  / 2;
    const DY = GAME_HEIGHT / 2;

    // Dialog box
    const box = this.add.graphics();
    box.fillStyle(PALETTE.panel, 1);
    box.fillRect(DX - DW / 2, DY - DH / 2, DW, DH);
    box.lineStyle(2, PALETTE.border, 1);
    box.strokeRect(DX - DW / 2, DY - DH / 2, DW, DH);
    this.confirmOverlay.add(box);

    const titleText = this.add.text(DX, DY - 44, 'OVERWRITE SLOT ?', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#ff6666',
    }).setOrigin(0.5);
    this.confirmOverlay.add(titleText);

    this.confirmOverlay.add(this.add.text(DX, DY - 20, 'This will delete your existing character.', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#555577',
      wordWrap: { width: DW - 32 },
      align: 'center',
    }).setOrigin(0.5));

    // YES button
    this.buildDialogBtn(DX - 80, DY + 36, 'YES, OVERWRITE', '#ff4444', () => {
      if (this.pendingSlot) this.goToCharacter(this.pendingSlot);
      this.hideConfirm();
    });

    // NO button
    this.buildDialogBtn(DX + 80, DY + 36, 'CANCEL', '#aaaacc', () => this.hideConfirm());

    // Store title ref to update slot letter dynamically
    (this.confirmOverlay as any)._title = titleText;
  }

  private buildDialogBtn(x: number, y: number, label: string, color: string, action: () => void): void {
    const W = 140;
    const H = 30;
    const gfx = this.add.graphics();
    this.confirmOverlay.add(gfx);

    const draw = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(hover ? 0x1e1e40 : PALETTE.panel, 1);
      gfx.fillRect(x - W / 2, y - H / 2, W, H);
      gfx.lineStyle(1, hover ? PALETTE.gold : PALETTE.border, 1);
      gfx.strokeRect(x - W / 2, y - H / 2, W, H);
    };
    draw(false);

    const txt = this.add.text(x, y, label, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color,
    }).setOrigin(0.5);
    this.confirmOverlay.add(txt);

    const zone = this.add.zone(x, y, W, H).setInteractive({ useHandCursor: true });
    this.confirmOverlay.add(zone);
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout',  () => draw(false));
    zone.on('pointerdown', action);
  }

  private showConfirm(slot: SlotKey): void {
    this.pendingSlot = slot;
    const title = (this.confirmOverlay as any)._title as Phaser.GameObjects.Text;
    title.setText(`OVERWRITE SLOT ${slot}?`);
    this.confirmOverlay.setVisible(true);
  }

  private hideConfirm(): void {
    this.confirmOverlay.setVisible(false);
    this.pendingSlot = null;
  }

  // ─── Back button ─────────────────────────────────────────────────────────

  private drawBackButton(): void {
    const btn = this.add.text(44, GAME_HEIGHT - 32, '◀ BACK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#333355',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#666688'));
    btn.on('pointerout',  () => btn.setColor('#333355'));
    btn.on('pointerdown', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
    });
  }
}
