import { TILE } from '@shared/constants';
import type { MapConfig } from '../maps';

export const schoolGroundsConfig: MapConfig = {
  key: 'school-grounds',
  jsonPath: 'maps/school-grounds.json',
  tilesetKey: 'tileset',
  groundLayerName: 'ground',
  collidableTiles: [TILE.WALL, TILE.WATER],
  torches: [
    { col: 5, row: 5 },   { col: 18, row: 5 },
    { col: 5, row: 18 },  { col: 18, row: 18 },
    { col: 3, row: 11 },  { col: 3, row: 12 },
    { col: 20, row: 11 }, { col: 20, row: 12 },
    { col: 11, row: 5 },  { col: 12, row: 5 },
    { col: 11, row: 18 }, { col: 12, row: 18 },
    { col: 11, row: 11 }, { col: 12, row: 12 },
  ],
  specialLights: [
    {
      col: 11.5, row: 11.5,
      radius: 280, color: 0xff8844, intensity: 2.5,
      glowAlpha: 0.6, glowScale: 3,
      pulseAlphaRange: [0.5, 0.7],
      pulseScaleRange: [2.8, 3.2],
      pulseDuration: 1500,
    },
  ],
  spawn: { col: 12, row: 14 },
  particles: {
    fireflies: { frequency: 400, quantity: 1 },
    fog: { frequency: 800, quantity: 1 },
  },
  backgroundColor: '#0a0a1e',
};
