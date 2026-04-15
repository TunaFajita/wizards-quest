import Phaser from 'phaser';
import { TilesetGenerator } from '../generators/TilesetGenerator';
import { AnimationFactory } from '../generators/AnimationFactory';
import { ParticleTextureGenerator } from '../generators/ParticleTextureGenerator';
import { GlowTextureGenerator } from '../generators/GlowTextureGenerator';
import { AuthManager } from '../systems/AuthManager';

/** Loads all assets, generates runtime textures, then routes to Auth or Menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.load.tilemapTiledJSON('school-grounds', 'maps/school-grounds.json');

    // Character spritesheets (LPC 64×64, 13 cols)
    const sheetCfg = { frameWidth: 64, frameHeight: 64 };
    this.load.spritesheet('wizard',    'sprites/characters/M-Wizsheet.png',                sheetCfg);
    this.load.spritesheet('f-wizard',  'sprites/characters/F-Wizsheet.png',                sheetCfg);
    this.load.spritesheet('darklight', 'sprites/characters/Darklight2247-spritesheet.png', sheetCfg);

    // Mob spritesheets (LPC 128×128, 13 cols)
    this.load.spritesheet('skeleton', 'sprites/mobs/skeleton-spritesheet.png', { frameWidth: 128, frameHeight: 128 });

  }

  create(): void {
    TilesetGenerator.generate(this.textures);
    AnimationFactory.createAllAnimations(this.anims);
    ParticleTextureGenerator.generate(this.textures);
    GlowTextureGenerator.generate(this.textures);

    // Route based on existing session
    const session = AuthManager.getSession();
    this.scene.start(session ? 'MenuScene' : 'AuthScene');
  }
}
