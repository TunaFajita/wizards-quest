import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { InputManager } from '../systems/InputManager';
import { MapManager } from '../managers/MapManager';
import { LightingManager } from '../managers/LightingManager';
import { ParticleManager } from '../managers/ParticleManager';
import { CameraManager } from '../managers/CameraManager';
import { isoToWorld } from '../utils/isoHelper';
import { schoolGroundsConfig } from '../config/maps/school-grounds.config';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputManager!: InputManager;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    const config = schoolGroundsConfig;

    // Map
    const mapManager = new MapManager(this, config);

    // Lighting
    const lighting = new LightingManager(this, config, mapManager.groundLayer);

    // Player
    const spawnPos = isoToWorld(config.spawn.col, config.spawn.row);
    this.player = new Player(this, spawnPos.x, spawnPos.y);
    this.physics.add.collider(this.player.sprite, mapManager.groundLayer);
    const playerLight = lighting.createPlayerLight(this, spawnPos.x, spawnPos.y);
    this.player.setLight(playerLight);
    this.player.sprite.setPipeline('Light2D');

    // Input
    this.inputManager = new InputManager(this);

    // Camera
    new CameraManager(this, this.player.sprite, mapManager.bounds, config.backgroundColor);

    // Particles
    new ParticleManager(this, mapManager.bounds, config);

    // Physics bounds
    const { offsetX, offsetY, widthPx, heightPx } = mapManager.bounds;
    this.physics.world.setBounds(offsetX, offsetY, widthPx, heightPx);
  }

  update(_time: number, _delta: number): void {
    const input = this.inputManager.getInput();
    this.player.update(input);
  }
}
