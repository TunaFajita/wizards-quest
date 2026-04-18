import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@shared/renderConstants';
import { Player } from '../entities/Player';
import { Mob } from '../entities/Mob';
import { InputManager } from '../systems/InputManager';
import { MapManager } from '../managers/MapManager';
import { LightingManager } from '../managers/LightingManager';
import { ParticleManager } from '../managers/ParticleManager';
import { CameraManager } from '../managers/CameraManager';
import { isoToWorld } from '../utils/isoHelper';
import { schoolGroundsConfig } from '../config/maps/school-grounds.config';
import { LAYER_SLOTS } from '../data/characterLayers';
import { AuthManager } from '../systems/AuthManager';
import { SettingsManager } from '../systems/SettingsManager';
import { drawHUD, HUD_CONFIG, HUD_W, HUD_H, HudConfig } from '../ui/rpgHudRenderer';
import {
  drawStats,
  getPlusRegions,
  getSubmitRegion,
  STATS,
  StatsState,
  W as STATS_W,
  H as STATS_H,
  PORTRAIT_X as STATS_PORTRAIT_X,
  PORTRAIT_Y as STATS_PORTRAIT_Y,
  PORTRAIT_SIZE as STATS_PORTRAIT_SIZE,
} from '../ui/characterStatsHudRenderer';

const STATS_DISPLAY_SCALE = 2;

// ─── Combat / stat config ─────────────────────────────────────────────────────
const PLAYER_MAX_HP           = 100;
const PLAYER_MAX_MP           = 100;
const PLAYER_MAX_STAMINA      = 50;   // character stat
const PLAYER_STAMINA_DRAIN    = 5;    // pts/sec while sprinting
const PLAYER_STAMINA_REGEN    = 5;    // pts/sec once regen kicks in
const PLAYER_STAMINA_DELAY_MS = 3000; // idle time before regen begins
const PLAYER_IFRAME_MS        = 700;  // invincibility after taking damage

