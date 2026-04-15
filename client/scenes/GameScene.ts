import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@shared/renderConstants';
import { Player } from '../entities/Player';
import { Skeleton } from '../entities/Skeleton';
import { InputManager } from '../systems/InputManager';
import { MapManager } from '../managers/MapManager';
import { LightingManager } from '../managers/LightingManager';
import { ParticleManager } from '../managers/ParticleManager';
import { CameraManager } from '../managers/CameraManager';
import { isoToWorld } from '../utils/isoHelper';
import { schoolGroundsConfig } from '../config/maps/school-grounds.config';
import { LAYER_SLOTS } from '../data/characterLayers';
import { AuthManager } from '../systems/AuthManager';

// ─── Combat config ────────────────────────────────────────────────────────────
const PLAYER_MAX_HP       = 100;
const PLAYER_ATTACK_RANGE = 72;   // px radius around player for melee hit
const PLAYER_ATTACK_DMG   = 25;
const PLAYER_IFRAME_MS    = 700;  // invincibility after taking damage

// Skeleton spawn tile [col, row]
const SKELETON_SPAWNS: [number, number][] = [
  [7, 10],
];

// ─── Palette ──────────────────────────────────────────────────────────────────
const PAUSE_PALETTE = {
  overlay: 0x000000,
  panel:   0x10102a,
  border:  0x3a3a6e,
  gold:    0xffd700,
  white:   0xffffff,
  red:     0xff4444,
  dim:     0x555577,
};

