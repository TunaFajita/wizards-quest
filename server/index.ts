import express from 'express';
import cors from 'cors';
import { router as authRouter } from './routes/auth.js';
import { router as savesRouter } from './routes/saves.js';

const app  = express();
const PORT = 4000;

app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(express.json());

app.use('/api/auth',  authRouter);
app.use('/api/saves', savesRouter);

app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`);
});
