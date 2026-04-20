import Phaser from 'phaser';
import { PLAYER_SPEED, Direction } from '@shared/constants';

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

const DIR_NAMES = ['down', 'left', 'right', 'up'] as const;

export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;
  private direction: Direction = Direction.DOWN;
  private light: Phaser.GameObjects.Light | null = null;
  private animPrefix: string;

  private isAttacking = false;
  private isSitting   = false;
  private isDead      = false;
  private isJumping   = false;
  private isSprinting = false;
  private activeEmote: string | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey = 'wizard', animPrefix = 'wizard') {
    this.animPrefix = animPrefix;
    this.sprite = scene.physics.add.sprite(x, y, textureKey, 0);
    this.sprite.setSize(20, 14);
    this.sprite.setOffset(22, 48);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(y);

    this.sprite.on('animationcomplete', (anim: Phaser.Animations.Animation) => {
      if (['thrust', 'slash', 'cast', 'shoot'].some(a => anim.key.includes(`-${a}-`))) {
        this.isAttacking = false;
      }
      if (anim.key.includes('-emote-')) {
        if (this.activeEmote && !anim.repeat) this.activeEmote = null;
      }
      if (anim.key.includes('-jump-')) {
        this.isJumping = false;
        if (!this.isAttacking && !this.isSitting && !this.isDead) {
          this.playDirectional('idle');
        }
      }
    });
  }

  setLight(light: Phaser.GameObjects.Light): void {
    this.light = light;
  }

  attack(): void {
    if (this.isAttacking || this.isDead) return;
    this.isAttacking = true;
    this.playDirectional('slash');
    this.sprite.emit('player-attack');
  }

  hurt(): void {
    if (this.isDead) return;
    this.sprite.setTint(0xff4444);
  }

  die(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.isAttacking = false;
    this.sprite.setVelocity(0, 0);
    this.playDirectional('die');
  }

  jump(): void {
    if (this.isDead || this.isJumping) return;
    this.isJumping = true;
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

  get sitting(): boolean { return this.isSitting; }

  get sprinting(): boolean {
    if (!this.isSprinting) return false;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return false;
    return body.velocity.x !== 0 || body.velocity.y !== 0;
  }

  emote(name: 'wave' | 'sit' | 'jump' | null): void {
    if (this.isDead) return;

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
      const variant = Math.random() < 0.5 ? 0 : 1;
      this.sprite.anims.play(
        `${this.animPrefix}-sit-idle-${variant}-${DIR_NAMES[this.direction]}`, true,
      );
    } else if (name === 'jump') {
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

    if ((vx !== 0 || vy !== 0) && (this.isSitting || this.activeEmote)) {
      this.isSitting   = false;
      this.activeEmote = null;
    }

    if (!this.isAttacking && !this.isSitting && !this.activeEmote && !this.isDead && !this.isJumping) {
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
