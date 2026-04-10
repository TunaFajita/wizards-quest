import Phaser from 'phaser';
import type { MapBounds } from './MapManager';
import type { MapConfig } from '../config/maps';

/** Creates atmospheric particle emitters (fireflies, fog) for a map. */
export class ParticleManager {
  constructor(scene: Phaser.Scene, bounds: MapBounds, config: MapConfig) {
    this.createFireflies(scene, bounds, config);
    this.createFog(scene, bounds, config);
  }

  private createFireflies(scene: Phaser.Scene, bounds: MapBounds, config: MapConfig): void {
    scene.add.particles(0, 0, 'firefly', {
      x: { min: bounds.offsetX, max: bounds.offsetX + bounds.widthPx },
      y: { min: 0, max: bounds.heightPx },
      lifespan: { min: 3000, max: 6000 },
      speed: { min: 5, max: 20 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0, end: 0.8, ease: 'Sine.easeInOut' },
      blendMode: Phaser.BlendModes.ADD,
      frequency: config.particles.fireflies.frequency,
      quantity: config.particles.fireflies.quantity,
    }).setDepth(1000);
  }

  private createFog(scene: Phaser.Scene, bounds: MapBounds, config: MapConfig): void {
    scene.add.particles(0, 0, 'fog', {
      x: { min: bounds.offsetX, max: bounds.offsetX + bounds.widthPx },
      y: { min: 0, max: bounds.heightPx },
      lifespan: { min: 6000, max: 10000 },
      speedX: { min: 5, max: 15 },
      speedY: { min: -3, max: 3 },
      scale: { start: 1, end: 2 },
      alpha: { start: 0, end: 0.15 },
      blendMode: Phaser.BlendModes.ADD,
      frequency: config.particles.fog.frequency,
      quantity: config.particles.fog.quantity,
    }).setDepth(999);
  }
}
