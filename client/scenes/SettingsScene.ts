import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@shared/renderConstants';
import { SettingsManager, GameSettings } from '../systems/SettingsManager';

const P = {
  bg:     0x0a0a1e,
  panel:  0x12122e,
  border: 0x3a3a6e,
  gold:   0xffd700,
  white:  0xffffff,
  dim:    0x555577,
  red:    0xff4444,
  active: 0x1e1e40,
};

type Tab = 'audio' | 'graphics' | 'keybinds';
const TABS: Tab[] = ['audio', 'graphics', 'keybinds'];
const TAB_LABELS: Record<Tab, string> = { audio: 'AUDIO', graphics: 'GRAPHICS', keybinds: 'KEYBINDS' };

export class SettingsScene extends Phaser.Scene {
  private settings!: GameSettings;
  private returnTo  = 'MenuScene';
  private activeTab: Tab = 'audio';

  // Tab button references for re-styling on switch
  private tabBgs:   Phaser.GameObjects.Rectangle[] = [];
  private tabTxts:  Phaser.GameObjects.Text[]      = [];
  private tabZones: Phaser.GameObjects.Zone[]      = [];

  // Content objects — destroyed on each tab switch
  private contentObjects: Phaser.GameObjects.GameObject[] = [];

  // Keybind rebinding state
  private listeningBind: keyof GameSettings['keybinds'] | null = null;
  private keyListener!: (e: KeyboardEvent) => void;

  constructor() { super({ key: 'SettingsScene' }); }

  init(data: { returnTo?: string }): void {
    this.returnTo      = data?.returnTo ?? 'MenuScene';
    this.activeTab     = 'audio';
    this.listeningBind = null;
  }

  create(): void {
    this.settings = {
      audio:    { ...SettingsManager.audio },
      graphics: { ...SettingsManager.graphics },
      keybinds: { ...SettingsManager.keybinds },
    };
    this.tabBgs   = [];
    this.tabTxts  = [];
    this.tabZones = [];
    this.contentObjects = [];

    this.drawBackground();
    this.drawTitle();
    this.drawTabs();
    this.drawContent();
    this.drawBackButton();

    // Window-level key listener for rebinding
    this.keyListener = (e: KeyboardEvent) => {
      if (!this.listeningBind) return;
      if (e.key === 'Escape') { this.stopListening(); return; }
      const name = SettingsManager.keyEventToName(e.key);
      if (!name) return;
      this.settings.keybinds[this.listeningBind] = name;
      this.stopListening();
      this.refreshContent();
    };
    window.addEventListener('keydown', this.keyListener);
    this.cameras.main.fadeIn(200, 0, 0, 0);
  }

  shutdown(): void {
    window.removeEventListener('keydown', this.keyListener);
  }

  // ─── Background ─────────────────────────────────────────────────────────────

