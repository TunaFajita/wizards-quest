import Phaser from 'phaser';
import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT, MAP_COLS, MAP_ROWS } from '@shared/constants';
import type { MapConfig } from '../config/maps';

export interface MapBounds {
  widthPx: number;
  heightPx: number;
  offsetX: number;
  offsetY: number;
}

/** Handles tilemap creation, collision, and bounds for a single map. */
export class MapManager {
  readonly map: Phaser.Tilemaps.Tilemap;
  readonly groundLayer: Phaser.Tilemaps.TilemapLayer;
  readonly bounds: MapBounds;

  constructor(scene: Phaser.Scene, config: MapConfig) {
    this.map = scene.make.tilemap({ key: config.key });
    const tileset = this.map.addTilesetImage(config.tilesetKey, config.tilesetKey, 64, 64, 0, 0)!;
    this.groundLayer = this.map.createLayer(config.groundLayerName, tileset, 0, 0)!;
    this.groundLayer.setCollision(config.collidableTiles);

    const w = (MAP_COLS + MAP_ROWS) * ISO_TILE_WIDTH / 2;
    const h = (MAP_COLS + MAP_ROWS) * ISO_TILE_HEIGHT / 2 + 64;
    this.bounds = {
      widthPx: w,
      heightPx: h,
      offsetX: -w / 2,
      offsetY: -64,
    };
  }
}
