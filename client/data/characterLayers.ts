import type { LayerSlot, CharacterPreset } from '../types/character';

/**
 * Layer slots shown in the character creator.
 *
 * To add a new LPC body option:
 *   1. Load its spritesheet in BootScene.preload() with a unique textureKey.
 *   2. Call AnimationFactory.createLPCAnimations(anims, textureKey, prefix) in BootScene.create().
 *   3. Add an entry to the 'body' slot options below.
 *
 * requiredUsername: if set, this option is only visible to that exact account.
 */
export const LAYER_SLOTS: LayerSlot[] = [
  {
    id: 'body',
    label: 'Body',
    options: [
      { id: 'none',        label: 'None',          textureKey: null },
      { id: 'male-wizard', label: 'Male Wizard',   textureKey: 'wizard',    animPrefix: 'wizard' },
      { id: 'f-wizard',    label: 'Female Wizard', textureKey: 'f-wizard',  animPrefix: 'f-wizard' },
      {
        id: 'darklight',
        label: 'Darklight',
        textureKey: 'darklight',
        animPrefix: 'darklight',
        requiredUsername: 'Darklight2247',
      },
    ],
  },
  {
    id: 'hair',
    label: 'Hair',
    locked: true,
    options: [
      { id: 'none', label: 'None', textureKey: null },
    ],
  },
  {
    id: 'outfit',
    label: 'Outfit',
    locked: true,
    options: [
      { id: 'none', label: 'None', textureKey: null },
    ],
  },
  {
    id: 'weapon',
    label: 'Weapon',
    locked: true,
    options: [
      { id: 'none', label: 'None', textureKey: null },
    ],
  },
];

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'male-wizard',
    label: 'Male Wizard',
    symbol: '♂',
    layers: {
      body:   'male-wizard',
      hair:   'none',
      outfit: 'none',
      weapon: 'none',
    },
  },
  {
    id: 'female-wizard',
    label: 'Female Wizard',
    symbol: '♀',
    layers: {
      body:   'f-wizard',
      hair:   'none',
      outfit: 'none',
      weapon: 'none',
    },
  },
  {
    id: 'darklight',
    label: 'Darklight',
    symbol: '★',
    requiredUsername: 'Darklight2247',
    layers: {
      body:   'darklight',
      hair:   'none',
      outfit: 'none',
      weapon: 'none',
    },
  },
];

/** Returns the default selection for every slot (first option). */
export function defaultLayers(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const slot of LAYER_SLOTS) {
    result[slot.id] = slot.options[0].id;
  }
  return result;
}
