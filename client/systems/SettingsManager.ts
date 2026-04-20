export interface AudioSettings {
  master: number; // 0–100
  music:  number;
  sfx:    number;
}

export interface GraphicsSettings {
  quality: 'low' | 'medium' | 'high';
}

export interface KeybindSettings {
  jump:   string;
  emote:  string;
  sprint: string;
  stats:  string;
}

export interface GameSettings {
  audio:    AudioSettings;
  graphics: GraphicsSettings;
  keybinds: KeybindSettings;
}

const STORAGE_KEY = 'wq_settings';

const DEFAULTS: GameSettings = {
  audio:    { master: 80, music: 70, sfx: 80 },
  graphics: { quality: 'medium' },
  keybinds: { jump: 'SPACE', emote: 'T', sprint: 'SHIFT', stats: 'TAB' },
};

// Key name → browser KeyboardEvent.key value (used when listening for rebind)
const KEY_EVENT_MAP: Record<string, string> = {
  ' ': 'SPACE', 'Control': 'CTRL', 'Shift': 'SHIFT', 'Alt': 'ALT',
  'Tab': 'TAB', 'Enter': 'ENTER',
};

// Key name → Phaser KeyCode number
const PHASER_CODE_MAP: Record<string, number> = {
  SPACE:32, CTRL:17, SHIFT:16, ALT:18, TAB:9, ENTER:13,
  A:65,B:66,C:67,D:68,E:69,F:70,G:71,H:72,I:73,J:74,K:75,
  L:76,M:77,N:78,O:79,P:80,Q:81,R:82,S:83,T:84,U:85,V:86,
  W:87,X:88,Y:89,Z:90,
  F1:112,F2:113,F3:114,F4:115,F5:116,F6:117,F7:118,F8:119,F9:120,
};

export class SettingsManager {
  private static cache: GameSettings | null = null;

  static load(): GameSettings {
    if (this.cache) return this.cache;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GameSettings>;
        this.cache = {
          audio:    { ...DEFAULTS.audio,    ...parsed.audio },
          graphics: { ...DEFAULTS.graphics, ...parsed.graphics },
          keybinds: { ...DEFAULTS.keybinds, ...parsed.keybinds },
        };
        return this.cache;
      }
    } catch { /* ignore */ }
    this.cache = { ...DEFAULTS, audio: { ...DEFAULTS.audio }, graphics: { ...DEFAULTS.graphics }, keybinds: { ...DEFAULTS.keybinds } };
    return this.cache;
  }

  static save(settings: GameSettings): void {
    this.cache = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  /** Invalidate cache so next load() re-reads from storage. */
  static invalidate(): void { this.cache = null; }

  static get audio():    AudioSettings    { return this.load().audio; }
  static get graphics(): GraphicsSettings { return this.load().graphics; }
  static get keybinds(): KeybindSettings  { return this.load().keybinds; }

  /** Convert a browser KeyboardEvent.key to our internal key name. */
  static keyEventToName(key: string): string | null {
    if (key === 'Escape') return null;
    if (KEY_EVENT_MAP[key]) return KEY_EVENT_MAP[key];
    if (key.length === 1) return key.toUpperCase();
    return null;
  }

  /** Convert our key name to a Phaser KeyCode number. */
  static toKeyCode(name: string): number {
    return PHASER_CODE_MAP[name.toUpperCase()] ?? 0;
  }
}
