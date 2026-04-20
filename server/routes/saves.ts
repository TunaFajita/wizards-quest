import { Router, Request, Response } from 'express';
import db from '../database.js';
import { authMiddleware } from './auth.js';

export const router = Router();

type Slot = 'A' | 'B' | 'C';

function validSlot(s: string): s is Slot {
  return ['A', 'B', 'C'].includes(s);
}

// GET /api/saves — return all 3 slots for current user
router.get('/', (req: Request, res: Response) => {
  const user = authMiddleware(req, res);
  if (!user) return void res.status(401).json({ error: 'Unauthorized.' });

  const rows = db.prepare(
    'SELECT slot, character_name, character_data, created_at, updated_at FROM save_slots WHERE user_id = ?'
  ).all(user.userId) as any[];

  const slots: Record<string, any> = { A: null, B: null, C: null };
  for (const row of rows) {
    slots[row.slot] = {
      characterName: row.character_name,
      characterData: JSON.parse(row.character_data),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
  res.json(slots);
});

// PUT /api/saves/:slot — create or overwrite a slot
router.put('/:slot', (req: Request, res: Response) => {
  const user = authMiddleware(req, res);
  if (!user) return void res.status(401).json({ error: 'Unauthorized.' });

  const slot = req.params.slot?.toUpperCase();
  if (!validSlot(slot)) return void res.status(400).json({ error: 'Invalid slot. Must be A, B or C.' });

  const { characterData, characterName = 'Adventurer' } = req.body;
  if (!characterData) return void res.status(400).json({ error: 'Missing characterData.' });

  const now = Date.now();
  db.prepare(`
    INSERT INTO save_slots (user_id, slot, character_name, character_data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, slot) DO UPDATE SET
      character_name = excluded.character_name,
      character_data = excluded.character_data,
      updated_at     = excluded.updated_at
  `).run(user.userId, slot, characterName, JSON.stringify(characterData), now, now);

  res.json({ ok: true });
});

// DELETE /api/saves/:slot — clear a slot
router.delete('/:slot', (req: Request, res: Response) => {
  const user = authMiddleware(req, res);
  if (!user) return void res.status(401).json({ error: 'Unauthorized.' });

  const slot = req.params.slot?.toUpperCase();
  if (!validSlot(slot)) return void res.status(400).json({ error: 'Invalid slot.' });

  db.prepare('DELETE FROM save_slots WHERE user_id = ? AND slot = ?').run(user.userId, slot);
  res.json({ ok: true });
});
