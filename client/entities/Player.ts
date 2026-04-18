import Phaser from 'phaser';
import { PLAYER_SPEED, Direction } from '@shared/constants';

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export type WeaponType = 'unarmed' | 'sword' | 'axe' | 'staff' | 'spear' | 'bow';

const WEAPON_ANIM: Record<WeaponType, 'thrust' | 'slash' | 'cast' | 'shoot'> = {
  unarmed: 'slash',
  sword:   'slash',
  axe:     'slash',
  staff:   'cast',
  spear:   'thrust',
  bow:     'shoot',
};

const DIR_NAMES = ['down', 'left', 'right', 'up'] as const;

export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;
  private direction: Direction = Direction.DOWN;
  private light: Phaser.GameObjects.Light | null = null;
  private animPrefix: string;

  private equippedWeapon: WeaponType = 'unarmed';
  private isAttacking  = false;
  private isClimbing   = false;
  private isSitting    = false;
  private isDead       = false;
  private isJumping    = false;
  private isSprinting  = false;
  private activeEmote: string | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey = 'wizard', animPrefix = 'wizard') {
    this.animPrefix = animPrefix;
    this.sprite = scene.physics.add.sprite(x, y, textureKey, 0);
    this.sprite.setSize(20, 14);
    this.sprite.setOffset(22, 48);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(y);

    this.sprite.on('animationcomplete', (anim: Phaser.Animations.Animation) => {
      const attackAnims = ['thrust', 'slash', 'cast', 'shoot'];
      if (attackAnims.some(a => anim.key.includes(`-${a}-`))) {
        this.isAttacking = false;
      }
      if (anim.key.includes('-emote-')) {
        if (this.activeEmote && !anim.repeat) this.activeEmote = null;
      }
      // Jump animation ended — guarantee we return to idle regardless of tween timing.
      if (anim.key.includes('-jump-')) {
        this.isJumping = false;
        if (!this.isAttacking && !this.isClimbing && !this.isSitting && !this.isDead) {
          this.playDirectional('idle');
        }
      }
    });
  }

  setLight(light: Phaser.GameObjects.Light): void {
    this.light = light;
  }

  equipWeapon(type: WeaponType): void {
    this.equippedWeapon = type;
  }

  attack(): void {
    if (this.isAttacking || this.isDead) return;
    this.isAttacking = true;
    this.playDirectional(WEAPON_ANIM[this.equippedWeapon]);
    this.sprite.emit('player-attack');
  }

  hurt(): void {
    if (this.isDead) return;
    // Tint-only hit flash — no knockdown animation so movement isn't interrupted.
    // The tint is cleared by a delayedCall in GameScene after the iframe window.
    this.sprite.setTint(0xff4444);
  }

  die(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.isAttacking = false;
    this.isClimbing  = false;
    this.sprite.setVelocity(0, 0);
    this.playDirectional('die');
  }

  /** Start climbing. LPC v3 has a single non-directional climb animation. */
  startClimb(_goingUp = true): void {
    if (this.isDead) return;
    this.isClimbing  = true;
    this.isAttacking = false;
    const key = `${this.animPrefix}-climb`;
    if (this.sprite.anims.currentAnim?.key !== key) {
      this.sprite.anims.play(key, true);
    }
  }

  stopClimb(): void {
    this.isClimbing = false;
  }

  jump(): void {
    if (this.isDead || this.isClimbing || this.isJumping) return;
    this.isJumping = true;

    // Jump is directional in LPC v3
    this.playDirectional('jump');

    const originY = this.sprite.y;
    this.sprite.scene.tweens.add({
      targets:  this.sprite,
      y:        originY - 28,
      duration: 240,
      ease:     'Sine.easeOut',
      yoyo:     true,
      onComplete: () => {
        this.sprite.y = originY;
        this.isJumping = false;
      },
    });
  }

  setSprinting(on: boolean): void {
    this.isSprinting = on;
  }

  toggleSit(): void {
    if (this.isDead || this.isClimbing || this.isAttacking) return;
    if (this.isSitting) {
      this.isSitting = false;
      this.sprite.setVelocity(0, 0);
      this.playDirectional('idle');
    } else {
      this.isSitting   = true;
      this.activeEmote = null;
      this.sprite.setVelocity(0, 0);
      this.playGroundSitPose();
    }
  }

  /** Hold a random ground-sit pose (col 0 or 1). Col 2 is reserved for chair-sit. */
  private playGroundSitPose(): void {
    const variant = Math.random() < 0.5 ? 0 : 1;
    const key = `${this.animPrefix}-sit-idle-${variant}-${DIR_NAMES[this.direction]}`;
    this.sprite.anims.play(key, true);
  }

  get sitting(): boolean { return this.isSitting; }

  /** True only when shift is held AND the player is actually moving. */
  get sprinting(): boolean {
    if (!this.isSprinting) return false;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return false;
    return body.velocity.x !== 0 || body.velocity.y !== 0;
  }

  /**
   * Play an emote using animations that exist in the LPC v3 sheet:
   *   wave → rows 34-37 (dedicated emote gesture, 3 frames)
   *   sit  → rows 30-33 (character sits down, holds sit-idle)
   *   jump → rows 26-29 (jumping hop)
   */
  emote(name: 'wave' | 'sit' | 'jump' | null): void {
    if (this.isDead) return;

    // Toggle off or cancel current emote
    if (name === null || this.activeEmote === name) {
      this.activeEmote = null;
      this.isSitting   = false;
      this.playDirectional('idle');
      return;
    }

    this.isAttacking = false;

    if (name === 'wave') {
      this.activeEmote = 'wave';
      this.isSitting   = false;
      this.playDirectional('emote');
    } else if (name === 'sit') {
      this.activeEmote = 'sit';
      this.isSitting   = true;
      this.sprite.setVelocity(0, 0);
      this.playGroundSitPose();
    } else if (name === 'jump') {
      // jump() manages its own isJumping state; don't hold activeEmote for it
      this.activeEmote = null;
      this.jump();
    }
  }

  update(input: PlayerInput): void {
    let vx = 0;
    let vy = 0;

    if (input.left)  vx -= 1;
    if (input.right) vx += 1;
    if (input.up)    vy -= 1;
    if (input.down)  vy += 1;

    if (vx !== 0 && vy !== 0) {
      const diag = Math.SQRT1_2;
      vx *= diag;
      vy *= diag;
    }

    const sprinting = this.isSprinting && (vx !== 0 || vy !== 0);
    const speed     = sprinting ? PLAYER_SPEED * 1.6 : PLAYER_SPEED;
    this.sprite.setVelocity(vx * speed, vy * speed);

    // Movement cancels sit / emote pose
    if ((vx !== 0 || vy !== 0) && (this.isSitting || this.activeEmote)) {
      this.isSitting   = false;
      this.activeEmote = null;
    }

    if (!this.isAttacking && !this.isClimbing && !this.isSitting && !this.activeEmote && !this.isDead && !this.isJumping) {
      if (vx !== 0 || vy !== 0) {
        if (Math.abs(vx) > Math.abs(vy)) {
          this.direction = vx < 0 ? Direction.LEFT : Direction.RIGHT;
        } else {
          this.direction = vy < 0 ? Direction.UP : Direction.DOWN;
        }
        this.playDirectional(sprinting ? 'run' : 'walk');
      } else {
        this.playDirectional('idle');
      }
    }

    this.sprite.setDepth(this.sprite.y);

    if (this.light) {
      this.light.x = this.sprite.x;
      this.light.y = this.sprite.y;
    }
  }

  private playDirectional(type: string): void {
    const key = `${this.animPrefix}-${type}-${DIR_NAMES[this.direction]}`;
    if (this.sprite.anims.currentAnim?.key !== key) {
      this.sprite.anims.play(key, true);
    }
  }
}
