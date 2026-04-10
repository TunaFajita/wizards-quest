import Phaser from 'phaser';
import { PLAYER_SPEED, Direction } from '@shared/constants';

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;
  private direction: Direction = Direction.DOWN;
  private light: Phaser.GameObjects.Light | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // LPC sprite: 64x64 frames, character centered, feet near bottom
    this.sprite = scene.physics.add.sprite(x, y, 'wizard', 0);
    this.sprite.setSize(20, 14);
    this.sprite.setOffset(22, 48);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(y); // depth sorting by y position
  }

  setLight(light: Phaser.GameObjects.Light): void {
    this.light = light;
  }

  update(input: PlayerInput): void {
    let vx = 0;
    let vy = 0;

    if (input.left) vx -= 1;
    if (input.right) vx += 1;
    if (input.up) vy -= 1;
    if (input.down) vy += 1;

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      const diag = Math.SQRT1_2;
      vx *= diag;
      vy *= diag;
    }

    this.sprite.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);

    // Update direction and animation
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

    // Depth sort — objects lower on screen render in front
    this.sprite.setDepth(this.sprite.y);

    // Move player's light to follow
    if (this.light) {
      this.light.x = this.sprite.x;
      this.light.y = this.sprite.y;
    }
  }

  private playAnim(type: 'idle' | 'walk' | 'cast'): void {
    const dirNames = ['down', 'left', 'right', 'up'];
    const key = `wizard-${type}-${dirNames[this.direction]}`;
    if (this.sprite.anims.currentAnim?.key !== key) {
      this.sprite.anims.play(key, true);
    }
  }
}
