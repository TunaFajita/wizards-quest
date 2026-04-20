import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@shared/renderConstants';
import { AuthManager } from '../systems/AuthManager';

// ─── Layout ──────────────────────────────────────────────────────────────────
const CX = GAME_WIDTH  / 2;
const CY = GAME_HEIGHT / 2;
const PANEL_W = 380;
const PANEL_H = 310;
const PANEL_X = CX - PANEL_W / 2;
const PANEL_Y = CY - PANEL_H / 2 + 20;

const PALETTE = {
  bg:       0x0a0a1e,
  panel:    0x10102a,
  border:   0x3a3a6e,
  gold:     0xffd700,
  white:    0xffffff,
  dim:      0x555577,
  error:    0xff5555,
  success:  0x44cc88,
  inputBg:  0x0d0d22,
  inputFoc: 0x181838,
};

type Mode = 'login' | 'signup';

// ─── Scene ───────────────────────────────────────────────────────────────────
export class AuthScene extends Phaser.Scene {
  private mode: Mode = 'login';

  // Input state
  private activeField: 'username' | 'password' | null = null;
  private usernameVal = '';
  private passwordVal = '';
  private keyListener!: (e: KeyboardEvent) => void;

  // Dynamic display objects
  private usernameText!: Phaser.GameObjects.Text;
  private passwordText!: Phaser.GameObjects.Text;
  private usernameCursor!: Phaser.GameObjects.Text;
  private passwordCursor!: Phaser.GameObjects.Text;
  private usernameBg!: Phaser.GameObjects.Graphics;
  private passwordBg!: Phaser.GameObjects.Graphics;
  private errorText!: Phaser.GameObjects.Text;
  private submitLabel!: Phaser.GameObjects.Text;
  private tabLogin!: Phaser.GameObjects.Text;
  private tabSignup!: Phaser.GameObjects.Text;
  private tabUnderline!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private cursorBlink!: Phaser.Time.TimerEvent;
  private cursorVisible = true;
  private busy = false;

  constructor() {
    super({ key: 'AuthScene' });
  }

