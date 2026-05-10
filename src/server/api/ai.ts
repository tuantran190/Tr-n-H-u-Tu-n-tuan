import { Router } from 'express';
import { generateStrategyCode } from '../ai/strategyAgent';

export const aiRouter = Router();

aiRouter.post('/chat', async (req, res) => {
  const { message } = req.body;
  try {
    const code = await generateStrategyCode(message);
    res.json({ reply: 'Here is the strategy generated based on your requirement:', code });
  } catch (error) {
    res.status(500).json({ error: 'AI generation failed' });
  }
});
