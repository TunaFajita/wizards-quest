import Phaser from 'phaser';

type Dir = 'down' | 'left' | 'right' | 'up';

const DIR_VEL: Record<Dir, [number, number]> = {
  down:  [ 0,  1],
  up:    [ 0, -1],
  left:  [-1,  0],
  right: [ 1,  0],
};

const DIRS: Dir[] = ['down', 'left', 'right', 'up'];

// ── Constants ─────────────────────────────────────────────────────────────────
const SPEED          = 55;
const AGGRO_RANGE    = 220;
const ATTACK_RANGE   = 28;
const ATTACK_DMG     = 12;
const ATTACK_CD_MS   = 1400;

const BAR_W  = 34;
const BAR_H  = 4;
const BAR_OY = -14; // pixels above sprite centre

export class Mob {
  public  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly hpBg:   Phaser.GameObjects.Graphics;
  private readonly hpFg:   Phaser.GameObjects.Graphics;
  private readonly prefix: string;

  private hp:          number;
  private readonly maxHp: number;
  private attackCd    = 0;
  private wanderTimer = 0;
  private wanderVx    = 0;
  private wanderVy    = 0;
  private _dead       = false;
  private _dying      = false;
  private direction: Dir = 'down';

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    textureKey: string,
    prefix: string,
    maxHp = 80,
  ) {
    this.prefix = prefix;
    this.maxHp  = this.hp = maxHp;

    this.sprite = scene.physics.add.sprite(x, y, textureKey, 0);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(y);
    this.sprite.setPipeline('Light2D');

    // Health bar — two Graphics layers so we only redraw fg on damage
    this.hpBg = scene.add.graphics();
    this.hpFg = scene.add.graphics();
    this.drawHpBar();
  }

  get isDead(): boolean { return this._dead; }

  /** All world-space game objects owned by this mob (for camera ignore lists). */
  worldObjects(): Phaser.GameObjects.GameObject[] {
    return [this.sprite, this.hpBg, this.hpFg];
  }

  hurt(dmg: number): void {
    if (this._dead || this._dying) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.drawHpBar();
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    this._dying = true;
    this.hpBg.destroy();
    this.hpFg.destroy();
    (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.sprite.setTint(0xff2222);

    const dieKey = `${this.prefix}-die-${this.direction}`;
    const hasAnim = this.sprite.anims.animationManager.exists(dieKey);
    if (hasAnim) {
      this.sprite.play(dieKey);
      this.sprite.once('animationcomplete', () => this.destroySprite());
    } else {
      this.sprite.scene.time.delayedCall(600, () => this.destroySprite());
    }
  }

  private destroySprite(): void {
    this._dead = true;
    this.sprite.destroy();
  }

  private drawHpBar(): void {
    const bx = this.sprite.x - BAR_W / 2;
    const by = this.sprite.y + BAR_OY;

    this.hpBg.clear();
    this.hpBg.fillStyle(0x1a0000, 0.85);
    this.hpBg.fillRect(bx - 1, by - 1, BAR_W + 2, BAR_H + 2);
    this.hpBg.lineStyle(1, 0x440000, 1);
    this.hpBg.strokeRect(bx - 1, by - 1, BAR_W + 2, BAR_H + 2);

    const pct   = this.hp / this.maxHp;
    const color = pct > 0.5 ? 0x33dd55 : pct > 0.25 ? 0xffaa00 : 0xff3300;
    this.hpFg.clear();
    this.hpFg.fillStyle(color, 1);
    this.hpFg.fillRect(bx, by, Math.max(0, BAR_W * pct), BAR_H);
  }

  private playWalk(dir: Dir): void {
    const key = `${this.prefix}-walk-${dir}`;
    if (
      this.sprite.anims.animationManager.exists(key) &&
      this.sprite.anims.currentAnim?.key !== key
    ) {
      this.sprite.play(key, true);
    }
  }

  private angleToDir(rad: number): Dir {
    const deg = Phaser.Math.RadToDeg(rad);
    if (deg >= -45 && deg < 45)   return 'right';
    if (deg >= 45  && deg < 135)  return 'down';
    if (deg >= 135 || deg < -135) return 'left';
    return 'up';
  }

  update(
    delta: number,
    playerSprite: Phaser.Physics.Arcade.Sprite,
    onHitPlayer: (dmg: number) => void,
  ): void {
    if (this._dead || this._dying) return;

    this.attackCd = Math.max(0, this.attackCd - delta);

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      playerSprite.x, playerSprite.y,
    );

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    if (dist <= ATTACK_RANGE) {
      // ── Attack ────────────────────────────────────────────────────────────
      body.setVelocity(0, 0);
      this.sprite.anims.stop();
      if (this.attackCd <= 0) {
        this.attackCd = ATTACK_CD_MS;
        onHitPlayer(ATTACK_DMG);
      }
    } else if (dist <= AGGRO_RANGE) {
      // ── Chase ─────────────────────────────────────────────────────────────
      const angle = Phaser.Math.Angle.Between(
        this.sprite.x, this.sprite.y,
        playerSprite.x, playerSprite.y,
      );
      body.setVelocity(Math.cos(angle) * SPEED, Math.sin(angle) * SPEED);
      this.direction = this.angleToDir(angle);
      this.playWalk(this.direction);
    } else {
      // ── Wander ────────────────────────────────────────────────────────────
      this.wanderTimer -= delta;
      if (this.wanderTimer <= 0) {
        const idle = Math.random() < 0.4;
        if (idle) {
          this.wanderVx = this.wanderVy = 0;
          body.setVelocity(0, 0);
          this.sprite.anims.stop();
          this.wanderTimer = 800 + Math.random() * 1200;
        } else {
          const d = DIRS[Math.floor(Math.random() * DIRS.length)];
          [this.wanderVx, this.wanderVy] = DIR_VEL[d].map(v => v * 30) as [number, number];
          body.setVelocity(this.wanderVx, this.wanderVy);
          this.direction = d;
          this.playWalk(d);
          this.wanderTimer = 600 + Math.random() * 1000;
        }
      }
    }

    this.sprite.setDepth(this.sprite.y);

    // Update health bar position every frame
    const bx = this.sprite.x - BAR_W / 2;
    const by = this.sprite.y + BAR_OY;
    this.hpBg.setPosition(0, 0); // graphics uses absolute coords via fillRect
    this.hpFg.setPosition(0, 0);

    // Redraw bar at new position
    const pct   = this.hp / this.maxHp;
    const color = pct > 0.5 ? 0x33dd55 : pct > 0.25 ? 0xffaa00 : 0xff3300;
    this.hpBg.clear();
    this.hpBg.fillStyle(0x1a0000, 0.85);
    this.hpBg.fillRect(bx - 1, by - 1, BAR_W + 2, BAR_H + 2);
    this.hpBg.lineStyle(1, 0x440000, 1);
    this.hpBg.strokeRect(bx - 1, by - 1, BAR_W + 2, BAR_H + 2);
    this.hpFg.clear();
    this.hpFg.fillStyle(color, 1);
    this.hpFg.fillRect(bx, by, Math.max(0, BAR_W * pct), BAR_H);

    this.hpBg.setDepth(this.sprite.depth + 1);
    this.hpFg.setDepth(this.sprite.depth + 2);
  }
}
