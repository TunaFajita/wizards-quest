import Phaser from 'phaser';
import { TilesetGenerator } from '../generators/TilesetGenerator';
import { AnimationFactory } from '../generators/AnimationFactory';
import { ParticleTextureGenerator } from '../generators/ParticleTextureGenerator';
import { GlowTextureGenerator } from '../generators/GlowTextureGenerator';

/** Loads assets and generates runtime textures, then starts the game. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.load.tilemapTiledJSON('school-grounds', 'maps/school-grounds.json');
    this.load.spritesheet('wizard', 'sprites/characters/character-spritesheet.png', {
      frameWidth: 64,
      frameHeight: 64,
    });
  }

  create(): void {
    TilesetGenerator.generate(this.textures);
    AnimationFactory.createWizardAnimations(this.anims);
    ParticleTextureGenerator.generate(this.textures);
    GlowTextureGenerator.generate(this.textures);
    this.scene.start('GameScene');
  }
}
