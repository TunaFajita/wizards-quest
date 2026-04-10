export interface TorchConfig {
  col: number;
  row: number;
}

export interface SpecialLightConfig {
  col: number;
  row: number;
  radius: number;
  color: number;
  intensity: number;
  glowAlpha: number;
  glowScale: number;
  pulseAlphaRange: [number, number];
  pulseScaleRange: [number, number];
  pulseDuration: number;
}

export interface SpawnConfig {
  col: number;
  row: number;
}

export interface ParticleConfig {
  fireflies: { frequency: number; quantity: number };
  fog: { frequency: number; quantity: number };
}

export interface MapConfig {
  key: string;
  jsonPath: string;
  tilesetKey: string;
  groundLayerName: string;
  collidableTiles: number[];
  torches: TorchConfig[];
  specialLights: SpecialLightConfig[];
  spawn: SpawnConfig;
  particles: ParticleConfig;
  backgroundColor: string;
}
