import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@shared/renderConstants';
import { BootScene } from './scenes/BootScene';
import { AuthScene } from './scenes/AuthScene';
import { MenuScene } from './scenes/MenuScene';
import { SlotSelectScene } from './scenes/SlotSelectScene';
import { CharacterScene } from './scenes/CharacterScene';
import { GameScene } from './scenes/GameScene';
import { SettingsScene } from './scenes/SettingsScene';

// Render the canvas at DPR× resolution so text is crisp on Retina/HiDPI
// displays. Phaser maps all coordinates to the base 960×540 space internally.
const DPR = Math.ceil(window.devicePixelRatio || 1);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  zoom: DPR,
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

// pixelArt:true forces NEAREST on ALL textures including text. Override the
// text factory so every text object uses LINEAR filtering for smooth glyphs.
const _origText = Phaser.GameObjects.GameObjectFactory.prototype.text;
(Phaser.GameObjects.GameObjectFactory.prototype as any).text = function (...args: any[]) {
  const t = _origText.apply(this, args);
  t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return t;
};

const game = new Phaser.Game(config);

// Destroy the old game instance on Vite HMR reloads to prevent
// multiple stacked canvases / duplicate entities.
if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