  private drawBackground(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, P.bg);
    const gfx = this.add.graphics();
    const rng = new Phaser.Math.RandomDataGenerator(['wq-settings']);
    for (let i = 0; i < 80; i++) {
      gfx.fillStyle(rng.pick([0x333355, 0x444466, 0x666688]), rng.realInRange(0.3, 0.8));
      gfx.fillRect(rng.integerInRange(0, GAME_WIDTH), rng.integerInRange(0, GAME_HEIGHT), 1, 1);
    }
    gfx.fillStyle(P.border, 1);
    gfx.fillRect(12, 12, GAME_WIDTH - 24, 2);
    gfx.fillRect(12, GAME_HEIGHT - 14, GAME_WIDTH - 24, 2);
    gfx.fillRect(12, 12, 2, GAME_HEIGHT - 24);
    gfx.fillRect(GAME_WIDTH - 14, 12, 2, GAME_HEIGHT - 24);
  }

  private drawTitle(): void {
    this.add.text(GAME_WIDTH / 2, 44, 'SETTINGS', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px', color: '#ffd700',
    }).setOrigin(0.5);
    const gfx = this.add.graphics();
    gfx.fillStyle(P.border, 1);
    gfx.fillRect(GAME_WIDTH / 2 - 140, 66, 280, 2);
  }

  // ─── Tabs ────────────────────────────────────────────────────────────────────
  // Tabs are drawn once and re-styled in place — no scene restart needed.

  private drawTabs(): void {
    const tabW   = 110;
    const tabH   = 28;
    const startX = GAME_WIDTH / 2 - (TABS.length * tabW) / 2 + tabW / 2;
    const y      = 90;

    TABS.forEach((tab, i) => {
      const x        = startX + i * tabW;
      const isActive = tab === this.activeTab;

      const bg = this.add.rectangle(x, y, tabW - 4, tabH,
        isActive ? P.active : P.panel).setStrokeStyle(1, isActive ? P.gold : P.border);
      this.tabBgs.push(bg);

      const txt = this.add.text(x, y, TAB_LABELS[tab], {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: isActive ? '#ffd700' : '#888899',
      }).setOrigin(0.5);
      this.tabTxts.push(txt);

      // Overlay zone on top of rect+text — depth 100 ensures topOnly always picks these
      const zone = this.add.zone(x, y, tabW - 4, tabH)
        .setInteractive({ useHandCursor: true })
        .setDepth(100);
      this.tabZones.push(zone);
      zone.on('pointerover', () => {
        if (tab !== this.activeTab) { bg.setFillStyle(P.active); txt.setColor('#cccccc'); }
      });
      zone.on('pointerout', () => {
        if (tab !== this.activeTab) { bg.setFillStyle(P.panel); txt.setColor('#888899'); }
      });
      zone.on('pointerdown', () => this.setTab(tab));
    });
  }

  private setTab(tab: Tab): void {
    if (tab === this.activeTab) return;
    this.stopListening();

    // Re-style old active tab
    const oldIdx = TABS.indexOf(this.activeTab);
    this.tabBgs[oldIdx].setFillStyle(P.panel).setStrokeStyle(1, P.border);
    this.tabTxts[oldIdx].setColor('#888899');

    // Re-style new active tab
    this.activeTab = tab;
    const newIdx = TABS.indexOf(tab);
    this.tabBgs[newIdx].setFillStyle(P.active).setStrokeStyle(1, P.gold);
    this.tabTxts[newIdx].setColor('#ffd700');

    this.refreshContent();
  }

  // ─── Content ─────────────────────────────────────────────────────────────────

  private drawContent(): void {
    const panelY = 116;
    const panelH = GAME_HEIGHT - 176;

    const bg = this.add.rectangle(
      GAME_WIDTH / 2, panelY + panelH / 2,
      GAME_WIDTH - 40, panelH, P.panel,
    ).setStrokeStyle(1, P.border);
    this.contentObjects.push(bg);

    switch (this.activeTab) {
      case 'audio':    this.drawAudioTab(panelY + 28);    break;
      case 'graphics': this.drawGraphicsTab(panelY + 28); break;
      case 'keybinds': this.drawKeybindsTab(panelY + 28); break;
    }
  }

  private refreshContent(): void {
    for (const obj of this.contentObjects) (obj as { destroy(): void }).destroy();
    this.contentObjects = [];
    this.drawContent();
  }

  // ─── Audio Tab ───────────────────────────────────────────────────────────────

  private drawAudioTab(startY: number): void {
    const cx = GAME_WIDTH / 2;
    const rows: Array<{ label: string; key: keyof GameSettings['audio'] }> = [
      { label: 'MASTER VOLUME', key: 'master' },
      { label: 'MUSIC  VOLUME', key: 'music'  },
      { label: 'SFX    VOLUME', key: 'sfx'    },
    ];

    rows.forEach(({ label, key }, i) => {
      const y = startY + i * 64;

      const lbl = this.add.text(cx - 160, y, label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px', color: '#888899',
      }).setOrigin(0, 0.5);
      this.contentObjects.push(lbl);

      this.addVolumeSlider(cx + 10, y, key);
    });
  }

  private addVolumeSlider(x: number, y: number, key: keyof GameSettings['audio']): void {
    const BAR_W = 150;
    const BAR_H = 10;

    const track = this.add.rectangle(x + BAR_W / 2, y, BAR_W, BAR_H, 0x222240)
      .setStrokeStyle(1, P.border).setOrigin(0.5);
    this.contentObjects.push(track);

    const fill = this.add.rectangle(x, y, (this.settings.audio[key] / 100) * BAR_W, BAR_H, P.gold)
      .setOrigin(0, 0.5);
    this.contentObjects.push(fill);

    const valTxt = this.add.text(x + BAR_W + 12, y, `${this.settings.audio[key]}%`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px', color: '#ffd700',
    }).setOrigin(0, 0.5);
    this.contentObjects.push(valTxt);

    const zone = this.add.zone(x + BAR_W / 2, y, BAR_W, 22)
      .setInteractive({ useHandCursor: true }).setOrigin(0.5);
    this.contentObjects.push(zone);

    const update = (px: number) => {
      const local = Phaser.Math.Clamp(px - (x - this.cameras.main.scrollX * 0), 0, BAR_W);
      this.settings.audio[key] = Math.round((local / BAR_W) * 100);
      fill.width = (this.settings.audio[key] / 100) * BAR_W;
      valTxt.setText(`${this.settings.audio[key]}%`);
    };

    zone.on('pointerdown', (ptr: Phaser.Input.Pointer) => update(ptr.x));
    zone.on('pointermove', (ptr: Phaser.Input.Pointer) => { if (ptr.isDown) update(ptr.x); });
  }

  // ─── Graphics Tab ────────────────────────────────────────────────────────────

  private drawGraphicsTab(startY: number): void {
    const cx = GAME_WIDTH / 2;

    const lbl = this.add.text(cx, startY, 'RENDER QUALITY', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px', color: '#888899',
    }).setOrigin(0.5);
    this.contentObjects.push(lbl);

    const opts: Array<{ label: string; value: GameSettings['graphics']['quality'] }> = [
      { label: 'LOW',    value: 'low'    },
      { label: 'MEDIUM', value: 'medium' },
      { label: 'HIGH',   value: 'high'   },
    ];
    const btnW = 110;
    const btnH = 38;
    const gap  = 14;
    const totalW = opts.length * btnW + (opts.length - 1) * gap;

    opts.forEach(({ label, value }, i) => {
      const bx       = cx - totalW / 2 + i * (btnW + gap) + btnW / 2;
      const by       = startY + 72;
      const isActive = this.settings.graphics.quality === value;

      const bg = this.add.rectangle(bx, by, btnW, btnH, isActive ? P.active : P.panel)
        .setStrokeStyle(2, isActive ? P.gold : P.border);
      this.contentObjects.push(bg);

      const txt = this.add.text(bx, by, label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px', color: isActive ? '#ffd700' : '#888899',
      }).setOrigin(0.5);
      this.contentObjects.push(txt);

      const zone = this.add.zone(bx, by, btnW, btnH).setInteractive({ useHandCursor: true });
      this.contentObjects.push(zone);
      zone.on('pointerover', () => { if (!isActive) { bg.setFillStyle(P.active); txt.setColor('#cccccc'); } });
      zone.on('pointerout',  () => { if (!isActive) { bg.setFillStyle(P.panel);  txt.setColor('#888899'); } });
      zone.on('pointerdown', () => { this.settings.graphics.quality = value; this.refreshContent(); });
    });

    const note = this.add.text(cx, startY + 138, 'Changes apply on next scene load', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px', color: '#444466',
    }).setOrigin(0.5);
    this.contentObjects.push(note);
  }

  // ─── Keybinds Tab ────────────────────────────────────────────────────────────

  private drawKeybindsTab(startY: number): void {
    const cx = GAME_WIDTH / 2;
    const binds: Array<{ label: string; key: keyof GameSettings['keybinds'] }> = [
      { label: 'JUMP',   key: 'jump'   },
      { label: 'EMOTE',  key: 'emote'  },
      { label: 'SPRINT', key: 'sprint' },
      { label: 'STATS',  key: 'stats'  },
    ];

    binds.forEach(({ label, key }, i) => {
      const y           = startY + i * 48;
      const isListening = this.listeningBind === key;

      const lbl = this.add.text(cx - 140, y, label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px', color: '#888899',
      }).setOrigin(0, 0.5);
      this.contentObjects.push(lbl);

      const btnW = 130;
      const btnH = 32;
      const bx   = cx + 70;

      const bg = this.add.rectangle(bx, y, btnW, btnH, isListening ? 0x2a1a00 : P.active)
        .setStrokeStyle(2, isListening ? P.gold : P.border);
      this.contentObjects.push(bg);

      const txt = this.add.text(bx, y,
        isListening ? 'Press a key...' : this.settings.keybinds[key], {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px', color: isListening ? '#ffd700' : '#ffffff',
        }).setOrigin(0.5);
      this.contentObjects.push(txt);

      const zone = this.add.zone(bx, y, btnW, btnH).setInteractive({ useHandCursor: true });
      this.contentObjects.push(zone);
      zone.on('pointerover', () => { if (!isListening) bg.setStrokeStyle(2, P.gold); });
      zone.on('pointerout',  () => { if (!isListening) bg.setStrokeStyle(2, P.border); });
      zone.on('pointerdown', () => { this.startListening(key); });

      if (isListening) {
        const hint = this.add.text(bx, y + 22, 'ESC to cancel', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px', color: '#555577',
        }).setOrigin(0.5);
        this.contentObjects.push(hint);
      }
    });

    const note = this.add.text(cx, startY + 210, 'Click a key button to rebind', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px', color: '#444466',
    }).setOrigin(0.5);
    this.contentObjects.push(note);
  }

  private startListening(bind: keyof GameSettings['keybinds']): void {
    this.listeningBind = bind;
    this.refreshContent();
  }

  private stopListening(): void {
    if (!this.listeningBind) return;
    this.listeningBind = null;
    this.refreshContent();
  }

  // ─── Back / Save button ──────────────────────────────────────────────────────

  private drawBackButton(): void {
    const x = GAME_WIDTH / 2;
    const y = GAME_HEIGHT - 38;
    const W = 180;
    const H = 32;

    const bg = this.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hover ? P.active : P.panel, 1);
      bg.fillRect(x - W / 2, y - H / 2, W, H);
      bg.lineStyle(2, hover ? P.gold : P.border, 1);
      bg.strokeRect(x - W / 2, y - H / 2, W, H);
    };
    draw(false);

    const txt = this.add.text(x, y, '◄  SAVE & BACK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px', color: '#ffd700',
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, W + 8, H + 8).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => { draw(true);  txt.setScale(1.04); });
    zone.on('pointerout',  () => { draw(false); txt.setScale(1); });
    zone.on('pointerdown', () => {
      this.tweens.add({
        targets: txt, scaleX: 0.96, scaleY: 0.96,
        duration: 80, yoyo: true,
        onComplete: () => this.saveAndBack(),
      });
    });
  }

  private saveAndBack(): void {
    SettingsManager.save(this.settings);
    SettingsManager.invalidate();
    window.removeEventListener('keydown', this.keyListener);
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const returnScene = this.scene.get(this.returnTo);
      this.scene.stop();
      if (returnScene && this.scene.isSleeping(this.returnTo)) {
        this.scene.wake(this.returnTo);
      } else {
        this.scene.start(this.returnTo);
      }
    });
  }
}