// ─── HUD ──────────────────────────────────────────────────────────────────────
// Render the HUD canvas at its native 152×56 and display at 1:1 — Phaser's FIT
// scale mode already upscales the whole game canvas to the browser window, so
// any extra HUD multiplier compounds with that and ends up too large.
const HUD_DISPLAY_SCALE = 1;   // on-screen size (152×56 px)
const HUD_TEXTURE_KEY = 'player-hud';

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
  private escKey!:    Phaser.Input.Keyboard.Key;
  private jumpKey!:   Phaser.Input.Keyboard.Key;
  private emoteKey!:  Phaser.Input.Keyboard.Key;
  private sprintKey!: Phaser.Input.Keyboard.Key;
  private statsKey!:  Phaser.Input.Keyboard.Key;

  // ── combat state ──────────────────────────────────────────────────────────
  private playerHp        = PLAYER_MAX_HP;
  private playerMp        = PLAYER_MAX_MP;
  private playerStamina   = PLAYER_MAX_STAMINA;
  private playerLevel     = 1;
  private playerIframes   = 0; // remaining invincibility ms
  private staminaIdleMs   = 0; // time since last sprint (ms)
  private playerDead      = false;

  // ── HUD ───────────────────────────────────────────────────────────────────
  private hudCanvas!:    HTMLCanvasElement;
  private hudCtx!:       CanvasRenderingContext2D;
  private hudImage!:     Phaser.GameObjects.Image;
  private hudDirty       = true;
  private hudDeathText!: Phaser.GameObjects.Text;

  // ── Character Stats HUD (toggled with TAB) ────────────────────────────────
  private statsCanvas!:  HTMLCanvasElement;
  private statsCtx!:     CanvasRenderingContext2D;
  private statsImage!:   Phaser.GameObjects.Image;
  private statsOpen      = false;
  private statsHoveredPlus = -1;
  private statsSubmitHover = false;
  private statsPending: Record<string, number> = {};
  private statsState: StatsState = {
    level:       1,
    runes:       0,
    skillPoints: 5,
    // Actual stat values (left panel). VIT/MND/END mirror the game constants.
    stats: {
      vit: PLAYER_MAX_HP,
      mnd: PLAYER_MAX_MP,
      end: PLAYER_MAX_STAMINA,
      str: 0, dex: 0, int: 0, fth: 0, arc: 0,
    },
    // Invested skill points per stat (right panel), all 0 by default.
    invested: Object.fromEntries(STATS.map(s => [s.key, 0])),
  };

  // ── Dual-camera UI (screen-space, immune to world zoom) ───────────────────
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private uiObjects: Set<Phaser.GameObjects.GameObject> = new Set();
  private playerTextureKey = 'wizard';

  // ── Mobs ──────────────────────────────────────────────────────────────────
  private mobs: Mob[] = [];

  // ── Emote wheel ───────────────────────────────────────────────────────────
  private emoteWheelObjects: Phaser.GameObjects.GameObject[] = [];
  private emoteWheelOpen = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.playerHp       = PLAYER_MAX_HP;
    this.playerMp       = PLAYER_MAX_MP;
    this.playerStamina  = PLAYER_MAX_STAMINA;
    this.staminaIdleMs  = 0;
    this.playerDead     = false;
    this.playerIframes  = 0;
    this.hudDirty       = true;

    const config = schoolGroundsConfig;

    // Map
    const mapManager = new MapManager(this, config);

    // Lighting
    const lighting = new LightingManager(this, config, mapManager.groundLayer);

    // Player
    const spawnPos = isoToWorld(config.spawn.col, config.spawn.row);
    const { textureKey, animPrefix } = resolveCharacter();
    this.playerTextureKey = textureKey;
    this.player = new Player(this, spawnPos.x, spawnPos.y, textureKey, animPrefix);
    this.physics.add.collider(this.player.sprite, mapManager.groundLayer);
    const playerLight = lighting.createPlayerLight(this, spawnPos.x, spawnPos.y);
    this.player.setLight(playerLight);
    this.player.sprite.setPipeline('Light2D');

    // Mobs — spawn a handful of lizardmen around the player spawn for testing
    this.spawnMobs(spawnPos.x, spawnPos.y);

    // Input
    this.inputManager = new InputManager(this);

    // Left mouse button → action (or stats HUD click when open)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.statsOpen) { this.handleStatsClick(pointer); return; }
      if (!this.isPaused && !this.emoteWheelOpen && pointer.leftButtonDown()) {
        this.player.attack();
        this.hitNearbyMobs();
      }
    });

    // Mouse move for stats HUD hover state
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.statsOpen) this.handleStatsHover(pointer);
    });

    // ESC key → toggle pause (or close stats HUD)
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey.on('down', () => {
      if (this.statsOpen) { this.closeStats(); return; }
      this.togglePause();
    });

    // Action keys from settings
    const binds = SettingsManager.keybinds;
    this.jumpKey   = this.input.keyboard!.addKey(SettingsManager.toKeyCode(binds.jump));
    this.emoteKey  = this.input.keyboard!.addKey(SettingsManager.toKeyCode(binds.emote));
    this.sprintKey = this.input.keyboard!.addKey(SettingsManager.toKeyCode(binds.sprint));
    this.statsKey  = this.input.keyboard!.addKey(SettingsManager.toKeyCode(binds.stats));
    // Stop the browser from stealing TAB for focus navigation when it's bound here.
    this.input.keyboard!.addCapture(SettingsManager.toKeyCode(binds.stats));

    this.jumpKey.on('down',  () => { if (!this.isPaused && !this.emoteWheelOpen && !this.statsOpen && !this.playerDead) this.player.jump(); });
    this.emoteKey.on('down', () => { if (!this.isPaused && !this.statsOpen) this.toggleEmoteWheel(); });
    this.statsKey.on('down', () => { if (!this.isPaused && !this.emoteWheelOpen) this.toggleStats(); });

    // Hold-to-sprint (only if stamina available)
    this.sprintKey.on('down', () => {
      if (!this.isPaused && !this.emoteWheelOpen && !this.statsOpen && this.playerStamina > 0) {
        this.player.setSprinting(true);
      }
    });
    this.sprintKey.on('up', () => this.player.setSprinting(false));

    // Camera
    const cameraManager = new CameraManager(this, this.player.sprite, mapManager.bounds, config.backgroundColor);

    // Particles
    new ParticleManager(this, mapManager.bounds, config);

    // Physics bounds
    const { offsetX, offsetY, widthPx, heightPx } = mapManager.bounds;
    this.physics.world.setBounds(offsetX, offsetY, widthPx, heightPx);

    // Mark save in DB
    void AuthManager.markHasSave();

    // UI camera — renders screen-space UI at a fixed 1:1 scale regardless of
    // the main camera's zoom level. Must be created BEFORE the UI objects so
    // buildHud()/buildPauseMenu() can mark their children correctly.
    this.uiCamera = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.uiCamera.setName('ui');
    this.uiCamera.transparent = true;

    // Vignette is a screen-space overlay — render it via the UI camera only.
    this.markUi(cameraManager.vignette);

    // Build HUD
    this.buildHud();

    // Build stats HUD (hidden by default, toggled with TAB)
    this.buildStatsHud();

    // Build pause overlay (hidden by default)
    this.buildPauseMenu();

    // Any child not tagged as UI is treated as world — UI camera skips them.
    const worldObjects = this.children.list.filter(o => !this.uiObjects.has(o));
    this.uiCamera.ignore(worldObjects);
  }

  /** Tag a game object as screen-space UI: main camera skips it, UI camera shows it. */
  private markUi(obj: Phaser.GameObjects.GameObject): void {
    this.uiObjects.add(obj);
    this.cameras.main.ignore(obj);
  }

  update(_time: number, delta: number): void {
    // Background systems always tick — UI panels must not freeze game state.
    if (this.playerIframes > 0) this.playerIframes -= delta;

    if (this.player.sprinting && this.playerStamina > 0) {
      this.playerStamina = Math.max(0, this.playerStamina - PLAYER_STAMINA_DRAIN * delta / 1000);
      this.staminaIdleMs = 0;
      if (this.playerStamina === 0) this.player.setSprinting(false);
      this.hudDirty = true;
    } else if (this.playerStamina < PLAYER_MAX_STAMINA) {
      this.staminaIdleMs += delta;
      if (this.staminaIdleMs >= PLAYER_STAMINA_DELAY_MS) {
        this.playerStamina = Math.min(PLAYER_MAX_STAMINA, this.playerStamina + PLAYER_STAMINA_REGEN * delta / 1000);
        this.hudDirty = true;
      }
    }

    if (this.hudDirty) this.renderHud();

    // Gate player input on UI state.
    if (this.isPaused || this.emoteWheelOpen || this.statsOpen) return;

    if (!this.playerDead) {
      const input = this.inputManager.getInput();
      this.player.update(input);
    }

    for (const mob of this.mobs) {
      mob.update(delta, this.player.sprite, (dmg) => this.hurtPlayer(dmg));
    }
    this.mobs = this.mobs.filter(m => !m.isDead);
  }

  private spawnMobs(originX: number, originY: number): void {
    const x = originX + 80;
    const y = originY + 60;
    this.mobs.push(new Mob(this, x, y, 'lizardman', 'lizardman'));
  }

  private hitNearbyMobs(): void {
    const REACH = 60;
    for (const mob of this.mobs) {
      const dist = Phaser.Math.Distance.Between(
        this.player.sprite.x, this.player.sprite.y,
        mob.sprite.x, mob.sprite.y,
      );
      if (dist <= REACH) mob.hurt(20);
    }
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
    this.markUi(this.pauseOverlay);

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
      { label: 'Settings',          color: PAUSE_PALETTE.white, action: () => this.openSettings() },
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

  // ─── Player HUD ───────────────────────────────────────────────────────────

  // ─── Emote Wheel ─────────────────────────────────────────────────────────

  private toggleEmoteWheel(): void {
    this.emoteWheelOpen ? this.closeEmoteWheel() : this.openEmoteWheel();
  }

  private openEmoteWheel(): void {
    if (this.emoteWheelOpen) return;
    this.emoteWheelOpen = true;

    const cx    = GAME_WIDTH  / 2;
    const cy    = GAME_HEIGHT / 2;
    const WR    = 88;    // wheel radius
    const BR    = 30;    // button circle radius
    const DEPTH = 600;
    const objs  = this.emoteWheelObjects;

    // Only animations that exist in the LPC v3 spritesheet are listed here.
    const emotes: Array<{ key: 'wave'|'sit'|'jump'; label: string; icon: string }> = [
      { key: 'wave', label: 'Wave', icon: '\u{1F44B}' },  // rows 34-37
      { key: 'sit',  label: 'Sit',  icon: '\u{1FA91}' },  // rows 30-33
      { key: 'jump', label: 'Jump', icon: '\u{1F91C}' },  // rows 26-29
    ];

    // Tracks objects for batch-destroy; pins to screen via setScrollFactor(0)
    // and routes them to the UI camera so zoom doesn't affect the wheel.
    const track = <T extends Phaser.GameObjects.GameObject & {
      setDepth(d: number): T;
      setScrollFactor(x: number): T;
    }>(o: T, depth = DEPTH): T => {
      o.setDepth(depth).setScrollFactor(0);
      objs.push(o);
      this.markUi(o);
      return o;
    };

    // Dark backdrop
    track(this.add.circle(cx, cy, WR + 52, 0x000000, 0.75));

    // Outer ring
    const ring = this.add.graphics().setDepth(DEPTH).setScrollFactor(0);
    ring.setPosition(cx, cy);
    ring.lineStyle(2, 0x3a3a6e, 1);
    ring.strokeCircle(0, 0, WR + 50);
    ring.lineStyle(1, 0x3a3a6e, 0.4);
    ring.strokeCircle(0, 0, WR);
    objs.push(ring);
    this.markUi(ring);

    // Center labels
    track(this.add.text(cx, cy, 'EMOTES', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#ffd700',
    }).setOrigin(0.5));
    track(this.add.text(cx, cy + 18, '[T] to close', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '5px',
      color: '#555577',
    }).setOrigin(0.5));

    // Emote buttons
    emotes.forEach(({ key, label, icon }, i) => {
      const angle = (i / emotes.length) * Math.PI * 2 - Math.PI / 2;
      const bx    = cx + Math.cos(angle) * WR;
      const by    = cy + Math.sin(angle) * WR;

      const btnBg = track(
        this.add.circle(bx, by, BR, 0x12122e).setStrokeStyle(1, 0x3a3a6e),
      );

      track(this.add.text(bx, by - 8, icon, {
        fontSize: '14px',
      }).setOrigin(0.5), DEPTH + 1);

      track(this.add.text(bx, by + 14, label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '4px',
        color: '#aaaacc',
      }).setOrigin(0.5), DEPTH + 1);

      const zone = this.add.zone(bx, by, BR * 2, BR * 2)
        .setDepth(DEPTH + 2)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      objs.push(zone);

      zone.on('pointerover', () => {
        btnBg.setFillStyle(0x1e1e40);
        btnBg.setStrokeStyle(2, 0xffd700);
      });
      zone.on('pointerout', () => {
        btnBg.setFillStyle(0x12122e);
        btnBg.setStrokeStyle(1, 0x3a3a6e);
      });
      zone.on('pointerdown', () => {
        this.player.emote(key);
        // Defer the close by one frame so the scene-level pointerdown (which
        // fires right after this handler) still sees emoteWheelOpen=true and
        // skips the attack action.
        this.time.delayedCall(1, () => this.closeEmoteWheel());
      });
    });
  }

  private closeEmoteWheel(): void {
    if (!this.emoteWheelOpen) return;
    this.emoteWheelOpen = false;
    for (const obj of this.emoteWheelObjects) {
      this.uiObjects.delete(obj);
      obj.destroy();
    }
    this.emoteWheelObjects = [];
  }

  // ─── Player HUD ───────────────────────────────────────────────────────────

  private buildHud(): void {
    const HUD_DEPTH = 1000;

    // Offscreen canvas at native 152×56 — Phaser scales the displayed image.
    this.hudCanvas = document.createElement('canvas');
    this.hudCanvas.width  = HUD_W;
    this.hudCanvas.height = HUD_H;
    this.hudCtx = this.hudCanvas.getContext('2d')!;

    // Register (or reset) the canvas as a Phaser texture.
    if (this.textures.exists(HUD_TEXTURE_KEY)) this.textures.remove(HUD_TEXTURE_KEY);
    this.textures.addCanvas(HUD_TEXTURE_KEY, this.hudCanvas);

    this.hudImage = this.add.image(8, 8, HUD_TEXTURE_KEY)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setScale(HUD_DISPLAY_SCALE)
      .setDepth(HUD_DEPTH);
    this.markUi(this.hudImage);

    this.renderHud();

    // Death overlay text (hidden)
    this.hudDeathText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'YOU DIED', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '32px',
      color: '#ff2222',
    }).setScrollFactor(0).setDepth(HUD_DEPTH + 10).setOrigin(0.5).setAlpha(0);
    this.markUi(this.hudDeathText);
  }

  private renderHud(): void {
    const username = (AuthManager.getSession()?.username ?? 'Hero').toUpperCase();
    const cfg: HudConfig = {
      ...HUD_CONFIG,
      name:  { ...HUD_CONFIG.name,  text:  username },
      level: { ...HUD_CONFIG.level, value: this.playerLevel },
      bars: [
        { ...HUD_CONFIG.bars[0], pct: (this.playerHp      / PLAYER_MAX_HP)      * 100 },
        { ...HUD_CONFIG.bars[1], pct: (this.playerMp      / PLAYER_MAX_MP)      * 100 },
        { ...HUD_CONFIG.bars[2], pct: (this.playerStamina / PLAYER_MAX_STAMINA) * 100 },
      ],
    };
    drawHUD(this.hudCtx, cfg, 1);
    (this.textures.get(HUD_TEXTURE_KEY) as Phaser.Textures.CanvasTexture).refresh();
    this.hudDirty = false;
  }

  // ─── Character Stats HUD ──────────────────────────────────────────────────

  private buildStatsHud(): void {
    const STATS_DEPTH = 1100;
    const STATS_KEY   = 'player-stats-hud';

    this.statsCanvas = document.createElement('canvas');
    this.statsCanvas.width  = STATS_W;
    this.statsCanvas.height = STATS_H;
    this.statsCtx = this.statsCanvas.getContext('2d')!;

    if (this.textures.exists(STATS_KEY)) this.textures.remove(STATS_KEY);
    this.textures.addCanvas(STATS_KEY, this.statsCanvas);

    const hudX = Math.floor((GAME_WIDTH  - STATS_W * STATS_DISPLAY_SCALE) / 2);
    const hudY = Math.floor((GAME_HEIGHT - STATS_H * STATS_DISPLAY_SCALE) / 2);

    this.statsImage = this.add.image(hudX, hudY, STATS_KEY)
      .setOrigin(0, 0)
      .setScale(STATS_DISPLAY_SCALE)
      .setScrollFactor(0)
      .setDepth(STATS_DEPTH)
      .setVisible(false);
    this.markUi(this.statsImage);

    this.renderStatsHud();
  }

  private renderStatsHud(): void {
    this.statsState.level = this.playerLevel;
    drawStats(this.statsCtx, this.statsState, 1, this.statsHoveredPlus, this.statsSubmitHover);

    // Draw character portrait inside the left-panel portrait box.
    // Idle-down frame: walk base row 8 + LPC down-dir row 2 = row 10, col 0.
    // LPC spritesheets are 64×64 per frame, 13 columns.
    const src = this.textures.get(this.playerTextureKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    if (src && (src as HTMLImageElement).naturalWidth !== 0) {
      const FRAME_W = 64, FRAME_H = 64, COLS = 13;
      const frameIdx = 10 * COLS; // row 10, col 0
      const srcX = (frameIdx % COLS) * FRAME_W;
      const srcY = Math.floor(frameIdx / COLS) * FRAME_H;
      this.statsCtx.imageSmoothingEnabled = false;
      this.statsCtx.drawImage(
        src, srcX, srcY, FRAME_W, FRAME_H,
        STATS_PORTRAIT_X + 1, STATS_PORTRAIT_Y + 1,
        STATS_PORTRAIT_SIZE - 2, STATS_PORTRAIT_SIZE - 2,
      );
    }

    (this.textures.get('player-stats-hud') as Phaser.Textures.CanvasTexture).refresh();
  }

  private toggleStats(): void {
    this.statsOpen ? this.closeStats() : this.openStats();
  }

  private openStats(): void {
    if (this.statsOpen) return;
    this.statsOpen = true;
    this.statsHoveredPlus = -1;
    this.statsSubmitHover = false;
    this.player.setSprinting(false);
    this.statsImage.setVisible(true);
    this.renderStatsHud();
  }

  private closeStats(): void {
    if (!this.statsOpen) return;
    this.statsOpen = false;
    this.statsHoveredPlus = -1;
    this.statsSubmitHover = false;
    this.statsImage.setVisible(false);
  }

  /** Convert a pointer to stats-HUD-local coordinates (accounts for display scale). */
  private statsLocal(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    return {
      x: (pointer.x - this.statsImage.x) / STATS_DISPLAY_SCALE,
      y: (pointer.y - this.statsImage.y) / STATS_DISPLAY_SCALE,
    };
  }

  private handleStatsHover(pointer: Phaser.Input.Pointer): void {
    const { x, y } = this.statsLocal(pointer);

    let hovered = -1;
    for (const reg of getPlusRegions()) {
      if (x >= reg.x && x < reg.x + reg.w && y >= reg.y && y < reg.y + reg.h) {
        hovered = reg.index;
        break;
      }
    }
    const sub = getSubmitRegion();
    const overSubmit = x >= sub.x && x < sub.x + sub.w && y >= sub.y && y < sub.y + sub.h;

    if (hovered !== this.statsHoveredPlus || overSubmit !== this.statsSubmitHover) {
      this.statsHoveredPlus = hovered;
      this.statsSubmitHover = overSubmit;
      this.renderStatsHud();
    }
  }

  private handleStatsClick(pointer: Phaser.Input.Pointer): void {
    if (!pointer.leftButtonDown()) return;
    const { x, y } = this.statsLocal(pointer);

    // + button on any stat row
    for (const reg of getPlusRegions()) {
      if (x >= reg.x && x < reg.x + reg.w && y >= reg.y && y < reg.y + reg.h) {
        if (this.statsState.skillPoints <= 0) return;
        const key = STATS[reg.index].key;
        this.statsState.skillPoints   -= 1;
        this.statsState.invested[key] += 1;
        this.statsState.stats[key]    += 1;
        this.statsPending[key]         = (this.statsPending[key] || 0) + 1;
        this.renderStatsHud();
        return;
      }
    }

    // Submit button — in future, persist to server. For now, just clear pending.
    const sub = getSubmitRegion();
    if (x >= sub.x && x < sub.x + sub.w && y >= sub.y && y < sub.y + sub.h) {
      this.statsPending = {};
      this.renderStatsHud();
    }
  }

  private hurtPlayer(dmg: number): void {
    if (this.playerDead || this.playerIframes > 0) return;

    this.playerHp = Math.max(0, this.playerHp - dmg);
    this.playerIframes = PLAYER_IFRAME_MS;

    this.hudDirty = true;

    this.player.hurt();
    // Guarantee tint clears after iframe window — walk animations interrupt the
    // hurt animation so its animationcomplete never fires, leaving tint stuck.
    this.time.delayedCall(PLAYER_IFRAME_MS, () => {
      if (!this.playerDead) this.player.sprite.clearTint();
    });

    if (this.playerHp <= 0) this.playerDie();
  }

  private playerDie(): void {
    this.playerDead = true;
    this.player.die();
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

  private openSettings(): void {
    this.isPaused = false;
    this.physics.world.resume();
    this.pauseOverlay.setVisible(false);
    this.scene.start('SettingsScene', { returnTo: 'GameScene' });
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
