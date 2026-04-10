// Isometric tile dimensions
export const ISO_TILE_WIDTH = 64;
export const ISO_TILE_HEIGHT = 32;
export const TILE_IMG_HEIGHT = 64; // actual tile image height (includes wall elevation)

// Map
export const MAP_COLS = 24;
export const MAP_ROWS = 24;

// Player
export const PLAYER_SPEED = 100; // pixels per second
export const PLAYER_SIZE = 32;

// Directions
export enum Direction {
  DOWN = 0,
  LEFT = 1,
  RIGHT = 2,
  UP = 3,
}

// Tile IDs (Tiled JSON uses 1-based, 0 = empty)
export const TILE = {
  STONE: 1,
  GRASS: 2,
  WALL: 3,
  WATER: 4,
  DARK_STONE: 5,
} as const;
