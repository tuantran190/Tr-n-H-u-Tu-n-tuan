import { Router } from 'express';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  res.json({ token: 'mock-jwt-token', user: { id: 1, role: 'admin', name: 'Trader' } });
});

authRouter.get('/me', (req, res) => {
  res.json({ id: 1, role: 'admin', name: 'Trader' });
});
