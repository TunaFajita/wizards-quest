import Phaser from 'phaser';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_HP         = 60;
const SPEED          = 62;
const AGGRO_RANGE    = 200;   // px — start chasing
const DEAGGRO_RANGE  = 320;   // px — give up chase
const ATTACK_RANGE   = 50;    // px — swing
const ATTACK_DAMAGE  = 10;    // HP dealt to player per hit
const ATTACK_CD      = 1400;  // ms between attacks
const HURT_DURATION  = 280;   // ms frozen after taking a hit
const PATROL_INTERVAL_MIN = 2500;
const PATROL_INTERVAL_MAX = 5000;
const PATROL_RADIUS  = 80;    // px from spawn

const HP_BAR_W = 44;
const HP_BAR_H = 5;
const HP_BAR_Y_OFF = -80; // above head

const DIR_NAMES  = ['down', 'left', 'right', 'up'];

type State = 'idle' | 'patrol' | 'chase' | 'attack' | 'hurt' | 'dead';

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export class Skeleton {
  public  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private hp      = MAX_HP;
  private state: State = 'idle';
  private scene: Phaser.Scene;

  // current facing: 0=down 1=left 2=right 3=up
  private dirIndex = 0;

  // AI timers (ms)
  private attackCooldown  = 0;
  private hurtTimer       = 0;
  private patrolCooldown  = Phaser.Math.Between(PATROL_INTERVAL_MIN, PATROL_INTERVAL_MAX);
  private patrolTarget: { x: number; y: number } | null = null;

  // spawn point for patrol leash
  private spawnX: number;
  private spawnY: number;

  // hp bar graphics (world-space, update each frame)
  private barBg:   Phaser.GameObjects.Rectangle;
  private barFill: Phaser.GameObjects.Rectangle;
  private barBorder: Phaser.GameObjects.Rectangle;

  // callback fired when this skeleton damages the player
  onDamagePlayer?: (amount: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene  = scene;
    this.spawnX = x;
    this.spawnY = y;

    this.sprite = scene.physics.add.sprite(x, y, 'skeleton', 8 * 13);
    this.sprite.setScale(1.0);
    this.sprite.setSize(30, 20);
    this.sprite.setOffset(49, 90);
    this.sprite.setDepth(y);
    this.sprite.play('skeleton-idle-down');

    // ── health bar ────────────────────────────────────────────────────────
    const bx = x - HP_BAR_W / 2;
    const by = y + HP_BAR_Y_OFF;

    this.barBorder = scene.add.rectangle(x, by, HP_BAR_W + 2, HP_BAR_H + 2, 0x000000)
      .setDepth(900).setOrigin(0.5, 0.5);
    this.barBg     = scene.add.rectangle(x, by, HP_BAR_W,     HP_BAR_H,     0x440000)
      .setDepth(901).setOrigin(0.5, 0.5);
    this.barFill   = scene.add.rectangle(bx, by, HP_BAR_W,    HP_BAR_H,     0xff2222)
      .setDepth(902).setOrigin(0, 0.5);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  get isDead(): boolean { return this.state === 'dead'; }

  takeDamage(amount: number): void {
    if (this.state === 'dead') return;
    this.hp = Math.max(0, this.hp - amount);
    this.updateHpBar();

    if (this.hp <= 0) {
      this.die();
      return;
    }

    // flash red, enter hurt state
    this.sprite.setTint(0xff4444);
    this.state    = 'hurt';
    this.hurtTimer = HURT_DURATION;
    this.sprite.setVelocity(0, 0);
    this.playAnim('idle');
  }

  /**
   * Main update — call every frame from GameScene.
   * @param playerX   player world-x
   * @param playerY   player world-y
   * @param delta     ms since last frame
   * @param playerDead whether the player is dead (stop all AI)
   */
  update(playerX: number, playerY: number, delta: number, playerDead = false): void {
    if (this.state === 'dead') return;

    // ── hurt cooldown ──────────────────────────────────────────────────────
    if (this.state === 'hurt') {
      this.hurtTimer -= delta;
      if (this.hurtTimer <= 0) {
        this.sprite.clearTint();
        this.state = 'chase'; // always chase after being hit
      }
      this.updateBarPos();
      return;
    }

    if (playerDead) {
      this.idle();
      this.updateBarPos();
      return;
    }

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y, playerX, playerY,
    );

    // ── attack cooldown tick ───────────────────────────────────────────────
    if (this.attackCooldown > 0) this.attackCooldown -= delta;

    // ── state transitions ──────────────────────────────────────────────────
    if (this.state !== 'attack') {
      if (dist <= ATTACK_RANGE) {
        this.state = 'attack';
      } else if (dist <= AGGRO_RANGE) {
        this.state = 'chase';
      } else if (this.state === 'chase' && dist > DEAGGRO_RANGE) {
        this.state = 'idle';
      }
    } else if (dist > ATTACK_RANGE * 1.4) {
      this.state = dist <= AGGRO_RANGE ? 'chase' : 'idle';
    }

    // ── state behaviour ────────────────────────────────────────────────────
    switch (this.state) {
      case 'idle':   this.tickIdle(delta);   break;
      case 'patrol': this.tickPatrol();      break;
      case 'chase':  this.tickChase(playerX, playerY); break;
      case 'attack': this.tickAttack(playerX, playerY); break;
    }

    // ── depth sort ─────────────────────────────────────────────────────────
    this.sprite.setDepth(this.sprite.y);
    this.updateBarPos();
  }

  /** Returns false once the death tween has fully removed this skeleton. */
  get isRemoved(): boolean {
    return !this.sprite.scene;
  }

  destroy(): void {
    this.sprite.destroy();
    this.barBg.destroy();
    this.barFill.destroy();
    this.barBorder.destroy();
  }

  // ─── AI states ─────────────────────────────────────────────────────────────

  private tickIdle(delta: number): void {
    this.sprite.setVelocity(0, 0);
    this.playAnim('idle');

    this.patrolCooldown -= delta;
    if (this.patrolCooldown <= 0) {
      // pick a random point near spawn
      const angle = Math.random() * Math.PI * 2;
      const r     = Math.random() * PATROL_RADIUS;
      this.patrolTarget = {
        x: this.spawnX + Math.cos(angle) * r,
        y: this.spawnY + Math.sin(angle) * r,
      };
      this.state = 'patrol';
    }
  }

  private tickPatrol(): void {
    if (!this.patrolTarget) { this.state = 'idle'; return; }

    const dx = this.patrolTarget.x - this.sprite.x;
    const dy = this.patrolTarget.y - this.sprite.y;
    const d  = Math.sqrt(dx * dx + dy * dy);

    if (d < 6) {
      this.patrolTarget  = null;
      this.patrolCooldown = Phaser.Math.Between(PATROL_INTERVAL_MIN, PATROL_INTERVAL_MAX);
      this.state = 'idle';
      return;
    }

    this.moveToward(dx / d, dy / d, SPEED * 0.6);
    this.playAnim('walk');
  }

  private tickChase(px: number, py: number): void {
    const dx = px - this.sprite.x;
    const dy = py - this.sprite.y;
    const d  = Math.sqrt(dx * dx + dy * dy) || 1;
    this.moveToward(dx / d, dy / d, SPEED);
    this.playAnim('walk');
  }

  private tickAttack(px: number, py: number): void {
    this.sprite.setVelocity(0, 0);

    // face the player
    const dx = px - this.sprite.x;
    const dy = py - this.sprite.y;
    this.faceDirection(dx, dy);

    if (this.attackCooldown <= 0) {
      this.attackCooldown = ATTACK_CD;
      this.playAnim('attack');

      // deal damage mid-animation (~300 ms in)
      this.scene.time.delayedCall(300, () => {
        if (this.state === 'dead') return;
        const dist = Phaser.Math.Distance.Between(
          this.sprite.x, this.sprite.y, px, py,
        );
        if (dist <= ATTACK_RANGE * 1.2) {
          this.onDamagePlayer?.(ATTACK_DAMAGE);
        }
      });

      // after attack anim, back to chase/idle
      this.sprite.once('animationcomplete', () => {
        if (this.state === 'attack') this.state = 'chase';
      });
    } else {
      this.playAnim('idle');
    }
  }

  private idle(): void {
    this.sprite.setVelocity(0, 0);
    this.playAnim('idle');
  }

  // ─── Death ─────────────────────────────────────────────────────────────────

  private die(): void {
    this.state = 'dead';
    this.sprite.setVelocity(0, 0);
    this.sprite.disableBody(true, false);

    // hide HP bar immediately
    this.barBg.setVisible(false);
    this.barFill.setVisible(false);
    this.barBorder.setVisible(false);

    // Fade + shrink out
    this.scene.tweens.add({
      targets:  this.sprite,
      alpha:    0,
      scaleX:   0,
      scaleY:   0,
      duration: 600,
      ease:     'Power2',
      onComplete: () => this.destroy(),
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private moveToward(ndx: number, ndy: number, spd: number): void {
    this.sprite.setVelocity(ndx * spd, ndy * spd);
    this.faceDirection(ndx, ndy);
  }

  private faceDirection(dx: number, dy: number): void {
    if (Math.abs(dx) > Math.abs(dy)) {
      this.dirIndex = dx < 0 ? 1 : 2; // left / right
    } else {
      this.dirIndex = dy < 0 ? 3 : 0; // up / down
    }
  }

  private playAnim(type: 'idle' | 'walk' | 'attack'): void {
    const key = `skeleton-${type}-${DIR_NAMES[this.dirIndex]}`;
    if (this.sprite.anims.currentAnim?.key !== key) {
      this.sprite.anims.play(key, true);
    }
  }

  private updateHpBar(): void {
    const ratio = this.hp / MAX_HP;
    this.barFill.width = HP_BAR_W * ratio;
    this.barFill.setFillStyle(ratio > 0.5 ? 0xff2222 : ratio > 0.25 ? 0xff8800 : 0xff0000);
  }

  private updateBarPos(): void {
    const x = this.sprite.x;
    const y = this.sprite.y + HP_BAR_Y_OFF;
    this.barBorder.setPosition(x, y);
    this.barBg.setPosition(x, y);
    this.barFill.setPosition(x - HP_BAR_W / 2, y);
  }
}
