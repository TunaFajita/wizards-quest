import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@shared/renderConstants';
import type { MapBounds } from './MapManager';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;

/** Manages camera follow, bounds, and vignette overlay. */
export class CameraManager {
  constructor(
    scene: Phaser.Scene,
    target: Phaser.GameObjects.Sprite,
    bounds: MapBounds,
    backgroundColor: string,
  ) {
    const cam = scene.cameras.main;
    cam.startFollow(target, true, 0.08, 0.08);
    cam.setBounds(bounds.offsetX, bounds.offsetY, bounds.widthPx, bounds.heightPx);
    cam.setBackgroundColor(backgroundColor);

    scene.input.on('wheel', (_pointer: unknown, _gameObjects: unknown, _deltaX: number, deltaY: number) => {
      const zoom = Phaser.Math.Clamp(cam.zoom - Math.sign(deltaY) * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
      cam.setZoom(zoom);
    });

    this.createVignette(scene);
  }

  private createVignette(scene: Phaser.Scene): void {
    const vignette = scene.add.graphics();
    vignette.setScrollFactor(0);
    vignette.setDepth(2000);

    const w = GAME_WIDTH;
    const h = GAME_HEIGHT;
    const thickness = 120;

    for (let i = 0; i < thickness; i++) {
      const alpha = 0.4 * (1 - i / thickness);
      vignette.fillStyle(0x0a0a1e, alpha);
      vignette.fillRect(i, i, w - i * 2, 1);
      vignette.fillRect(i, h - i, w - i * 2, 1);
      vignette.fillRect(i, i, 1, h - i * 2);
      vignette.fillRect(w - i, i, 1, h - i * 2);
    }
  }
}
