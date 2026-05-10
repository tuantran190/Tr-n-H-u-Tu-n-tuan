import { Router } from 'express';

export const backtestRouter = Router();

backtestRouter.post('/run', (req, res) => {
  const { coin, timeframe, strategyCode } = req.body;
  
  // Mock backtest output
  const equityCurve = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    equity: 10000 + Math.random() * 2000 - 500 + i * 50
  }));

  res.json({
    metrics: {
      pnl: 15.4,
      winrate: 62.5,
      drawdown: 5.2,
      totalTrades: 48
    },
    equityCurve
  });
});
