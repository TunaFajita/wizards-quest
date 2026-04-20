import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@shared/renderConstants';
import { AuthManager } from '../systems/AuthManager';
import type { Session } from '../systems/AuthManager';

const BGM_KEY = 'wq_bgm_enabled';

const PALETTE = {
  bg:     0x0a0a1e,
  panel:  0x12122e,
  border: 0x3a3a6e,
  gold:   0xffd700,
  white:  0xffffff,
  dim:    0x888899,
  red:    0xff4444,
};

export class MenuScene extends Phaser.Scene {
  private bgmEnabled = true;
  private noteIcon!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.bgmEnabled = localStorage.getItem(BGM_KEY) !== 'false';

    // Use cached session to build UI immediately, then refresh in background
    const session = AuthManager.getSession();
    this.buildUI(session);

    // Refresh from server in background — rebuilds UI if hasSave changed
    void AuthManager.refreshSession().then(fresh => {
      if (fresh && fresh.hasSave !== session?.hasSave) {
        this.scene.restart();
      }
    });

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private buildUI(session: Session | null): void {
    this.drawBackground();
    this.drawTitle();
    this.drawButtons(session?.hasSave ?? false);
    this.drawNoteIcon();
    this.drawUserBadge(session);
    this.drawVersion();
  }

  // ─── Background ───────────────────────────────────────────────────────────

  private drawBackground(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, PALETTE.bg);

    const gfx = this.add.graphics();
    const rng = new Phaser.Math.RandomDataGenerator(['wq-stars']);
    for (let i = 0; i < 120; i++) {
      const x = rng.integerInRange(0, GAME_WIDTH);
      const y = rng.integerInRange(0, GAME_HEIGHT);
      const bright = rng.pick([0x444466, 0x666688, 0x9999bb, PALETTE.white]);
      gfx.fillStyle(bright, rng.realInRange(0.4, 1));
      gfx.fillRect(x, y, 1, 1);
    }

    this.drawPixelBorder(gfx, 12, 12, GAME_WIDTH - 24, GAME_HEIGHT - 24, PALETTE.border);
    this.drawPixelBorder(gfx, 16, 16, GAME_WIDTH - 32, GAME_HEIGHT - 32, 0x22224a);
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

  // ─── Title ────────────────────────────────────────────────────────────────

  private drawTitle(): void {
    const cx = GAME_WIDTH / 2;

    this.add.text(cx + 3, 93, "WIZARD'S QUEST", {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '28px',
      color: '#000000',
    }).setOrigin(0.5).setAlpha(0.6);

    const title = this.add.text(cx, 90, "WIZARD'S QUEST", {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '28px',
      color: '#ffd700',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: title,
      alpha: { from: 1, to: 0.85 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add.text(cx, 128, 'an isometric pixel rpg', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#666688',
    }).setOrigin(0.5);

    const div = this.add.graphics();
    div.fillStyle(PALETTE.border, 1);
    div.fillRect(cx - 160, 144, 320, 2);
    div.fillStyle(PALETTE.gold, 1);
    div.fillRect(cx - 80, 144, 160, 2);
    div.fillRect(cx - 4, 141, 8, 8);
    div.fillRect(cx - 2, 139, 4, 12);
  }

  // ─── Buttons ──────────────────────────────────────────────────────────────

  private drawButtons(hasSave: boolean): void {
    const cx     = GAME_WIDTH / 2;
    const gap    = 52;
    const startY = hasSave ? 192 : 220;

    const defs: { label: string; action: () => void; color?: number }[] = [];

    if (hasSave) {
      defs.push({ label: 'Resume Journey', action: () => this.resumeGame(), color: PALETTE.gold });
    }

    defs.push({ label: 'Start New Journey', action: () => this.startNewGame() });
    defs.push({ label: 'Settings',          action: () => this.openSettings() });
    defs.push({ label: 'Exit Game',         action: () => this.exitGame(), color: PALETTE.red });

    defs.forEach((def, i) => {
      new MenuButton(this, cx, startY + i * gap, def.label, def.action, def.color);
    });
  }

  // ─── BGM icon ─────────────────────────────────────────────────────────────

  private drawNoteIcon(): void {
    const x = GAME_WIDTH - 44;
    const y = 36;

    const bg = this.add.rectangle(x, y, 28, 28, PALETTE.panel)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, PALETTE.border);

    this.noteIcon = this.add.text(x, y, '♪', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: this.bgmEnabled ? '#ffd700' : '#444466',
    }).setOrigin(0.5).setDepth(10);

    const tip = this.add.text(x - 14, y + 20, 'BGM', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#444466',
    }).setOrigin(0.5).setDepth(10);

