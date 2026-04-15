import Phaser from 'phaser';
import { PLAYER_SPEED, Direction } from '@shared/constants';

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Maps each weapon type to the LPC animation it should play on action.
 * Extend this as new item types are added.
 */
export type WeaponType = 'unarmed' | 'sword' | 'axe' | 'staff' | 'spear';

const WEAPON_ANIM: Record<WeaponType, 'thrust' | 'slash' | 'cast'> = {
  unarmed: 'slash',
  sword:   'slash',
  axe:     'slash',
  staff:   'cast',
  spear:   'thrust',
};

export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;
  private direction: Direction = Direction.DOWN;
  private light: Phaser.GameObjects.Light | null = null;
  private animPrefix: string;

  private equippedWeapon: WeaponType = 'unarmed';
  private isAttacking = false;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey = 'wizard', animPrefix = 'wizard') {
    this.animPrefix = animPrefix;
    this.sprite = scene.physics.add.sprite(x, y, textureKey, 0);
    this.sprite.setSize(20, 14);
    this.sprite.setOffset(22, 48);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(y);

    // Resume movement once an action animation finishes
    this.sprite.on('animationcomplete', (anim: Phaser.Animations.Animation) => {
      const actionAnims = ['thrust', 'slash', 'cast'];
      if (actionAnims.some(a => anim.key.includes(`-${a}-`))) {
        this.isAttacking = false;
      }
    });
  }

  setLight(light: Phaser.GameObjects.Light): void {
    this.light = light;
  }

  equipWeapon(type: WeaponType): void {
    this.equippedWeapon = type;
  }

  /** Called on left mouse click. Plays the correct action animation for the equipped item. */
  attack(): void {
    if (this.isAttacking) return;
    this.isAttacking = true;
    this.playAnim(WEAPON_ANIM[this.equippedWeapon]);
    // Emit so GameScene can check skeleton hit-detection
    this.sprite.emit('player-attack');
  }

  update(input: PlayerInput): void {
    let vx = 0;
    let vy = 0;

    if (input.left)  vx -= 1;
    if (input.right) vx += 1;
    if (input.up)    vy -= 1;
    if (input.down)  vy += 1;

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      const diag = Math.SQRT1_2;
      vx *= diag;
      vy *= diag;
    }

    this.sprite.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);

    // Don't override action animation while attacking
    if (!this.isAttacking) {
      if (vx !== 0 || vy !== 0) {
        if (Math.abs(vx) > Math.abs(vy)) {
          this.direction = vx < 0 ? Direction.LEFT : Direction.RIGHT;
        } else {
          this.direction = vy < 0 ? Direction.UP : Direction.DOWN;
        }
        this.playAnim('walk');
      } else {
        this.playAnim('idle');
      }
    }

    // Depth sort
    this.sprite.setDepth(this.sprite.y);

    // Follow player light
    if (this.light) {
      this.light.x = this.sprite.x;
      this.light.y = this.sprite.y;
    }
  }

  private playAnim(type: 'idle' | 'walk' | 'cast' | 'thrust' | 'slash'): void {
    const dirNames = ['down', 'left', 'right', 'up'];
    const key = `${this.animPrefix}-${type}-${dirNames[this.direction]}`;
    if (this.sprite.anims.currentAnim?.key !== key) {
      this.sprite.anims.play(key, true);
    }
  }
}
