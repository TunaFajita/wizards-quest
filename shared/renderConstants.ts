// Game viewport
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

// Lighting defaults
export const AMBIENT_COLOR = 0x222244;
export const TORCH_COLOR = 0xff9933;
export const TORCH_RADIUS = 180;
export const TORCH_INTENSITY = 1.5;

// House colors (UI / character tinting)
export const HOUSE_COLORS = {
  solheim: { primary: 0xffd700, secondary: 0xdc143c },
  thornveil: { primary: 0xc0c0c0, secondary: 0x228b22 },
  luminara: { primary: 0x4169e1, secondary: 0xffffff },
  noctis: { primary: 0x9b59b6, secondary: 0x1a1a2e },
} as const;
