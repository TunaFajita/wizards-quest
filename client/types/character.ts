/** A single option within a layer slot (e.g. "Brown Hair", "None") */
export interface LayerOption {
  id: string;
  label: string;
  /** Phaser texture key to render. null = invisible (skip this layer). */
  textureKey: string | null;
  /** Animation key prefix for this texture (e.g. 'wizard', 'f-wizard'). */
  animPrefix?: string;
  /** Optional tint color applied to the sprite (hex number). */
  tint?: number;
  /** If set, only the account with this exact username can see/use this option. */
  requiredUsername?: string;
}

/** A customisable layer slot (e.g. Body, Hair, Outfit) */
export interface LayerSlot {
  id: string;
  label: string;
  options: LayerOption[];
  /** Whether this slot is locked/coming soon */
  locked?: boolean;
}

/** A named preset that pre-fills all layer selections */
export interface CharacterPreset {
  id: string;
  label: string;
  /** Emoji or short symbol shown on the preset button */
  symbol: string;
  /** Maps slotId → optionId */
  layers: Record<string, string>;
  /** If set, only the account with this exact username can see this preset. */
  requiredUsername?: string;
}

/** Saved to localStorage — the player's final character config */
export interface CharacterSave {
  preset: string | null;
  layers: Record<string, string>; // slotId → optionId
}

export const CHARACTER_KEY = 'wq_character';
