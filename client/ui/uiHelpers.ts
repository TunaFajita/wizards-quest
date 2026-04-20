import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@shared/renderConstants';

/** Pixel-art double-border with corner accents. */
export function drawPixelBorder(
  gfx: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number, color: number,
): void {
  gfx.fillStyle(color, 1);
  gfx.fillRect(x, y, w, 2);
  gfx.fillRect(x, y + h - 2, w, 2);
  gfx.fillRect(x, y, 2, h);
  gfx.fillRect(x + w - 2, y, 2, h);
  gfx.fillRect(x + 4, y + 4, 2, 2);
  gfx.fillRect(x + w - 6, y + 4, 2, 2);
  gfx.fillRect(x + 4, y + h - 6, 2, 2);
  gfx.fillRect(x + w - 6, y + h - 6, 2, 2);
}

/** Seeded random dot-field used as background across UI scenes. */
export function drawStarfield(
  gfx: Phaser.GameObjects.Graphics,
  seed: string,
  count: number,
  colors: number[] = [0x222244, 0x333366, 0x444488],
  alphaRange: [number, number] = [0.3, 0.8],
): void {
  const rng = new Phaser.Math.RandomDataGenerator([seed]);
  for (let i = 0; i < count; i++) {
    gfx.fillStyle(rng.pick(colors), rng.realInRange(alphaRange[0], alphaRange[1]));
    gfx.fillRect(rng.integerInRange(0, GAME_WIDTH), rng.integerInRange(0, GAME_HEIGHT), 1, 1);
  }
}
