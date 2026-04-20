import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@shared/renderConstants';
import { BootScene } from './scenes/BootScene';
import { AuthScene } from './scenes/AuthScene';
import { MenuScene } from './scenes/MenuScene';
import { SlotSelectScene } from './scenes/SlotSelectScene';
import { CharacterScene } from './scenes/CharacterScene';
import { GameScene } from './scenes/GameScene';
import { SettingsScene } from './scenes/SettingsScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL, // Required for Light2D pipeline
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  render: {
    antialias:    false,
    antialiasGL:  false,
    roundPixels:  true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, AuthScene, MenuScene, SlotSelectScene, CharacterScene, GameScene, SettingsScene],
  backgroundColor: '#0a0a1e',
};

const game = new Phaser.Game(config);

// Destroy the old game instance on Vite HMR reloads to prevent
// multiple stacked canvases / duplicate entities.
if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
