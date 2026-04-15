const TOKEN_KEY   = 'wq_token';
const SESSION_KEY = 'wq_session'; // cached { userId, username, hasSave }

export interface Session {
  userId:   string;
  username: string;
  hasSave:  boolean;
}

type AuthResult =
  | { ok: true;  session: Session }
  | { ok: false; error: string };

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function cacheSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
}

// ─── AuthManager ─────────────────────────────────────────────────────────────

export class AuthManager {
  static async signUp(username: string, password: string): Promise<AuthResult> {
    try {
      const res  = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error ?? 'Registration failed.' };

      localStorage.setItem(TOKEN_KEY, data.token);
      const session: Session = { userId: data.userId, username: data.username, hasSave: false };
      cacheSession(session);
      return { ok: true, session };
    } catch {
      return { ok: false, error: 'Cannot reach server. Is it running?' };
    }
  }

  static async login(username: string, password: string): Promise<AuthResult> {
    try {
      const res  = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error ?? 'Login failed.' };

      localStorage.setItem(TOKEN_KEY, data.token);
      const session: Session = { userId: data.userId, username: data.username, hasSave: !!data.hasSave };
      cacheSession(session);
      return { ok: true, session };
    } catch {
      return { ok: false, error: 'Cannot reach server. Is it running?' };
    }
  }

  static logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  /** Returns the cached session without hitting the network. */
  static getSession(): Session | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }

  /** No-op kept for call-site compatibility — hasSave is now derived from slots. */
  static async markHasSave(): Promise<void> { /* handled by saveToSlot */ }

  // ─── Save slots ────────────────────────────────────────────────────────────

  /** Fetch all 3 save slots from the server. Returns { A, B, C } each null or SlotData. */
  static async getSlots(): Promise<Record<string, SlotData | null>> {
    try {
      const res = await apiFetch('/saves');
      if (!res.ok) return { A: null, B: null, C: null };
      return res.json();
    } catch {
      return { A: null, B: null, C: null };
    }
  }

  /** Save character data to a slot. */
  static async saveToSlot(
    slot: 'A' | 'B' | 'C',
    characterData: object,
    characterName: string,
  ): Promise<boolean> {
    try {
      const res = await apiFetch(`/saves/${slot}`, {
        method: 'PUT',
        body: JSON.stringify({ characterData, characterName }),
      });
      if (res.ok) {
        // Update hasSave in local cache
        const session = AuthManager.getSession();
        if (session) cacheSession({ ...session, hasSave: true });
      }
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Re-fetch the current user from the server and refresh the local cache.
   * Call this on MenuScene entry to pick up any server-side changes.
   */
  static async refreshSession(): Promise<Session | null> {
    try {
      const res = await apiFetch('/auth/me');
      if (!res.ok) { AuthManager.logout(); return null; }
      const data    = await res.json();
      const session: Session = { userId: data.userId, username: data.username, hasSave: !!data.hasSave };
      cacheSession(session);
      return session;
    } catch {
      return AuthManager.getSession(); // fall back to cache
    }
  }
}

export interface SlotData {
  characterName: string;
  characterData: { preset: string | null; layers: Record<string, string> };
  createdAt: number;
  updatedAt: number;
}