    const toggle = () => {
      this.bgmEnabled = !this.bgmEnabled;
      localStorage.setItem(BGM_KEY, String(this.bgmEnabled));
      this.noteIcon.setColor(this.bgmEnabled ? '#ffd700' : '#444466');
    };

    bg.on('pointerdown', toggle);
    bg.on('pointerover', () => { bg.setFillColor(0x1e1e40); tip.setColor('#888899'); });
    bg.on('pointerout',  () => { bg.setFillColor(PALETTE.panel); tip.setColor('#444466'); });
  }

  // ─── User badge — bottom right ────────────────────────────────────────────

  private drawUserBadge(session: Session | null): void {
    if (!session) return;

    const rx = GAME_WIDTH - 28;
    const ry = GAME_HEIGHT - 38;

    this.add.text(rx, ry, `▸ ${session.username}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#555577',
    }).setOrigin(1, 0.5);

    const logout = this.add.text(rx, ry + 16, 'log out', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#333355',
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

    logout.on('pointerover', () => logout.setColor('#ff5555'));
    logout.on('pointerout',  () => logout.setColor('#333355'));
    logout.on('pointerdown', () => {
      AuthManager.logout();
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('AuthScene'));
    });
  }

  // ─── Version — bottom left ────────────────────────────────────────────────

  private drawVersion(): void {
    this.add.text(28, GAME_HEIGHT - 30, 'v0.1.0', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#333355',
    }).setOrigin(0, 0.5);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  private startNewGame(): void {
    localStorage.removeItem('wq_character');
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('SlotSelectScene', { mode: 'new' });
    });
  }

  private resumeGame(): void {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('SlotSelectScene', { mode: 'resume' });
    });
  }

  private openSettings(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('SettingsScene', { returnTo: 'MenuScene' });
    });
  }

  private exitGame(): void {
    window.close();
  }
}

// ─── MenuButton ───────────────────────────────────────────────────────────────

class MenuButton {
  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    label: string,
    action: () => void,
    textColor: number = PALETTE.white,
  ) {
    const W = 260;
    const H = 36;

    const panel = scene.add.graphics();
    const drawPanel = (hover: boolean) => {
      panel.clear();
      panel.fillStyle(hover ? 0x1e1e40 : PALETTE.panel, 1);
      panel.fillRect(x - W / 2, y - H / 2, W, H);
      panel.lineStyle(2, hover ? PALETTE.gold : PALETTE.border, 1);
      panel.strokeRect(x - W / 2, y - H / 2, W, H);
      panel.fillStyle(hover ? PALETTE.gold : PALETTE.border, 1);
      panel.fillRect(x - W / 2 - 1, y - H / 2 - 1, 4, 4);
      panel.fillRect(x + W / 2 - 3, y - H / 2 - 1, 4, 4);
      panel.fillRect(x - W / 2 - 1, y + H / 2 - 3, 4, 4);
      panel.fillRect(x + W / 2 - 3, y + H / 2 - 3, 4, 4);
    };
    drawPanel(false);

    const arrow = scene.add.text(x - W / 2 + 12, y, '▶', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: Phaser.Display.Color.IntegerToColor(textColor).rgba,
    }).setOrigin(0, 0.5).setAlpha(0);

    const hex  = '#' + textColor.toString(16).padStart(6, '0');
    const text = scene.add.text(x, y, label, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '11px',
      color: hex,
    }).setOrigin(0.5);

    const zone = scene.add.zone(x, y, W + 8, H + 8).setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      drawPanel(true);
      text.setScale(1.04);
      arrow.setAlpha(1);
      scene.tweens.add({ targets: arrow, x: x - W / 2 + 16, duration: 120, ease: 'Sine.easeOut' });
    });
    zone.on('pointerout', () => {
      drawPanel(false);
      text.setScale(1);
      arrow.setAlpha(0);
      arrow.x = x - W / 2 + 12;
    });
    zone.on('pointerdown', () => {
      scene.tweens.add({
        targets: text,
        scaleX: 0.96, scaleY: 0.96,
        duration: 80,
        yoyo: true,
        onComplete: action,
      });
    });
  }
}
