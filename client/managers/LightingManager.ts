import Phaser from 'phaser';
import { AMBIENT_COLOR, TORCH_COLOR, TORCH_RADIUS, TORCH_INTENSITY } from '@shared/renderConstants';
import { isoToWorld } from '../utils/isoHelper';
import type { MapConfig } from '../config/maps';

/** Manages ambient lighting, torch lights, and special lights for a map. */
export class LightingManager {
  constructor(
    scene: Phaser.Scene,
    config: MapConfig,
    groundLayer: Phaser.Tilemaps.TilemapLayer,
  ) {
    scene.lights.enable();
    scene.lights.setAmbientColor(AMBIENT_COLOR);
    groundLayer.setPipeline('Light2D');

    this.createTorchLights(scene, config);
    this.createSpecialLights(scene, config);
  }

  createPlayerLight(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Light {
    return scene.lights.addLight(x, y, 200, 0xffeedd, 1.2);
  }

  private createTorchLights(scene: Phaser.Scene, config: MapConfig): void {
    for (const torch of config.torches) {
      const pos = isoToWorld(torch.col, torch.row);
      scene.lights.addLight(pos.x, pos.y, TORCH_RADIUS, TORCH_COLOR, TORCH_INTENSITY);

      const glow = scene.add.image(pos.x, pos.y - 16, 'glow');
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setAlpha(0.4);
      glow.setScale(1.5);
      glow.setDepth(pos.y - 1);

      scene.tweens.add({
        targets: glow,
        alpha: { from: 0.3, to: 0.55 },
        scale: { from: 1.4, to: 1.6 },
        duration: 800 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private createSpecialLights(scene: Phaser.Scene, config: MapConfig): void {
    for (const light of config.specialLights) {
      const pos = isoToWorld(light.col, light.row);
      scene.lights.addLight(pos.x, pos.y, light.radius, light.color, light.intensity);

      const glow = scene.add.image(pos.x, pos.y - 20, 'glow');
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setAlpha(light.glowAlpha);
      glow.setScale(light.glowScale);
      glow.setDepth(pos.y - 1);

      scene.tweens.add({
        targets: glow,
        alpha: { from: light.pulseAlphaRange[0], to: light.pulseAlphaRange[1] },
        scale: { from: light.pulseScaleRange[0], to: light.pulseScaleRange[1] },
        duration: light.pulseDuration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
}