function resolveCharacter(): { textureKey: string; animPrefix: string } {
  try {
    const raw = localStorage.getItem('wq_character');
    if (!raw) return { textureKey: 'wizard', animPrefix: 'wizard' };
    const save = JSON.parse(raw) as { layers: Record<string, string> };
    const bodySlot = LAYER_SLOTS.find(s => s.id === 'body');
    const option   = bodySlot?.options.find(o => o.id === save.layers?.['body']);
    if (option?.textureKey && option.animPrefix) {
      return { textureKey: option.textureKey, animPrefix: option.animPrefix };
    }
  } catch { /* fall through */ }
  return { textureKey: 'wizard', animPrefix: 'wizard' };
}

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputManager!: InputManager;
  private isPaused = false;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private escKey!: Phaser.Input.Keyboard.Key;

  // ── combat state ──────────────────────────────────────────────────────────
  private skeletons: Skeleton[] = [];
  private playerHp  = PLAYER_MAX_HP;
  private playerIframes = 0; // remaining invincibility ms
  private playerDead = false;

  // ── HUD ───────────────────────────────────────────────────────────────────
  private hudHpFill!:   Phaser.GameObjects.Rectangle;
  private hudHpText!:   Phaser.GameObjects.Text;
  private hudDeathText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Clean up any skeletons from a previous create() call (scene reuse / HMR)
    this.skeletons.forEach(sk => { try { sk.destroy(); } catch { /* already gone */ } });
    this.skeletons    = [];
    this.playerHp     = PLAYER_MAX_HP;
    this.playerDead   = false;
    this.playerIframes = 0;

    const config = schoolGroundsConfig;

    // Map
    const mapManager = new MapManager(this, config);

    // Lighting
    const lighting = new LightingManager(this, config, mapManager.groundLayer);

    // Player
    const spawnPos = isoToWorld(config.spawn.col, config.spawn.row);
    const { textureKey, animPrefix } = resolveCharacter();
    this.player = new Player(this, spawnPos.x, spawnPos.y, textureKey, animPrefix);
    this.physics.add.collider(this.player.sprite, mapManager.groundLayer);
    const playerLight = lighting.createPlayerLight(this, spawnPos.x, spawnPos.y);
    this.player.setLight(playerLight);
    this.player.sprite.setPipeline('Light2D');

    // Input
    this.inputManager = new InputManager(this);

    // Left mouse button → action
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.isPaused && pointer.leftButtonDown()) this.player.attack();
    });

    // ESC key → toggle pause
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey.on('down', () => this.togglePause());

    // Camera
    new CameraManager(this, this.player.sprite, mapManager.bounds, config.backgroundColor);

    // Particles
    new ParticleManager(this, mapManager.bounds, config);

    // Physics bounds
    const { offsetX, offsetY, widthPx, heightPx } = mapManager.bounds;
    this.physics.world.setBounds(offsetX, offsetY, widthPx, heightPx);

    // Mark save in DB
    void AuthManager.markHasSave();

    // Spawn skeletons
    this.spawnSkeletons();

    // Player attack → skeleton damage
    this.player.sprite.on('player-attack', () => {
      for (const sk of this.skeletons) {
        if (sk.isDead) continue;
        const dist = Phaser.Math.Distance.Between(
          this.player.sprite.x, this.player.sprite.y,
          sk.sprite.x, sk.sprite.y,
        );
        if (dist <= PLAYER_ATTACK_RANGE) {
          sk.takeDamage(PLAYER_ATTACK_DMG);
        }
      }
    });

    // Build HUD
    this.buildHud();

    // Build pause overlay (hidden by default)
    this.buildPauseMenu();
  }

  update(_time: number, delta: number): void {
    if (this.isPaused) return;

    // Player i-frames
    if (this.playerIframes > 0) this.playerIframes -= delta;

    // Player movement (skip if dead)
    if (!this.playerDead) {
      const input = this.inputManager.getInput();
      this.player.update(input);
    }

    // Skeleton AI
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    this.skeletons = this.skeletons.filter(sk => {
      if (!sk.isRemoved) sk.update(px, py, delta, this.playerDead);
      return !sk.isRemoved;
    });
  }

  // ─── Pause ────────────────────────────────────────────────────────────────

  private togglePause(): void {
    this.isPaused ? this.resumeGame() : this.pauseGame();
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.physics.world.pause();
    this.pauseOverlay.setVisible(true);
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.physics.world.resume();
    this.pauseOverlay.setVisible(false);
  }

  // ─── Pause Menu ───────────────────────────────────────────────────────────

  private buildPauseMenu(): void {
    this.pauseOverlay = this.add.container(0, 0).setVisible(false).setDepth(500).setScrollFactor(0);

    // Dark overlay
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, PAUSE_PALETTE.overlay, 0.75);
    dim.setScrollFactor(0);
    this.pauseOverlay.add(dim);

    const PW = 280;
    const PH = 240;
    const PX = GAME_WIDTH  / 2;
    const PY = GAME_HEIGHT / 2;

    // Panel
    const panel = this.add.graphics().setScrollFactor(0);
    panel.fillStyle(PAUSE_PALETTE.panel, 1);
    panel.fillRect(PX - PW / 2, PY - PH / 2, PW, PH);
    panel.lineStyle(2, PAUSE_PALETTE.border, 1);
    panel.strokeRect(PX - PW / 2, PY - PH / 2, PW, PH);
    // Corner accents
    panel.fillStyle(PAUSE_PALETTE.border, 1);
    [[-1,-1],[PW-3,-1],[-1,PH-3],[PW-3,PH-3]].forEach(([ox, oy]) => {
      panel.fillRect(PX - PW / 2 + ox, PY - PH / 2 + oy, 4, 4);
    });
    this.pauseOverlay.add(panel);

    // Title
    const pauseTitle = this.add.text(PX, PY - PH / 2 + 28, 'PAUSED', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#ffd700',
    }).setOrigin(0.5).setScrollFactor(0);
    this.pauseOverlay.add(pauseTitle);

    // Divider
    const divGfx = this.add.graphics().setScrollFactor(0);
    divGfx.fillStyle(PAUSE_PALETTE.border, 1);
    divGfx.fillRect(PX - PW / 2 + 20, PY - PH / 2 + 50, PW - 40, 1);
    this.pauseOverlay.add(divGfx);

    // Buttons
    const btnDefs = [
      { label: 'Resume',            color: PAUSE_PALETTE.white, action: () => this.resumeGame() },
      { label: 'Settings',          color: PAUSE_PALETTE.dim,   action: () => { /* TODO */ } },
      { label: 'Return to Title',   color: PAUSE_PALETTE.red,   action: () => this.returnToTitle() },
    ];

    btnDefs.forEach((def, i) => {
      this.buildPauseButton(PX, PY - 44 + i * 56, def.label, def.color, def.action);
    });
  }

  private buildPauseButton(x: number, y: number, label: string, textColor: number, action: () => void): void {
    const W = 220;
    const H = 36;

    const gfx = this.add.graphics().setScrollFactor(0);
    this.pauseOverlay.add(gfx);

    const draw = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(hover ? 0x1e1e40 : PAUSE_PALETTE.panel, 1);
      gfx.fillRect(x - W / 2, y - H / 2, W, H);
      gfx.lineStyle(2, hover ? PAUSE_PALETTE.gold : PAUSE_PALETTE.border, 1);
      gfx.strokeRect(x - W / 2, y - H / 2, W, H);
    };
    draw(false);

    const hex = '#' + textColor.toString(16).padStart(6, '0');
    const txt = this.add.text(x, y, label, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '11px',
      color: hex,
    }).setOrigin(0.5).setScrollFactor(0);
    this.pauseOverlay.add(txt);

    const zone = this.add.zone(x, y, W, H).setInteractive({ useHandCursor: true }).setScrollFactor(0);
    this.pauseOverlay.add(zone);
    zone.on('pointerover', () => { draw(true);  txt.setScale(1.04); });
    zone.on('pointerout',  () => { draw(false); txt.setScale(1); });
    zone.on('pointerdown', () => {
      this.tweens.add({ targets: txt, scaleX: 0.96, scaleY: 0.96, duration: 80, yoyo: true, onComplete: action });
    });
  }

  // ─── Skeletons ────────────────────────────────────────────────────────────

  private spawnSkeletons(): void {
    for (const [col, row] of SKELETON_SPAWNS) {
      const pos = isoToWorld(col, row);
      const sk  = new Skeleton(this, pos.x, pos.y);
      sk.onDamagePlayer = (dmg) => this.hurtPlayer(dmg);
      this.skeletons.push(sk);
    }
  }

  // ─── Player HUD ───────────────────────────────────────────────────────────

  private buildHud(): void {
    const HUD_DEPTH = 1000;
    const BAR_X = 20;
    const BAR_Y = 20;
    const BAR_W = 120;
    const BAR_H = 12;

    // border
    this.add.rectangle(BAR_X + BAR_W / 2, BAR_Y + BAR_H / 2, BAR_W + 2, BAR_H + 2, 0x000000)
      .setScrollFactor(0).setDepth(HUD_DEPTH);

    // background
    this.add.rectangle(BAR_X + BAR_W / 2, BAR_Y + BAR_H / 2, BAR_W, BAR_H, 0x440000)
      .setScrollFactor(0).setDepth(HUD_DEPTH + 1);

    // fill (tracks player hp)
    this.hudHpFill = this.add.rectangle(BAR_X, BAR_Y + BAR_H / 2, BAR_W, BAR_H, 0xff2222)
      .setScrollFactor(0).setDepth(HUD_DEPTH + 2).setOrigin(0, 0.5);

    // heart icon
    this.add.text(BAR_X, BAR_Y + BAR_H + 6, '♥ HP', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '5px',
      color: '#ff2222',
    }).setScrollFactor(0).setDepth(HUD_DEPTH + 3).setOrigin(0, 0);

    // numeric label
    this.hudHpText = this.add.text(BAR_X + BAR_W, BAR_Y + BAR_H / 2, `${PLAYER_MAX_HP}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#ff6666',
    }).setScrollFactor(0).setDepth(HUD_DEPTH + 3).setOrigin(0, 0.5);

    // death overlay text (hidden)
    this.hudDeathText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'YOU DIED', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '32px',
      color: '#ff2222',
    }).setScrollFactor(0).setDepth(HUD_DEPTH + 10).setOrigin(0.5).setAlpha(0);
  }

  private hurtPlayer(dmg: number): void {
    if (this.playerDead || this.playerIframes > 0) return;

    this.playerHp = Math.max(0, this.playerHp - dmg);
    this.playerIframes = PLAYER_IFRAME_MS;

    // update bar
    const ratio = this.playerHp / PLAYER_MAX_HP;
    this.hudHpFill.width = 120 * ratio;
    this.hudHpFill.setFillStyle(ratio > 0.5 ? 0xff2222 : ratio > 0.25 ? 0xff8800 : 0xdd0000);
    this.hudHpText.setText(`${this.playerHp}`);

    // red flash on player sprite
    this.player.sprite.setTint(0xff4444);
    this.time.delayedCall(200, () => this.player.sprite.clearTint());

    if (this.playerHp <= 0) this.playerDie();
  }

  private playerDie(): void {
    this.playerDead = true;
    this.player.sprite.setTint(0xff0000);
    this.physics.world.pause();

    this.tweens.add({
      targets: this.hudDeathText,
      alpha: 1,
      duration: 800,
      ease: 'Power2',
    });

    // Return to menu after delay
    this.time.delayedCall(2800, () => {
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.physics.world.resume();
        this.scene.start('MenuScene');
      });
    });
  }

  private returnToTitle(): void {
    this.isPaused = false;
    this.physics.world.resume();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MenuScene');
    });
  }
}
