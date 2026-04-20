import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import db, { hashPassword, verifyPassword } from '../database.js';

export const JWT_SECRET = 'wq-dev-secret-change-in-prod';

export const router = Router();

interface JWTPayload { userId: string; username: string; }

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export function authMiddleware(req: Request, res: Response): JWTPayload | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try { return verifyToken(header.slice(7)); } catch { return null; }
}

// POST /api/auth/register
router.post('/register', (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };

  const u = username?.trim();
  if (!u || u.length < 3)          return void res.status(400).json({ error: 'Username must be at least 3 characters.' });
  if (u.length > 20)               return void res.status(400).json({ error: 'Username must be 20 characters or fewer.' });
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return void res.status(400).json({ error: 'Username: letters, numbers and _ only.' });
  if (!password || password.length < 6) return void res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const id = randomUUID();
  try {
    db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?,?,?,?)')
      .run(id, u, hashPassword(password), Date.now());
  } catch (e: any) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return void res.status(409).json({ error: 'Username is already taken.' });
    return void res.status(500).json({ error: 'Server error.' });
  }

  const token = signToken({ userId: id, username: u });
  res.json({ token, userId: id, username: u, hasSave: false });
});

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };

  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username?.trim()) as any;
  if (!user) return void res.status(401).json({ error: 'Account not found.' });
  if (!verifyPassword(password, user.password_hash)) return void res.status(401).json({ error: 'Incorrect password.' });

  const hasSave = !!(db.prepare('SELECT 1 FROM save_slots WHERE user_id = ? LIMIT 1').get(user.id));
  const token   = signToken({ userId: user.id, username: user.username });
  res.json({ token, userId: user.id, username: user.username, hasSave });
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  const user = authMiddleware(req, res);
  if (!user) return void res.status(401).json({ error: 'Unauthorized.' });

  const row     = db.prepare('SELECT username FROM users WHERE id = ?').get(user.userId) as any;
  if (!row) return void res.status(404).json({ error: 'User not found.' });
  const hasSave = !!(db.prepare('SELECT 1 FROM save_slots WHERE user_id = ? LIMIT 1').get(user.userId));

  res.json({ userId: user.userId, username: row.username, hasSave });
});
