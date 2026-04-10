import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from '@shared/constants';

/** Convert isometric tile coordinates to Phaser world pixel coordinates. */
export function isoToWorld(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * ISO_TILE_WIDTH / 2,
    y: (col + row) * ISO_TILE_HEIGHT / 2,
  };
}