  create(): void {
    this.usernameVal = '';
    this.passwordVal = '';
    this.activeField = null;
    this.busy        = false;

    this.drawBackground();
    this.drawPanel();
    this.drawTabs();
    this.drawFormFields();
    this.drawSubmitButton();

    this.setupKeyboard();
    this.startCursorBlink();

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  shutdown(): void {
    window.removeEventListener('keydown', this.keyListener);
    this.cursorBlink?.destroy();
  }

  // ─── Background ────────────────────────────────────────────────────────────

  private drawBackground(): void {
    this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, PALETTE.bg);

    const gfx = this.add.graphics();
    const rng  = new Phaser.Math.RandomDataGenerator(['wq-auth']);
    for (let i = 0; i < 100; i++) {
      const x = rng.integerInRange(0, GAME_WIDTH);
      const y = rng.integerInRange(0, GAME_HEIGHT);
      gfx.fillStyle(rng.pick([0x222244, 0x333366, 0x444488]), rng.realInRange(0.3, 0.9));
      gfx.fillRect(x, y, 1, 1);
    }

    // Outer frame
    gfx.lineStyle(2, PALETTE.border, 1);
    gfx.strokeRect(12, 12, GAME_WIDTH - 24, GAME_HEIGHT - 24);

    // Game title top
    const title = this.add.text(CX, 38, "WIZARD'S QUEST", {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#ffd700',
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, alpha: { from: 1, to: 0.8 }, duration: 900, yoyo: true, repeat: -1 });

    this.add.text(CX, 62, 'your journey awaits', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#333355',
    }).setOrigin(0.5);
  }

  // ─── Panel ─────────────────────────────────────────────────────────────────

  private drawPanel(): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(PALETTE.panel, 1);
    gfx.fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
    gfx.lineStyle(2, PALETTE.border, 1);
    gfx.strokeRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
    // Corner accents
    gfx.fillStyle(PALETTE.border, 1);
    [[0,0],[PANEL_W-4,0],[0,PANEL_H-4],[PANEL_W-4,PANEL_H-4]].forEach(([ox,oy]) => {
      gfx.fillRect(PANEL_X + ox, PANEL_Y + oy, 4, 4);
    });
  }

  // ─── Tabs ──────────────────────────────────────────────────────────────────

  private drawTabs(): void {
    const tabY = PANEL_Y + 26;

    this.tabLogin = this.add.text(CX - 60, tabY, 'LOG IN', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#ffd700',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.tabSignup = this.add.text(CX + 60, tabY, 'SIGN UP', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#444466',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.tabUnderline = this.add.graphics();
    this.drawTabUnderline();

    this.tabLogin.on('pointerdown', () => this.switchMode('login'));
    this.tabSignup.on('pointerdown', () => this.switchMode('signup'));

    // Divider below tabs
    const divGfx = this.add.graphics();
    divGfx.fillStyle(PALETTE.border, 1);
    divGfx.fillRect(PANEL_X + 12, PANEL_Y + 42, PANEL_W - 24, 1);

    // Dynamic title text (LOG IN / CREATE ACCOUNT)
    this.titleText = this.add.text(CX, PANEL_Y + 60, 'WELCOME BACK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#888899',
    }).setOrigin(0.5);
  }

  private drawTabUnderline(): void {
    this.tabUnderline.clear();
    this.tabUnderline.fillStyle(PALETTE.gold, 1);
    const x = this.mode === 'login' ? CX - 60 : CX + 60;
    this.tabUnderline.fillRect(x - 28, PANEL_Y + 34, 56, 2);
  }

  private switchMode(mode: Mode): void {
    if (this.mode === mode || this.busy) return;
    this.mode = mode;

    this.usernameVal = '';
    this.passwordVal = '';
    this.activeField = null;
    this.errorText.setText('');
    this.refreshInputDisplay();

    this.tabLogin.setColor(mode === 'login' ? '#ffd700' : '#444466');
    this.tabSignup.setColor(mode === 'signup' ? '#ffd700' : '#444466');
    this.drawTabUnderline();
    this.titleText.setText(mode === 'login' ? 'WELCOME BACK' : 'CREATE ACCOUNT');
    this.submitLabel.setText(mode === 'login' ? 'ENTER THE REALM' : 'BEGIN YOUR LEGEND');
    this.refreshFieldBorders();
  }

  // ─── Form fields ───────────────────────────────────────────────────────────

  private drawFormFields(): void {
    const fieldW = PANEL_W - 48;
    const fieldH = 30;
    const lx     = PANEL_X + 24;

    // ── Username ──
    const uy = PANEL_Y + 92;
    this.add.text(lx, uy - 14, 'USERNAME', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#555577',
    });

    this.usernameBg = this.add.graphics();
    this.drawFieldBg(this.usernameBg, lx, uy, fieldW, fieldH, false);

    this.usernameText = this.add.text(lx + 8, uy + fieldH / 2, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#ffffff',
    }).setOrigin(0, 0.5);

    this.usernameCursor = this.add.text(lx + 8, uy + fieldH / 2, '|', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#ffd700',
    }).setOrigin(0, 0.5).setAlpha(0);

    const uZone = this.add.zone(lx + fieldW / 2, uy + fieldH / 2, fieldW, fieldH)
      .setInteractive({ useHandCursor: true });
    uZone.on('pointerdown', () => this.focusField('username'));

    // ── Password ──
    const py = PANEL_Y + 162;
    this.add.text(lx, py - 14, 'PASSWORD', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#555577',
    });

    this.passwordBg = this.add.graphics();
    this.drawFieldBg(this.passwordBg, lx, py, fieldW, fieldH, false);

    this.passwordText = this.add.text(lx + 8, py + fieldH / 2, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#ffffff',
    }).setOrigin(0, 0.5);

    this.passwordCursor = this.add.text(lx + 8, py + fieldH / 2, '|', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#ffd700',
    }).setOrigin(0, 0.5).setAlpha(0);

    const pZone = this.add.zone(lx + fieldW / 2, py + fieldH / 2, fieldW, fieldH)
      .setInteractive({ useHandCursor: true });
    pZone.on('pointerdown', () => this.focusField('password'));

    // ── Error text ──
    this.errorText = this.add.text(CX, PANEL_Y + 218, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#ff5555',
      wordWrap: { width: PANEL_W - 32 },
      align: 'center',
    }).setOrigin(0.5);
  }

  private drawFieldBg(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    focused: boolean,
  ): void {
    gfx.clear();
    gfx.fillStyle(focused ? PALETTE.inputFoc : PALETTE.inputBg, 1);
    gfx.fillRect(x, y, w, h);
    gfx.lineStyle(1, focused ? PALETTE.gold : PALETTE.border, 1);
    gfx.strokeRect(x, y, w, h);
  }

  private focusField(field: 'username' | 'password'): void {
    this.activeField = field;
    this.refreshFieldBorders();
  }

  private refreshFieldBorders(): void {
    const lx    = PANEL_X + 24;
    const fieldW = PANEL_W - 48;
    const fieldH = 30;
    this.drawFieldBg(this.usernameBg, lx, PANEL_Y + 92, fieldW, fieldH, this.activeField === 'username');
    this.drawFieldBg(this.passwordBg, lx, PANEL_Y + 162, fieldW, fieldH, this.activeField === 'password');
  }

  private refreshInputDisplay(): void {
    this.usernameText.setText(this.usernameVal);
    this.passwordText.setText('•'.repeat(this.passwordVal.length));

    const uOff = this.usernameText.x + this.usernameText.width + 2;
    const pOff = this.passwordText.x + this.passwordText.width + 2;
    this.usernameCursor.setX(uOff);
    this.passwordCursor.setX(pOff);
  }

  // ─── Submit button ─────────────────────────────────────────────────────────

  private drawSubmitButton(): void {
    const y = PANEL_Y + PANEL_H - 36;
    const W = PANEL_W - 48;
    const H = 34;
    const x = CX;

    const gfx = this.add.graphics();
    const draw = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(hover ? 0x1e1e40 : 0x14142e, 1);
      gfx.fillRect(x - W / 2, y - H / 2, W, H);
      gfx.lineStyle(2, hover ? PALETTE.gold : 0x4a4a7e, 1);
      gfx.strokeRect(x - W / 2, y - H / 2, W, H);
    };
    draw(false);

    this.submitLabel = this.add.text(x, y, 'ENTER THE REALM', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#ffd700',
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, W + 8, H + 8).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => { draw(true); });
    zone.on('pointerout',  () => { draw(false); });
    zone.on('pointerdown', () => { void this.submit(); });
  }

  // ─── Keyboard ──────────────────────────────────────────────────────────────

  private setupKeyboard(): void {
    this.keyListener = (e: KeyboardEvent) => {
      if (this.busy || !this.activeField) return;

      const field = this.activeField;

      if (e.key === 'Tab') {
        e.preventDefault();
        this.focusField(field === 'username' ? 'password' : 'username');
        return;
      }

      if (e.key === 'Enter') {
        void this.submit();
        return;
      }

      if (e.key === 'Backspace') {
        if (field === 'username') this.usernameVal = this.usernameVal.slice(0, -1);
        else this.passwordVal = this.passwordVal.slice(0, -1);
        this.refreshInputDisplay();
        return;
      }

      // Printable characters
      if (e.key.length === 1) {
        if (field === 'username' && this.usernameVal.length < 20) {
          this.usernameVal += e.key;
        } else if (field === 'password' && this.passwordVal.length < 64) {
          this.passwordVal += e.key;
        }
        this.refreshInputDisplay();
      }
    };

    window.addEventListener('keydown', this.keyListener);
  }

  // ─── Cursor blink ──────────────────────────────────────────────────────────

  private startCursorBlink(): void {
    this.cursorBlink = this.time.addEvent({
      delay: 530,
      loop: true,
      callback: () => {
        this.cursorVisible = !this.cursorVisible;
        const alpha = this.cursorVisible ? 1 : 0;
        if (this.activeField === 'username') {
          this.usernameCursor.setAlpha(alpha);
          this.passwordCursor.setAlpha(0);
        } else if (this.activeField === 'password') {
          this.passwordCursor.setAlpha(alpha);
          this.usernameCursor.setAlpha(0);
        } else {
          this.usernameCursor.setAlpha(0);
          this.passwordCursor.setAlpha(0);
        }
      },
    });
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  private async submit(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.errorText.setColor('#888899').setText('...');

    const result = this.mode === 'login'
      ? await AuthManager.login(this.usernameVal, this.passwordVal)
      : await AuthManager.signUp(this.usernameVal, this.passwordVal);

    if (!result.ok) {
      this.errorText.setColor('#ff5555').setText(result.error);
      this.busy = false;

      // Shake the panel
      this.tweens.add({
        targets: this.cameras.main,
        scrollX: { from: -4, to: 4 },
        duration: 60,
        yoyo: true,
        repeat: 2,
        onComplete: () => this.cameras.main.setScroll(0, 0),
      });
      return;
    }

    this.errorText.setColor('#44cc88').setText(
      this.mode === 'login' ? `Welcome back, ${result.session.username}!` : `Account created!`
    );

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (this.mode === 'signup') {
        this.scene.start('CharacterScene');
      } else {
        this.scene.start('MenuScene');
      }
    });
  }
}
