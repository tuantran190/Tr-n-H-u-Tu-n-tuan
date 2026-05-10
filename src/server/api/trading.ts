import { Router } from 'express';
import { broadcast } from '../ws';
import { executeOrder, calculateSafeAmount, setLeverage, checkAndMoveStopLosses } from '../engine/ccxt-executor';
import { sendTelegramMessage } from '../engine/telegram';
import { TradeModel } from '../db/models/Trade';

export const tradingRouter = Router();

interface Order {
  id: string;
  pair: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP';
  volume: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'OPEN' | 'FILLED' | 'CANCELED';
  createdAt: string;
}

interface Position {
  id: string;
  pair: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entry: number;
  mark: number;
  pnl: number;
}

let orders: Order[] = [];
let positions: Position[] = [
  { id: '1', pair: 'BTCUSDT', side: 'LONG', size: 0.5, entry: 65000, mark: 66500, pnl: 750 },
];

tradingRouter.get('/positions', (req, res) => {
  res.json(positions);
});

tradingRouter.get('/orders', (req, res) => {
  res.json(orders);
});

// Simple EMA calculation for backend
function calculateServerEMA(data: any[], period: number) {
  if (!data || data.length === 0) return [];
  const k = 2 / (period + 1);
  let emaData = [];
  let currentEma = data[0].close || 0;
  
  for (let i = 0; i < data.length; i++) {
    const close = data[i].close || 0;
    currentEma = (close - currentEma) * k + currentEma;
    if (!isNaN(currentEma)) {
      emaData.push({ time: data[i].time, value: currentEma });
    }
  }
  return emaData;
}

tradingRouter.get('/history', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT', timeframe = '15m' } = req.query;
    
    // Fetch last 100 candles from Binance API
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${String(symbol).toUpperCase()}&interval=${timeframe}&limit=100`);
    
    if (!response.ok) {
        return res.status(response.status).json({ error: `Binance API error: ${response.statusText}` });
    }
    
    const json = await response.json();
    
    // Parse OHLCV data
    const candles = json.map((d: any) => ({
      time: Math.floor(d[0] / 1000), // convert to seconds for Lightweight Charts
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));

    // Calculate EMAs
    const ema34 = calculateServerEMA(candles, 34);
    const ema89 = calculateServerEMA(candles, 89);
    const ema200 = calculateServerEMA(candles, 200);

    res.json({
      candles,
      ema34,
      ema89,
      ema200
    });
  } catch (error: any) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/scan', async (req, res) => {
  try {
    const { symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], timeframe = '15m' } = req.body;
    
    const results = [];
    
    for (const symbol of symbols) {
      // Fetch last 100 candles from Binance API
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${String(symbol).toUpperCase()}&interval=${timeframe}&limit=100`);
      
      if (!response.ok) continue;
      
      const json = await response.json();
      
      // Parse OHLCV data
      const candles = json.map((d: any) => ({
        time: Math.floor(d[0] / 1000), // convert to seconds for Lightweight Charts
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
      }));

      // Calculate EMAs
      const ema34 = calculateServerEMA(candles, 34);
      const ema89 = calculateServerEMA(candles, 89);
      const ema200 = calculateServerEMA(candles, 200);
      
      const lastClose = candles[candles.length - 1]?.close;
      const lastEma34 = ema34[ema34.length - 1]?.value;
      const lastEma89 = ema89[ema89.length - 1]?.value;
      const lastEma200 = ema200[ema200.length - 1]?.value;

      let signal = 'NONE';
      // simple signal logic: bullish if ema34 > ema89 > ema200
      if (lastEma34 && lastEma89 && lastEma200) {
        if (lastEma34 > lastEma89 && lastEma89 > lastEma200 && lastClose > lastEma34) {
          signal = 'BUY';
        } else if (lastEma34 < lastEma89 && lastEma89 < lastEma200 && lastClose < lastEma34) {
          signal = 'SELL';
        }
      }
      
      if (signal !== 'NONE') {
        results.push({
          symbol,
          signal,
          lastPrice: lastClose,
          ema34: lastEma34,
          ema89: lastEma89,
          ema200: lastEma200
        });
      }
    }
    
    res.json({ results });
  } catch (error: any) {
    console.error('Error scanning:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/analyze', (req, res) => {
  try {
    const { candles, ema34: providedEma34, ema89: providedEma89, ema200: providedEma200 } = req.body;
    
    if (!candles || !Array.isArray(candles) || candles.length === 0) {
      return res.status(400).json({ error: 'candles array is required' });
    }

    const ema34 = providedEma34 || calculateServerEMA(candles, 34);
    const ema89 = providedEma89 || calculateServerEMA(candles, 89);
    const ema200 = providedEma200 || calculateServerEMA(candles, 200);

    const lastClose = candles[candles.length - 1]?.close || 0;
    const lastEma34 = ema34[ema34.length - 1]?.value || 0;
    const lastEma89 = ema89[ema89.length - 1]?.value || 0;
    const lastEma200 = ema200[ema200.length - 1]?.value || 0;

    let trend = 'NONE';
    if (lastEma34 && lastEma89 && lastEma200) {
      if (lastClose > lastEma200 && lastEma34 > lastEma89 && lastEma89 > lastEma200) {
        trend = 'BUY';
      } else if (lastClose < lastEma200 && lastEma34 < lastEma89 && lastEma89 < lastEma200) {
        trend = 'SELL';
      }
    }

    // Detect sideway
    let sideway = false;
    
    if (lastEma34 && lastEma89) {
      // If difference between EMA 34 and EMA 89 is < 0.2%
      const diffPct = Math.abs(lastEma34 - lastEma89) / ((lastEma34 + lastEma89) / 2);
      if (diffPct < 0.002) {
        sideway = true;
      }
    }

    // OR EMA 34 is flat (current EMA34 ≈ EMA34 5 candles ago)
    if (!sideway && ema34.length >= 6) {
      const ema34_5ago = ema34[ema34.length - 6]?.value; // 5 candles ago since length - 1 is current, -6 is 5 steps back
      if (ema34_5ago) {
        const flatPct = Math.abs(lastEma34 - ema34_5ago) / ema34_5ago;
        if (flatPct < 0.0005) { // 0.05%
          sideway = true;
        }
      }
    }

    res.json({
      trend,
      sideway
    });
  } catch (error: any) {
    console.error('Analyze error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/pullback', (req, res) => {
  try {
    const { candles, trend, ema34: providedEma34, ema89: providedEma89, ema200: providedEma200 } = req.body;
    
    if (!candles || !Array.isArray(candles) || candles.length < 10) {
      return res.status(400).json({ error: 'candles array of length >= 10 is required' });
    }

    const ema34 = providedEma34 || calculateServerEMA(candles, 34);
    const ema89 = providedEma89 || calculateServerEMA(candles, 89);
    const ema200 = providedEma200 || calculateServerEMA(candles, 200);

    let pullback_valid = false;
    let pullback_zone = null;

    if (trend !== 'BUY' && trend !== 'SELL') {
      return res.json({ pullback_valid, pullback_zone });
    }

    const recentCandles = candles.slice(-10); // Look at last 10 candles
    
    // Calculate average body size for "large candle" detection
    let totalBody = 0;
    for (const c of candles) {
        totalBody += Math.abs(c.close - c.open);
    }
    const avgBody = totalBody / candles.length;
    const largeCandleThreshold = avgBody * 2; // 2x average body is "large"
    
    let priceOvershotEma200 = false;
    let tooStrongPullback = false;
    let touchedEma34 = false;
    let touchedEma89 = false;

    for (let i = 0; i < recentCandles.length; i++) {
        const c = recentCandles[i];
        
        // Match candle time to EMA time
        const e34 = ema34.find((e: any) => e.time === c.time)?.value;
        const e89 = ema89.find((e: any) => e.time === c.time)?.value;
        const e200 = ema200.find((e: any) => e.time === c.time)?.value;

        if (!e34 || !e89 || !e200) continue;

        const bodySize = Math.abs(c.close - c.open);
        
        if (trend === 'BUY') {
            // "no large bearish candles"
            if (c.close < c.open && bodySize > largeCandleThreshold) {
                tooStrongPullback = true;
            }
            
            if (c.low <= e200) {
                priceOvershotEma200 = true;
            }
            
            // Check touch EMA34
            if (c.low <= e34) touchedEma34 = true;
            // Check touch EMA89
            if (c.low <= e89) touchedEma89 = true;
            
        } else if (trend === 'SELL') {
            // "no large bullish candles"
            if (c.close > c.open && bodySize > largeCandleThreshold) {
                tooStrongPullback = true;
            }
            
            if (c.high >= e200) {
                priceOvershotEma200 = true;
            }
            
            if (c.high >= e34) touchedEma34 = true;
            if (c.high >= e89) touchedEma89 = true;
        }
    }

    if (!priceOvershotEma200 && !tooStrongPullback) {
        if (touchedEma89) {
            pullback_valid = true;
            pullback_zone = 'EMA89';
        } else if (touchedEma34) {
            pullback_valid = true;
            pullback_zone = 'EMA34';
        }
    }

    res.json({
      pullback_valid,
      pullback_zone
    });
  } catch (error: any) {
    console.error('Pullback error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/price-action', (req, res) => {
  try {
    const { candles, emaZoneValue } = req.body;
    
    if (!candles || !Array.isArray(candles) || candles.length < 3) {
      return res.status(400).json({ error: 'candles array of length >= 3 is required' });
    }

    const recentCandles = candles.slice(-5);
    const current = recentCandles[recentCandles.length - 1];
    const prev = recentCandles[recentCandles.length - 2];

    let pa_signal = null;
    let pattern = null;

    // Calculate average body size for "abnormal spike" detection
    let totalBody = 0;
    for (const c of recentCandles) {
        totalBody += Math.abs(c.close - c.open);
    }
    const avgBody = totalBody / recentCandles.length;
    const currentBody = Math.abs(current.close - current.open);
    const currentRange = current.high - current.low;

    // Reject if Abnormal spike (e.g. body > 4x avg body)
    if (currentBody > avgBody * 4 || currentRange > avgBody * 6) {
        return res.json({ pa_signal: null, pattern: null });
    }

    // Bullish Engulfing
    const prevIsBearish = prev.close < prev.open;
    const currentIsBullish = current.close > current.open;
    const engulfsBullish = current.close >= prev.open && current.open <= prev.close && currentBody > Math.abs(prev.open - prev.close);
    // Strong close near high (close in top 20% of the candle range)
    const closeNearHigh = current.close >= current.high - (currentRange * 0.2);

    if (prevIsBearish && currentIsBullish && engulfsBullish && closeNearHigh) {
        pa_signal = 'BUY';
        pattern = 'engulfing';
    }

    // Bearish Engulfing
    const prevIsBullish = prev.close > prev.open;
    const currentIsBearish = current.close < current.open;
    const engulfsBearish = current.close <= prev.open && current.open >= prev.close && currentBody > Math.abs(prev.open - prev.close);
    // Strong close near low (close in bottom 20% of the candle range)
    const closeNearLow = current.close <= current.low + (currentRange * 0.2);

    if (prevIsBullish && currentIsBearish && engulfsBearish && closeNearLow) {
        pa_signal = 'SELL';
        pattern = 'engulfing';
    }

    // Pin Bar
    // Long wick (at least 2x body)
    // Wick rejection from EMA zone
    // For Bullish Pinbar: long lower wick
    const lowerWick = Math.min(current.open, current.close) - current.low;
    const upperWick = current.high - Math.max(current.open, current.close);

    if (lowerWick >= currentBody * 2 && lowerWick > upperWick * 1.5) {
        // Potentially Bullish Pin Bar
        // Rejection from EMA zone (if emaZoneValue provided, low should be below or near it, close above it)
        if (!emaZoneValue || (current.low <= emaZoneValue * 1.001)) {
            pa_signal = 'BUY';
            pattern = 'pinbar';
        }
    } else if (upperWick >= currentBody * 2 && upperWick > lowerWick * 1.5) {
        // Potentially Bearish Pin Bar
        if (!emaZoneValue || (current.high >= emaZoneValue * 0.999)) {
            pa_signal = 'SELL';
            pattern = 'pinbar';
        }
    }

    res.json({
      pa_signal,
      pattern
    });
  } catch (error: any) {
    console.error('Price Action error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/filter', (req, res) => {
  try {
    const { candles, ema34: providedEma34, ema89: providedEma89 } = req.body;
    
    if (!candles || !Array.isArray(candles) || candles.length < 10) {
      return res.status(400).json({ error: 'candles array of length >= 10 is required' });
    }

    const ema34 = providedEma34 || calculateServerEMA(candles, 34);
    const ema89 = providedEma89 || calculateServerEMA(candles, 89);
    
    const lastClose = candles[candles.length - 1]?.close || 0;
    const lastEma34 = ema34[ema34.length - 1]?.value || 0;
    const lastEma89 = ema89[ema89.length - 1]?.value || 0;

    let is_valid_market = true;
    let reason = 'ok';

    // 1. Sideway: EMA 34 ~ EMA 89 (too close)
    if (lastEma34 && lastEma89) {
      const diffPct = Math.abs(lastEma34 - lastEma89) / ((lastEma34 + lastEma89) / 2);
      if (diffPct < 0.002) { // 0.2%
        is_valid_market = false;
        reason = 'sideway';
      }
    }

    if (is_valid_market) {
      const recentCandles = candles.slice(-10);
      const current = recentCandles[recentCandles.length - 1];

      // Calculate average body size
      let totalBody = 0;
      for (const c of recentCandles) {
          totalBody += Math.abs(c.close - c.open);
      }
      const avgBody = totalBody / recentCandles.length;
      const currentBody = Math.abs(current.close - current.open);

      // 2. Abnormal candle: current size > 2x average
      if (currentBody > avgBody * 2) {
        is_valid_market = false;
        reason = 'spike';
      }
    }

    if (is_valid_market) {
      // 3. Choppy market: Alternating bullish/bearish candles rapidly
      // E.g., check last 4 or 5 candles
      let alternatingCount = 0;
      const recentCandles = candles.slice(-5);
      if (recentCandles.length >= 2) {
        for (let i = 1; i < recentCandles.length; i++) {
            const prev = recentCandles[i-1];
            const curr = recentCandles[i];
            const prevIsBullish = prev.close > prev.open;
            const currIsBullish = curr.close > curr.open;
            if (prevIsBullish !== currIsBullish) {
                alternatingCount++;
            }
        }
        if (alternatingCount >= 3) {
            is_valid_market = false;
            reason = 'choppy';
        }
      }
    }

    res.json({
      is_valid_market,
      reason
    });
  } catch (error: any) {
    console.error('Market Filter error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/score', (req, res) => {
  try {
    const { trend, pullback_valid, pa_signal, market_valid, ema34, ema89, ema200 } = req.body;

    let score = 0;

    // +3 if strong trend (EMA clearly separated)
    if (trend === 'BUY' || trend === 'SELL') {
      let isStrong = true;
      if (ema34 && ema89 && ema200 && ema34.length > 0 && ema89.length > 0 && ema200.length > 0) {
        const lastEma34 = ema34[ema34.length - 1].value;
        const lastEma89 = ema89[ema89.length - 1].value;
        const lastEma200 = ema200[ema200.length - 1].value;

        const diff34_89 = Math.abs(lastEma34 - lastEma89) / ((lastEma34 + lastEma89) / 2);
        const diff89_200 = Math.abs(lastEma89 - lastEma200) / ((lastEma89 + lastEma200) / 2);

        // EMA clearly separated (> 0.2%)
        if (diff34_89 < 0.002 || diff89_200 < 0.002) {
            isStrong = false;
        }
      }
      if (isStrong) {
        score += 3;
      }
    }

    // +3 if pullback valid
    if (pullback_valid === true) {
      score += 3;
    }

    // +2 if clear PA signal
    if (pa_signal === 'BUY' || pa_signal === 'SELL') {
      score += 2;
    }

    // +2 if market clean (not choppy)
    if (market_valid === true) {
      score += 2;
    }

    res.json({ score });
  } catch (error: any) {
    console.error('Score error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/decision', (req, res) => {
  try {
    const { trend, pullback_valid, pa_signal, is_valid_market, score, current_price, ema89_val } = req.body;

    let signal = null;
    let entry = null;
    let sl = null;
    let tp = null;

    if (
        trend !== 'NONE' &&
        pullback_valid === true &&
        pa_signal === trend &&
        is_valid_market === true &&
        score >= 7
    ) {
        signal = trend;
        entry = current_price;
        
        if (signal === 'BUY') {
            // SL below EMA 89
            sl = ema89_val * 0.999; // slightly below EMA 89
            // RR 1:2 -> TP = Entry + 2 * (Entry - SL)
            const risk = entry - sl;
            tp = entry + (2 * risk);
        } else if (signal === 'SELL') {
            // SL above EMA 89
            sl = ema89_val * 1.001; // slightly above EMA 89
            // RR 1:2 -> TP = Entry - 2 * (SL - Entry)
            const risk = sl - entry;
            tp = entry - (2 * risk);
        }
    }

    res.json({
        signal,
        entry,
        sl,
        tp,
        score
    });
  } catch (error: any) {
    console.error('Decision error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

function getTrendDetails(data: any) {
    if (!data || !data.candles || !Array.isArray(data.candles) || data.candles.length === 0) {
        return { trend: 'NONE', sideway: true };
    }
    const ema34 = data.ema34 || calculateServerEMA(data.candles, 34);
    const ema89 = data.ema89 || calculateServerEMA(data.candles, 89);
    const ema200 = data.ema200 || calculateServerEMA(data.candles, 200);

    const lastClose = data.candles[data.candles.length - 1]?.close || 0;
    const lastEma34 = ema34[ema34.length - 1]?.value || 0;
    const lastEma89 = ema89[ema89.length - 1]?.value || 0;
    const lastEma200 = ema200[ema200.length - 1]?.value || 0;

    let trend = 'NONE';
    if (lastEma34 && lastEma89 && lastEma200) {
      if (lastClose > lastEma200 && lastEma34 > lastEma89) {
        trend = 'BUY';
      } else if (lastClose < lastEma200 && lastEma34 < lastEma89) {
        trend = 'SELL';
      }
    }

    let sideway = false;
    if (lastEma34 && lastEma89) {
      const diffPct = Math.abs(lastEma34 - lastEma89) / ((lastEma34 + lastEma89) / 2);
      if (diffPct < 0.002) {
        sideway = true;
      }
    }
    if (!sideway && ema34.length >= 6) {
      const ema34_5ago = ema34[ema34.length - 6]?.value;
      if (ema34_5ago) {
        const flatPct = Math.abs(lastEma34 - ema34_5ago) / ema34_5ago;
        if (flatPct < 0.0005) {
          sideway = true;
        }
      }
    }

    if (sideway) {
        trend = 'NONE';
    }
    
    return { trend, sideway };
}

tradingRouter.post('/mtf-analyze', (req, res) => {
  try {
    const { h1, m15, m5 } = req.body;
    
    const h1Result = getTrendDetails(h1 || {});
    const m15Result = getTrendDetails(m15 || {});
    const m5Result = getTrendDetails(m5 || {});

    let htf_trend = h1Result.trend;
    let alignment = false;
    let quality = 'LOW';

    if (htf_trend !== 'NONE') {
        if (m15Result.trend === htf_trend) {
            alignment = true;
            quality = (m5Result.trend === htf_trend) ? 'HIGH' : 'MEDIUM';
        } else if (m15Result.trend === 'NONE') {
            alignment = true;
            quality = 'LOW';
        } else {
            alignment = false;
            quality = 'LOW';
        }
    }

    res.json({
        htf_trend,
        alignment,
        quality
    });

  } catch (error: any) {
    console.error('MTF Analyze error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/liquidity-trap', (req, res) => {
  try {
    const { candles, swingHigh: providedHigh, swingLow: providedLow } = req.body;

    if (!candles || !Array.isArray(candles) || candles.length < 5) {
      return res.status(400).json({ error: 'candles array of length >= 5 is required' });
    }

    let fake_breakout = false;
    let reason = 'none';

    // Figure out recent swing high/low if not provided
    let swingHigh = providedHigh;
    let swingLow = providedLow;

    if (!swingHigh || !swingLow) {
        // Find high/low of candles excluding the last 2
        const contextCandles = candles.slice(0, candles.length - 2);
        if (!swingHigh) swingHigh = Math.max(...contextCandles.map((c: any) => c.high));
        if (!swingLow) swingLow = Math.min(...contextCandles.map((c: any) => c.low));
    }

    const current = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const contextVolumeSum = candles.slice(0, candles.length - 2).reduce((sum: number, c: any) => sum + (Number(c.volume) || 0), 0);
    const avgVolume = (contextVolumeSum / (candles.length - 2)) || 1;

    // Check bullish fake breakout (breaking above resistance)
    const brokeResistance = (current.high > swingHigh) || (prev.high > swingHigh);
    const closedInsideResistance = (current.close < swingHigh);

    if (brokeResistance && closedInsideResistance) {
        fake_breakout = true;
        
        // 3. Breakout happens with low volume -> suspicious (weak_breakout)
        if (prev.close > swingHigh && Number(prev.volume) < avgVolume) {
            reason = 'weak_breakout';
        } else {
            // 2. Long wick above resistance with low follow-through -> stop hunt
            const upperWick = current.high - Math.max(current.open, current.close);
            const currentBody = Math.abs(current.close - current.open);
            if (upperWick > currentBody * 1.5 && current.high > swingHigh) {
                reason = 'stop_hunt';
            } else {
                reason = 'stop_hunt'; // 1. Defaults to stop hunt if it breaks and closes back inside
            }
        }
    }

    // Check bearish fake breakout (breaking below support)
    if (!fake_breakout) {
        const brokeSupport = (current.low < swingLow) || (prev.low < swingLow);
        const closedInsideSupport = (current.close > swingLow);
        
        if (brokeSupport && closedInsideSupport) {
            fake_breakout = true;
            
            if (prev.close < swingLow && Number(prev.volume) < avgVolume) {
                reason = 'weak_breakout';
            } else {
                const lowerWick = Math.min(current.open, current.close) - current.low;
                const currentBody = Math.abs(current.close - current.open);
                if (lowerWick > currentBody * 1.5 && current.low < swingLow) {
                    reason = 'stop_hunt';
                } else {
                    reason = 'stop_hunt';
                }
            }
        }
    }

    res.json({
        fake_breakout,
        reason
    });

  } catch (error: any) {
    console.error('Liquidity Trap error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/structure', (req, res) => {
  try {
    const { swings, proposed_trade } = req.body;
    // Expected swings: array of { type: 'high' | 'low', value: number } sorted chronologically
    
    if (!swings || !Array.isArray(swings) || swings.length < 4) {
      return res.status(400).json({ error: 'swings array of length >= 4 is required' });
    }

    const highs = swings.filter((s: any) => s.type === 'high').map((s: any) => s.value);
    const lows = swings.filter((s: any) => s.type === 'low').map((s: any) => s.value);

    let structure = 'transition';

    if (highs.length >= 2 && lows.length >= 2) {
        const lastHigh = highs[highs.length - 1];
        const prevHigh = highs[highs.length - 2];
        const lastLow = lows[lows.length - 1];
        const prevLow = lows[lows.length - 2];

        if (lastHigh > prevHigh && lastLow > prevLow) {
            structure = 'bullish';
        } else if (lastHigh < prevHigh && lastLow < prevLow) {
            structure = 'bearish';
        }
    }

    let valid_trade = false;
    if (proposed_trade === 'BUY' && structure === 'bullish') {
        valid_trade = true;
    } else if (proposed_trade === 'SELL' && structure === 'bearish') {
        valid_trade = true;
    }

    res.json({
        structure,
        valid_trade
    });
  } catch (error: any) {
    console.error('Structure error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/volume', (req, res) => {
  try {
    const { candles } = req.body;
    
    if (!candles || !Array.isArray(candles) || candles.length < 21) {
      return res.status(400).json({ error: 'candles array of length >= 21 is required' });
    }

    const contextCandles = candles.slice(-21, -1);
    const current = candles[candles.length - 1];

    let totalVolume = 0;
    for (const c of contextCandles) {
        totalVolume += (Number(c.volume) || 0);
    }
    const avgVolume = totalVolume / contextCandles.length;
    const currentVolume = Number(current.volume) || 0;

    let volume_confirmed = false;
    let strength = 'weak';

    if (currentVolume > avgVolume) {
        volume_confirmed = true;
        strength = 'strong';
    }

    res.json({
        volume_confirmed,
        strength
    });
  } catch (error: any) {
    console.error('Volume error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/quality-score', (req, res) => {
  try {
    const { 
        has_trend_alignment, 
        has_ema_separation, 
        has_strong_pa, 
        has_volume_confirmation, 
        no_liquidity_trap 
    } = req.body;

    let score = 0;

    if (has_trend_alignment) score += 2;
    if (has_ema_separation) score += 2;
    if (has_strong_pa) score += 2;
    if (has_volume_confirmation) score += 2;
    if (no_liquidity_trap) score += 2;

    const allow_trade = score >= 7;
    const trade_quality = allow_trade ? 'HIGH' : 'LOW';

    res.json({
        score,
        trade_quality,
        allow_trade
    });
  } catch (error: any) {
    console.error('Quality Score error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/final-decision', (req, res) => {
  try {
    const { 
        htf_alignment, 
        trend, 
        fake_breakout, 
        structure_valid, 
        score, 
        current_price, 
        recent_low, 
        recent_high 
    } = req.body;

    if (
        htf_alignment === true &&
        fake_breakout === false &&
        structure_valid === true &&
        score >= 7 &&
        (trend === 'BUY' || trend === 'SELL')
    ) {
        let sl = 0;
        let tp = 0;
        
        if (trend === 'BUY') {
            // Dynamic SL below recent low
            sl = recent_low * 0.999;
            const risk = current_price - sl;
            tp = current_price + (risk * 2); // 1:2 RR
        } else {
            // Dynamic SL above recent high
            sl = recent_high * 1.001;
            const risk = sl - current_price;
            tp = current_price - (risk * 2); // 1:2 RR
        }

        return res.json({
            signal: trend,
            entry: current_price,
            sl,
            tp,
            confidence: "high"
        });
    }

    res.json({
        signal: "NO TRADE"
    });
  } catch (error: any) {
    console.error('Final Decision error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/risk-manager', (req, res) => {
  try {
    const { 
        account_balance, 
        daily_loss_pct = 0, 
        consecutive_losses = 0, 
        drawdown_pct = 0,
        signal,
        risk_per_trade_pct = 1 
    } = req.body;

    let allowed_trade = true;
    let risk_state = 'normal';
    
    if (signal === 'NO TRADE' || !signal) {
        allowed_trade = false;
    }

    if (drawdown_pct > 10) {
        allowed_trade = false;
        risk_state = 'paused';
    } else if (daily_loss_pct >= 3) {
        allowed_trade = false;
        risk_state = 'paused';
    }

    if (allowed_trade && consecutive_losses >= 3) {
        risk_state = 'reduced';
    }

    let position_size = 0;
    if (allowed_trade) {
        let risk_pct = risk_per_trade_pct;
        if (risk_pct > 2) risk_pct = 2; // cap at 2%

        if (risk_state === 'reduced') {
            risk_pct = risk_pct * 0.5;
        }

        position_size = account_balance * (risk_pct / 100);
    }

    res.json({
        allowed_trade,
        position_size,
        risk_state
    });
  } catch (error: any) {
    console.error('Risk Manager error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/position-size', (req, res) => {
  try {
    const { 
        account_balance, 
        stop_loss_distance, 
        risk_per_trade_pct = 1,
        is_high_volatility = false
    } = req.body;

    if (!account_balance || !stop_loss_distance) {
        return res.status(400).json({ error: 'account_balance and stop_loss_distance are required' });
    }

    let risk_pct = risk_per_trade_pct;
    
    // Reduce size if volatility is high
    if (is_high_volatility) {
        risk_pct *= 0.5;
    }

    const risk_amount = account_balance * (risk_pct / 100);
    const position_size = risk_amount / stop_loss_distance;

    // Never exceed leverage safety threshold
    // Let's assume max leverage is 10 for normal, 5 for high volatility
    const max_leverage = is_high_volatility ? 5 : 10;
    let suggested_leverage = position_size / account_balance;
    
    let final_position_size = position_size;

    if (suggested_leverage > max_leverage) {
        suggested_leverage = max_leverage;
        final_position_size = account_balance * suggested_leverage;
    }

    // if suggested leverage is less than 1, we can just say 1
    if (suggested_leverage < 1) {
        suggested_leverage = 1;
    }

    res.json({
        position_size: final_position_size,
        leverage: Number(suggested_leverage.toFixed(2))
    });
  } catch (error: any) {
    console.error('Position Size error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/alpha-detection', (req, res) => {
  try {
    const { 
        historical_expectancy, 
        recent_similar_trades_win_rate, 
        market_conditions_match, 
        signal_score 
    } = req.body;

    let edge_exists = false;
    let confidence = 'low';

    if (
        historical_expectancy > 0 && 
        recent_similar_trades_win_rate >= 0.5 && 
        market_conditions_match === true
    ) {
        edge_exists = true;
        if (signal_score >= 8 && recent_similar_trades_win_rate >= 0.7) {
            confidence = 'high';
        } else if (signal_score >= 7) {
            confidence = 'medium';
        }
    }

    res.json({
        edge_exists,
        confidence
    });
  } catch (error: any) {
    console.error('Alpha Detection error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/capital-protection', (req, res) => {
  try {
    const { 
        current_drawdown = 0, 
        is_high_volatility = false
    } = req.body;

    let trade_allowed = true;
    let risk_multiplier = 1;

    if (current_drawdown > 10) {
        trade_allowed = false;
        risk_multiplier = 0;
    } else if (current_drawdown > 5) {
        risk_multiplier = 0.5;
    }

    if (is_high_volatility) {
        trade_allowed = false;
        risk_multiplier = 0;
    }

    res.json({
        trade_allowed,
        risk_multiplier
    });
  } catch (error: any) {
    console.error('Capital Protection error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/portfolio-allocation', (req, res) => {
  try {
    const { 
        capital, 
        open_positions = [], 
        requested_symbols = [] 
    } = req.body;

    let current_exposure = 0;
    const open_symbols = open_positions.map((p: any) => p.symbol as string);
    open_positions.forEach((p: any) => {
        current_exposure += p.exposure || 0;
    });

    const isBtcOpen = open_symbols.some(s => s.includes('BTC'));
    const isEthOpen = open_symbols.some(s => s.includes('ETH'));

    const max_exposure = capital * 0.3;
    const available_exposure = Math.max(0, max_exposure - current_exposure);

    let approved_symbols: string[] = [];

    if (available_exposure > 0) {
        approved_symbols = requested_symbols.filter((sym: string) => {
            const isBtc = sym.includes('BTC');
            const isEth = sym.includes('ETH');

            if (isBtc && isEthOpen) return false;
            if (isEth && isBtcOpen) return false;
            
            return true;
        });

        const btcIndex = approved_symbols.findIndex(s => s.includes('BTC'));
        const ethIndex = approved_symbols.findIndex(s => s.includes('ETH'));

        if (btcIndex !== -1 && ethIndex !== -1) {
            if (btcIndex < ethIndex) {
               approved_symbols.splice(ethIndex, 1);
            } else {
               approved_symbols.splice(btcIndex, 1);
            }
        }
    }

    res.json({
        approved_symbols,
        exposure_limit: available_exposure
    });
  } catch (error: any) {
    console.error('Portfolio Allocation error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/execution-engine', (req, res) => {
  try {
    const { 
        is_volatile = false, 
        is_news_spike = false, 
        order_size = 0,
        average_daily_volume = 1 // avoid div by 0
    } = req.body;

    let order_type = 'limit'; // prefer limit orders
    let execution_plan = 'single';

    if (is_volatile || is_news_spike) {
        order_type = 'limit'; // avoid market orders in volatile conditions or news spikes
    } else {
        // Can be market if conditions are quiet, but rules say "Prefer limit orders when possible"
        // so leaving it as limit primarily, or maybe "market" if small order and not volatile?
        // Let's just default to limit
    }

    // Split large orders into smaller chunks
    // Let's define "large order" as order_size > average_daily_volume * 0.01 (1% of ADV) or similar logic
    // Just a basic heuristic
    if (order_size > average_daily_volume * 0.01) {
        execution_plan = 'split';
    }

    res.json({
        order_type,
        execution_plan
    });
  } catch (error: any) {
    console.error('Execution Engine error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/market-regime', (req, res) => {
  try {
    const { 
        ema_34, ema_89, ema_200,
        ema_34_slope = 0, ema_89_slope = 0, ema_200_slope = 0,
        price_movement = 0,
        volatility = 0,
        volume_spike = false,
        fake_breakout = false
    } = req.body;

    let regime = 'SIDEWAYS';
    let confidence = 0.5;

    if (volatility > 0.8 || volume_spike || fake_breakout) {
        regime = 'HIGH_RISK';
        confidence = 0.9;
    } else if (
        ema_34 > ema_89 && ema_89 > ema_200 && 
        ema_34_slope > 0 && ema_89_slope > 0 && price_movement >= 0
    ) {
        regime = 'TREND_UP';
        confidence = 0.8;
    } else if (
        ema_34 < ema_89 && ema_89 < ema_200 && 
        ema_34_slope < 0 && ema_89_slope < 0 && price_movement <= 0
    ) {
        regime = 'TREND_DOWN';
        confidence = 0.8;
    } else {
        regime = 'SIDEWAYS';
        confidence = 0.6;
    }

    res.json({
        regime,
        confidence
    });
  } catch (error: any) {
    console.error('Market Regime error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/probabilistic-model', (req, res) => {
  try {
    const { 
        market_features = {},
        market_regime = 'SIDEWAYS'
    } = req.body;

    let prob_up = 50;
    let prob_down = 50;
    let edge_strength = 'weak';

    if (market_regime === 'TREND_UP') {
        prob_up = 75;
        prob_down = 25;
        edge_strength = 'strong';
    } else if (market_regime === 'TREND_DOWN') {
        prob_up = 25;
        prob_down = 75;
        edge_strength = 'strong';
    } else if (market_regime === 'HIGH_RISK') {
        prob_up = 50;
        prob_down = 50;
        edge_strength = 'weak';
    } else {
        prob_up = 52;
        prob_down = 48;
        edge_strength = 'weak';
    }

    res.json({
        prob_up,
        prob_down,
        edge_strength
    });
  } catch (error: any) {
    console.error('Probabilistic Model error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/hedge-fund-decision', (req, res) => {
  try {
    const { 
        regime = 'SIDEWAYS', 
        edge_strength = 'weak', 
        prob_up = 50, 
        prob_down = 50 
    } = req.body;

    let signal = 'NO_TRADE';
    let confidence = 0;

    if (regime !== 'HIGH_RISK' && edge_strength === 'strong') {
        if (prob_up >= 65) {
            signal = 'BUY';
            confidence = prob_up;
        } else if (prob_down >= 65) {
            signal = 'SELL';
            confidence = prob_down;
        }
    }

    res.json({
        signal,
        confidence
    });
  } catch (error: any) {
    console.error('Hedge Fund Decision error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/strategy-optimizer', (req, res) => {
  try {
    const { 
        market_condition = 'choppy'
    } = req.body;

    let ema_sensitivity = 'medium';
    let filter_strictness = 50; // 1-100 scale

    if (market_condition === 'choppy') {
        ema_sensitivity = 'low';
        filter_strictness = 80;
    } else if (market_condition === 'strong_trend') {
        ema_sensitivity = 'high';
        filter_strictness = 30;
    } else {
        ema_sensitivity = 'medium';
        filter_strictness = 50;
    }

    res.json({
        adjustments: {
            ema_sensitivity,
            filter_strictness
        }
    });
  } catch (error: any) {
    console.error('Strategy Optimizer error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/hedge-fund-risk', (req, res) => {
  try {
    const { 
        account_equity = 10000,
        drawdown = 0,
        volatility = 0,
        recent_trades = []
    } = req.body;

    let risk_level = 'medium';
    let position_multiplier = 1.0;
    let can_trade = true;

    // Calculate winrate from recent_trades (assuming { profit: number } or similar)
    // For simplicity, let's say trade.profit > 0 is a win
    let wins = 0;
    if (recent_trades.length > 0) {
        recent_trades.forEach((t: any) => {
            if (t.is_win) {
                wins++;
            } else if (t.profit && t.profit > 0) {
                wins++;
            }
        });
        const winrate = wins / recent_trades.length;
        if (winrate < 0.4) {
            can_trade = false; // pause trading if winrate drops below 40%
        }
    }

    if (drawdown > 0.1) {
        risk_level = 'low'; // if drawdown increases (e.g. > 10%), reduce risk
        position_multiplier *= 0.5;
    }

    if (volatility > 0.5) { // if volatility spikes
        risk_level = 'low';
        position_multiplier *= 0.5; // reduce position size
    } else if (volatility > 0.3) {
        position_multiplier *= 0.8;
    } else if (drawdown === 0 && volatility < 0.2 && can_trade) {
        risk_level = 'high';
        position_multiplier = 1.5;
    }

    // Cap position multiplier
    position_multiplier = Math.max(0.1, Math.min(position_multiplier, 2.0));

    res.json({
        risk_level,
        position_multiplier,
        can_trade
    });
  } catch (error: any) {
    console.error('Hedge Fund Risk error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/final-execution', (req, res) => {
  try {
    const { 
        ai_signal = 'NO_TRADE',
        can_trade = true,
        risk_multiplier = 1.0,
        exposure = 0,
        exposure_limit = 100,
        market_regime = 'SIDEWAYS',
        base_position_size = 100
    } = req.body;

    let action = 'HOLD';
    let position_size = 0;
    let risk_status = 'rejected';

    if (can_trade && ai_signal !== 'NO_TRADE' && exposure < exposure_limit && market_regime !== 'HIGH_RISK') {
        action = ai_signal; // 'BUY' or 'SELL'
        position_size = base_position_size * risk_multiplier;
        
        // Ensure position size doesn't exceed available exposure
        const available_exposure = exposure_limit - exposure;
        if (position_size > available_exposure) {
            position_size = available_exposure;
        }

        risk_status = 'approved';
    } else {
        action = 'HOLD';
        position_size = 0;
        risk_status = 'rejected';
    }

    res.json({
        action,
        position_size,
        risk_status
    });
  } catch (error: any) {
    console.error('Final Execution Layer error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/feature-engineering', (req, res) => {
  try {
    const { ohlcv = [] } = req.body;

    if (!Array.isArray(ohlcv) || ohlcv.length === 0) {
        return res.json({
            ema34: [],
            ema89: [],
            ema200: [],
            price: 0,
            volatility: 'low'
        });
    }

    const closes = ohlcv.map((candle: any) => candle.close || 0);
    const current_price = closes[closes.length - 1];

    const calculateEma = (prices: number[], period: number) => {
        if (prices.length === 0) return [];
        const k = 2 / (period + 1);
        let emaArray = [prices[0]];
        for (let i = 1; i < prices.length; i++) {
            emaArray.push(prices[i] * k + emaArray[i - 1] * (1 - k));
        }
        return emaArray;
    };

    const ema34 = calculateEma(closes, 34);
    const ema89 = calculateEma(closes, 89);
    const ema200 = calculateEma(closes, 200);

    let volatility = 'low';
    if (ohlcv.length > 5) {
        let trSum = 0;
        for (let i = ohlcv.length - 5; i < ohlcv.length; i++) {
             const c = ohlcv[i];
             const prevClose = i > 0 ? ohlcv[i-1].close : c.open;
             const tr = Math.max(
                 c.high - c.low, 
                 Math.abs(c.high - prevClose), 
                 Math.abs(c.low - prevClose)
             );
             trSum += tr;
        }
        const avgTr = trSum / 5;
        const volRatio = current_price > 0 ? (avgTr / current_price) : 0;
        
        if (volRatio > 0.02) {
            volatility = 'high';
        } else if (volRatio > 0.005) {
            volatility = 'medium';
        }
    }

    res.json({
        ema34,
        ema89,
        ema200,
        price: current_price,
        volatility
    });

  } catch (error: any) {
    console.error('Feature Engineering error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/market-structure', (req, res) => {
  try {
    const { 
        swing_highs = [],
        swing_lows = [],
        recent_candles = [],
        ema_direction = 'none' // 'up', 'down', 'none'
    } = req.body;

    let structure = 'transition';
    let valid = false;

    // Detect Higher High / Higher Low and Lower High / Lower Low (simplified)
    let isHH_HL = false;
    let isLH_LL = false;

    if (swing_highs.length >= 2 && swing_lows.length >= 2) {
        const lastHigh = swing_highs[swing_highs.length - 1];
        const prevHigh = swing_highs[swing_highs.length - 2];
        const lastLow = swing_lows[swing_lows.length - 1];
        const prevLow = swing_lows[swing_lows.length - 2];

        if (lastHigh > prevHigh && lastLow > prevLow) {
            isHH_HL = true;
        } else if (lastHigh < prevHigh && lastLow < prevLow) {
            isLH_LL = true;
        }
    }

    if (isHH_HL) {
        structure = 'bullish';
    } else if (isLH_LL) {
        structure = 'bearish';
    }

    // Only confirm trend if structure matches EMA direction
    if (structure === 'bullish' && ema_direction === 'up') {
        valid = true;
    } else if (structure === 'bearish' && ema_direction === 'down') {
        valid = true;
    }

    res.json({
        structure,
        valid
    });
  } catch (error: any) {
    console.error('Market Structure error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/liquidity-trap', (req, res) => {
  try {
    const { 
        price_action = [], // Array of objects with open, high, low, close, volume
        recent_highs = [],
        recent_lows = []
    } = req.body;

    let fake_breakout = false;
    let liquidity_trap = false;
    let reason = 'Normal price action';

    if (price_action.length > 0) {
        const lastCandle = price_action[price_action.length - 1];
        const prevCandle = price_action.length > 1 ? price_action[price_action.length - 2] : null;

        // Check against nearest high/low
        const nearestHigh = recent_highs.length > 0 ? recent_highs[0] : Infinity;
        const nearestLow = recent_lows.length > 0 ? recent_lows[0] : 0;

        // Weak breakout (low volume breakout)
        let isLowVolume = false;
        if (prevCandle && lastCandle.volume < prevCandle.volume * 0.8) {
            isLowVolume = true;
        }

        // Fake breakout (breaks level but closes back inside)
        if (lastCandle.high > nearestHigh && lastCandle.close < nearestHigh) {
            fake_breakout = true;
            liquidity_trap = true;
            reason = 'Fake breakout above key high';
        } else if (lastCandle.low < nearestLow && lastCandle.close > nearestLow) {
            fake_breakout = true;
            liquidity_trap = true;
            reason = 'Fake breakout below key low';
        }

        // Stop hunt (long wick above/below key level)
        const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
        const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
        const body = Math.abs(lastCandle.close - lastCandle.open);

        if (lastCandle.high > nearestHigh && upperWick > body * 2) {
            liquidity_trap = true;
            reason = 'Stop hunt (long wick) at key high';
        } else if (lastCandle.low < nearestLow && lowerWick > body * 2) {
            liquidity_trap = true;
            reason = 'Stop hunt (long wick) at key low';
        }

        if (fake_breakout && isLowVolume) {
            reason += ' with low volume';
        }
    }

    res.json({
        fake_breakout,
        liquidity_trap,
        reason
    });
  } catch (error: any) {
    console.error('Liquidity Trap error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/price-action-signal', (req, res) => {
  try {
    const { 
        last_candles = [],
        ema_zones = {},
        market_regime = 'SIDEWAYS'
    } = req.body;

    let pa_signal = 'NULL';
    let pattern = 'none';

    if (market_regime !== 'SIDEWAYS' && last_candles.length >= 2) {
        const lastCandle = last_candles[last_candles.length - 1];
        const prevCandle = last_candles[last_candles.length - 2];
        const ema34 = ema_zones.ema_34 || 0;
        const ema89 = ema_zones.ema_89 || 0;

        // Check if near EMA zones (e.g. within 0.2% of EMA)
        const isNearEma34 = Math.abs(lastCandle.close - ema34) / ema34 < 0.002 || Math.abs(lastCandle.low - ema34) / ema34 < 0.002 || Math.abs(lastCandle.high - ema34) / ema34 < 0.002;
        const isNearEma89 = Math.abs(lastCandle.close - ema89) / ema89 < 0.002 || Math.abs(lastCandle.low - ema89) / ema89 < 0.002 || Math.abs(lastCandle.high - ema89) / ema89 < 0.002;

        if (isNearEma34 || isNearEma89) {
            const bodyEnd = Math.abs(lastCandle.close - lastCandle.open);
            const prevBodyEnd = Math.abs(prevCandle.close - prevCandle.open);

            const isBullishEngulfing = 
                prevCandle.close < prevCandle.open && 
                lastCandle.close > lastCandle.open &&
                lastCandle.close >= prevCandle.open &&
                lastCandle.open <= prevCandle.close;

            const isBearishEngulfing = 
                prevCandle.close > prevCandle.open && 
                lastCandle.close < lastCandle.open &&
                lastCandle.close <= prevCandle.open &&
                lastCandle.open >= prevCandle.close;

            const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
            const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;

            const isBullishPinbar = 
                lowerWick > bodyEnd * 2 && upperWick < bodyEnd * 0.5;

            const isBearishPinbar = 
                upperWick > bodyEnd * 2 && lowerWick < bodyEnd * 0.5;

            if (isBullishEngulfing) {
                pa_signal = 'BUY';
                pattern = 'engulfing';
            } else if (isBearishEngulfing) {
                pa_signal = 'SELL';
                pattern = 'engulfing';
            } else if (isBullishPinbar) {
                pa_signal = 'BUY';
                pattern = 'pinbar';
            } else if (isBearishPinbar) {
                pa_signal = 'SELL';
                pattern = 'pinbar';
            }
        }
    }

    res.json({
        pa_signal,
        pattern
    });
  } catch (error: any) {
    console.error('Price Action Signal error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/volume-confirmation', (req, res) => {
  try {
    const { 
        volume_data = [], 
        price_movement = 0,
        signal_direction = 'none'
    } = req.body;

    let volume_confirmed = false;
    let avgVolume = 0;

    if (volume_data.length >= 2) {
        const lastVolume = volume_data[volume_data.length - 1];
        const prevVolumes = volume_data.slice(0, volume_data.length - 1);
        avgVolume = prevVolumes.reduce((a: number, b: number) => a + Number(b), 0) / prevVolumes.length;

        // If strong movement (breakout/trend) -> volume must be above average
        let trend_volume_valid = false;
        let direction_valid = false;

        if (lastVolume > avgVolume) {
            trend_volume_valid = true;
        }

        if (signal_direction === 'BUY' && price_movement > 0) {
            direction_valid = true;
        } else if (signal_direction === 'SELL' && price_movement < 0) {
            direction_valid = true;
        }

        if (signal_direction !== 'none') {
            // Signal needs above-average volume + matching direction
            if (trend_volume_valid && direction_valid) {
                 volume_confirmed = true;
            } else {
                 volume_confirmed = false;
            }
        }
    }

    res.json({
        volume_confirmed
    });
  } catch (error: any) {
    console.error('Volume Confirmation error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/trade-scoring', (req, res) => {
  try {
    const { 
        trend_aligned = false,
        structure_valid = false,
        pa_signal_strong = false,
        volume_confirmed = false,
        no_liquidity_trap = false
    } = req.body;

    let score = 0;

    if (trend_aligned) score += 2;
    if (structure_valid) score += 2;
    if (pa_signal_strong) score += 2;
    if (volume_confirmed) score += 2;
    if (no_liquidity_trap) score += 2;

    const allow_trade = score >= 7;

    res.json({
        score,
        allow_trade
    });
  } catch (error: any) {
    console.error('Trade Scoring error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/risk-manager', (req, res) => {
  try {
    const { 
        daily_loss = 0,
        consecutive_losses = 0,
        drawdown = 0
    } = req.body;

    let risk_allowed = true;
    let position_size_multiplier = 1.0;

    if (daily_loss > 3) {
        risk_allowed = false;
    }

    if (drawdown > 10) {
        risk_allowed = false;
    }

    if (consecutive_losses >= 3) {
        position_size_multiplier = 0.5; // Reduce size after 3 consecutive losses
    }

    res.json({
        risk_allowed,
        position_size_multiplier
    });
  } catch (error: any) {
    console.error('Risk Manager error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/decision-engine', (req, res) => {
  try {
    const { 
        regime = 'SIDEWAYS',
        structure_valid = false,
        pa_signal = 'NULL',
        liquidity_trap = false,
        volume_confirmed = false,
        score = 0,
        risk_allowed = false,
        current_price = 0,
        recent_low = 0,
        recent_high = 0
    } = req.body;

    let signal = 'NO_TRADE';
    let entry = 0;
    let sl = 0;
    let tp = 0;
    let confidence = 'none';

    const isTrendValid = regime === 'TREND_UP' || regime === 'TREND_DOWN';
    
    // Only trade if all conditions met
    if (isTrendValid && structure_valid && !liquidity_trap && score >= 7 && risk_allowed) {
        if (pa_signal === 'BUY' && regime === 'TREND_UP') {
            signal = 'BUY';
            entry = current_price;
            sl = recent_low;
            // RR 1:2
            const risk = current_price - recent_low;
            tp = current_price + (risk * 2);
            confidence = 'high';
        } else if (pa_signal === 'SELL' && regime === 'TREND_DOWN') {
            signal = 'SELL';
            entry = current_price;
            sl = recent_high;
            // RR 1:2
            const risk = recent_high - current_price;
            tp = current_price - (risk * 2);
            confidence = 'high';
        }
    }

    if (signal === 'NO_TRADE') {
        res.json({
            signal
        });
    } else {
        res.json({
            signal,
            entry,
            sl,
            tp,
            confidence
        });
    }
  } catch (error: any) {
    console.error('Decision Engine error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/execution-system', (req, res) => {
  try {
    const { 
        regime = 'SIDEWAYS',
        volatility = 'LOW',
        order_size = 0,
        is_duplicate = false,
        large_order_threshold = 1000
    } = req.body;

    let execute = true;
    let order_type = 'limit';
    let notes = 'Standard execution';

    if (regime === 'HIGH_RISK') {
        execute = false;
        notes = 'Execution aborted: HIGH_RISK regime detected.';
    }

    if (is_duplicate) {
        execute = false;
        notes = 'Execution aborted: Duplicate signal.';
    }

    if (execute) {
        if (volatility === 'HIGH' && order_size >= large_order_threshold) {
             notes = 'Order split: High volatility and large order size.';
        }
    }

    res.json({
        execute,
        order_type,
        notes
    });
  } catch (error: any) {
    console.error('Execution System error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/backtest-engine', (req, res) => {
  try {
    const { 
        ohlcv = [], 
        strategy_rules = {}, 
        spread = 0.0001, 
        slippage = 0.0001
    } = req.body;

    let total_trades = 0;
    let winning_trades = 0;
    let gross_profit = 0;
    let gross_loss = 0;
    let max_drawdown = 0;
    let peak_balance = 10000;
    let current_balance = 10000;

    // Simulate trades
    if (ohlcv.length > 0) {
        for(let i=1; i<ohlcv.length; i++) {
            // Simplified realistic simulation stub that incorporates spread & slippage (simulated performance)
            if (i % 10 === 0) {
                total_trades++;
                const isWin = Math.random() > 0.5;
                if (isWin) {
                    winning_trades++;
                    const profit = 100 - (10000 * spread) - (10000 * slippage); 
                    gross_profit += profit;
                    current_balance += profit;
                } else {
                    const loss = 50 + (10000 * spread) + (10000 * slippage); 
                    gross_loss += loss;
                    current_balance -= loss;
                }
                
                if (current_balance > peak_balance) {
                    peak_balance = current_balance;
                }
                const draw_down = (peak_balance - current_balance) / peak_balance;
                if (draw_down > max_drawdown) {
                    max_drawdown = draw_down;
                }
            }
        }
    }

    const winrate = total_trades > 0 ? (winning_trades / total_trades) * 100 : 0;
    const profit_factor = gross_loss > 0 ? gross_profit / gross_loss : (gross_profit > 0 ? 999 : 0);
    const average_win = winning_trades > 0 ? gross_profit / winning_trades : 0;
    const average_loss = (total_trades - winning_trades) > 0 ? gross_loss / (total_trades - winning_trades) : 0;
    const expectancy = (winrate / 100 * average_win) - ((1 - winrate / 100) * average_loss);

    res.json({
        total_trades,
        winrate,
        profit_factor,
        max_drawdown: max_drawdown * 100, // percentage
        expectancy
    });
  } catch (error: any) {
    console.error('Backtest Engine error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/edge-evaluator', (req, res) => {
  try {
    const { 
        expectancy = 0,
        winrate = 0,
        profit_factor = 0,
        average_rr = 0 // average risk/reward 
    } = req.body;

    let has_edge = false;
    let confidence = 0;
    let reason = "Initial evaluation.";

    if (expectancy > 0) {
        if (profit_factor >= 1.5) {
            has_edge = true;
            confidence = 0.9;
            reason = "Excellent edge. Positive expectancy and strong profit factor.";
        } else if (profit_factor > 1.1) {
            has_edge = true;
            confidence = 0.7;
            reason = "Solid edge. Positive expectancy with healthy risk adjust returns.";
        } else if (profit_factor > 1.0) {
             has_edge = true;
             confidence = 0.4;
             reason = "Fragile edge. Positive expectancy but very tight profit factor.";
        } else {
             has_edge = false;
             confidence = 0.2;
             reason = "No edge. Despite positive expectancy, profit factor is too low to survive transaction costs.";
        }
    } else {
        has_edge = false;
        confidence = 0.9;
        reason = "System is mathematically guaranteed to lose over time (Expectancy <= 0).";
    }

    res.json({
        has_edge,
        confidence,
        reason
    });
  } catch (error: any) {
    console.error('Edge Evaluator error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/ml-prediction', (req, res) => {
  try {
    const { 
        ema_distance = 0,
        volume = 0,
        volatility = 0,
        structure = 'neutral',
        pa_patterns = [] 
    } = req.body;

    let prob_up = 50;
    let prob_down = 50;
    let model_confidence = 0.5;

    // Simple heuristical simulation of an ML model output based on inputs
    if (structure === 'bullish') {
        prob_up += 20;
        prob_down -= 20;
    } else if (structure === 'bearish') {
        prob_up -= 20;
        prob_down += 20;
    }

    if (ema_distance > 0) {
        prob_up += 10;
        prob_down -= 10;
    } else if (ema_distance < 0) {
         prob_up -= 10;
         prob_down += 10;
    }

    if (volume > 1000) {
         model_confidence = Math.min(0.9, model_confidence + 0.2);
    }

    // Normalize
    prob_up = Math.max(0, Math.min(100, prob_up));
    prob_down = 100 - prob_up;

    res.json({
        prob_up,
        prob_down,
        model_confidence
    });
  } catch (error: any) {
    console.error('ML Prediction error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/strategy-adaptation', (req, res) => {
  try {
    const { 
        market_condition = 'neutral', // 'choppy', 'trending_strong', 'neutral'
        winrate_trend = 'stable', // 'up', 'down', 'stable'
        volatility_shift = 'stable' // 'increasing', 'decreasing', 'stable'
    } = req.body;

    let ema_mode = 'normal';
    let filter_level = 5; // Base filter level 1-10

    if (market_condition === 'choppy' || volatility_shift === 'increasing') {
        // Tighten filters, conservative EMA
        ema_mode = 'conservative';
        filter_level = 8;
        if (winrate_trend === 'down') {
            filter_level = 10; // Max strictness
        }
    } else if (market_condition === 'trending_strong') {
        // Loosen filters, aggressive EMA to catch more of the trend
        ema_mode = 'aggressive';
        filter_level = 2;
    } else {
        // Neutral/stable
        if (winrate_trend === 'down') {
             ema_mode = 'conservative';
             filter_level = 7;
        } else if (winrate_trend === 'up') {
             ema_mode = 'aggressive';
             filter_level = 4;
        }
    }

    res.json({
        ema_mode,
        filter_level
    });
  } catch (error: any) {
    console.error('Strategy Adaptation error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/capital-protection', (req, res) => {
  try {
    const { 
        drawdown = 0,
        consecutive_losses = 0,
        volatility_spike = false
    } = req.body;

    let risk_state = 'normal';
    let position_multiplier = 1.0;

    if (drawdown > 10 || volatility_spike || consecutive_losses >= 5) {
        risk_state = 'paused';
        position_multiplier = 0.0;
    } else if (drawdown > 5 || consecutive_losses >= 3) {
        risk_state = 'reduced';
        position_multiplier = 0.5;
    }

    res.json({
        risk_state,
        position_multiplier
    });
  } catch (error: any) {
    console.error('Capital Protection error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/regime-learning', (req, res) => {
  try {
    const { 
        trend_performance = 0,
        sideways_performance = 0,
        volatility_performance = 0
    } = req.body;

    let best_regime = 'trend';
    let max_perf = trend_performance;

    if (sideways_performance > max_perf) {
        best_regime = 'sideways';
        max_perf = sideways_performance;
    }
    if (volatility_performance > max_perf) {
        best_regime = 'volatility';
        max_perf = volatility_performance;
    }

    // Normalized suitability score (0-1) based on max performance relative to an expected baseline (e.g., 100)
    let strategy_suitability = Math.max(0, Math.min(1, max_perf / 100));

    res.json({
        best_regime,
        strategy_suitability
    });
  } catch (error: any) {
    console.error('Regime Learning error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/portfolio-allocation', (req, res) => {
  try {
    const { 
        candidates = [], // Array of objects like { symbol: 'BTC/USDT', score: 85 }
        correlations = {} // Record<string, string[]> -> { 'BTC/USDT': ['ETH/USDT'] }
    } = req.body;

    // Rules:
    // Max exposure per asset: 0.10 to 0.20
    // Total exposure max: 0.30 to 0.50
    // Penalize correlated assets

    let total_exposure = 0;
    const TOTAL_MAX_EXPOSURE = 0.50; // max 50%
    const MAX_ASSET_EXPOSURE = 0.15; // default max 15% per asset

    // Sort candidates by score descending
    const sortedCandidates = [...candidates].sort((a: any, b: any) => b.score - a.score);
    
    let allocations = [];
    const used_symbols = new Set<string>();

    for (const candidate of sortedCandidates) {
        if (total_exposure >= TOTAL_MAX_EXPOSURE) {
            break;
        }

        // Check correlation penalization
        let correlation_penalty = 1.0;
        const asset_correlations = correlations[candidate.symbol] || [];
        for (const used of used_symbols) {
            if (asset_correlations.includes(used)) {
                correlation_penalty *= 0.5; // Reduce weight if correlated with an already allocated asset
            }
        }

        // Base weight depending on score (simplified)
        let base_weight = candidate.score > 80 ? MAX_ASSET_EXPOSURE : 0.10;
        
        let final_weight = base_weight * correlation_penalty;
        
        // Ensure we don't exceed max asset limit
        final_weight = Math.min(final_weight, MAX_ASSET_EXPOSURE);

        // Ensure we don't exceed total exposure limit
        if (total_exposure + final_weight > TOTAL_MAX_EXPOSURE) {
            final_weight = TOTAL_MAX_EXPOSURE - total_exposure;
        }

        if (final_weight > 0.01) { // Minimum meaningful allocation
            allocations.push({
                symbol: candidate.symbol,
                weight: final_weight
            });
            total_exposure += final_weight;
            used_symbols.add(candidate.symbol);
        }
    }

    res.json({
        allocations
    });
  } catch (error: any) {
    console.error('Portfolio Allocation error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/hedge-fund-decision', (req, res) => {
  try {
    const { 
        has_edge = false,
        prob_up = 50,
        prob_down = 50,
        risk_state = 'normal',
        current_regime = 'trend',
        best_regime = 'trend',
        base_position_size = 1.0
    } = req.body;

    let signal = 'NO_TRADE';
    let confidence = 0;
    let position_size = 0;

    const max_prob = Math.max(prob_up, prob_down);
    const correct_regime = current_regime === best_regime;

    if (has_edge && max_prob > 65 && risk_state === 'normal' && correct_regime) {
        if (prob_up > prob_down) {
            signal = 'BUY';
        } else {
            signal = 'SELL';
        }
        confidence = max_prob / 100;
        position_size = base_position_size;
    }

    res.json({
        signal,
        confidence,
        position_size
    });
  } catch (error: any) {
    console.error('Hedge Fund Decision error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/ml-training-pipeline', (req, res) => {
  try {
    const { 
        data_points = 0,
        model_preference = 'XGBoost', // 'XGBoost' or 'LSTM'
        features = []
    } = req.body;

    // Simulated training output
    let accuracy = 0;
    let precision = 0;
    let recall = 0;
    let best_features = [];

    if (data_points > 1000) {
        if (model_preference === 'XGBoost') {
            accuracy = 0.68;
            precision = 0.65;
            recall = 0.70;
            best_features = ['ema_distance_34', 'volume_delta', 'rsi'];
        } else if (model_preference === 'LSTM') {
            accuracy = 0.71;
            precision = 0.68;
            recall = 0.72;
            best_features = ['sequence_pa', 'volatility_rolling', 'ema_distance_200'];
        }
    } else {
        // Insufficient data
        accuracy = 0.52;
        precision = 0.51;
        recall = 0.50;
        best_features = ['rsi'];
    }

    res.json({
        model_type: model_preference,
        accuracy,
        precision,
        recall,
        best_features
    });
  } catch (error: any) {
    console.error('ML Training Pipeline error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/trading-analytics', (req, res) => {
  try {
    const { 
        trade_history = [],
        initial_capital = 10000
    } = req.body;

    // Simulate calculated analytics based on a simple heuristic
    const equity_curve = [initial_capital];
    let current_capital = initial_capital;
    let wins = 0;
    let max_peak = initial_capital;
    let max_drawdown = 0;

    // Dummy data generation
    for (let i = 0; i < 30; i++) {
        const isWin = Math.random() > 0.4;
        const pnl = isWin ? (Math.random() * 200 + 50) : -(Math.random() * 150 + 50);
        
        if (isWin) wins++;

        current_capital += pnl;
        equity_curve.push(current_capital);

        if (current_capital > max_peak) {
            max_peak = current_capital;
        }

        const drawdown = ((max_peak - current_capital) / max_peak) * 100;
        if (drawdown > max_drawdown) {
            max_drawdown = drawdown;
        }
    }

    const winrate = (wins / 30) * 100;
    const sharpe_ratio = 1.25 + (Math.random() * 0.5); // Simulated Sharpe
    const current_exposure = 0.15; // Simulated 15% current exposure

    res.json({
        equity_curve,
        winrate,
        max_drawdown,
        sharpe_ratio,
        current_exposure
    });
  } catch (error: any) {
    console.error('Trading Analytics error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/live-trading-bot', (req, res) => {
  try {
    const { 
        market_data = {},
        recent_trades_count = 0,
        current_model_version = 'v1.0'
    } = req.body;

    let signal = 'NO_TRADE';
    let entry = 0;
    let confidence = 0;
    let model_version = current_model_version;

    // Simulate ML model + EMA system prediction
    const current_price = market_data.price || 10000;
    const isWin = Math.random() > 0.5;
    
    if (Math.random() > 0.6) {
        signal = isWin ? 'BUY' : 'SELL';
        entry = current_price;
        confidence = 0.65 + (Math.random() * 0.3); // 65% to 95%
    }

    // Retraining rule: do not retrain too frequently, only after statistically meaningful data
    if (recent_trades_count >= 100) {
        // Retrain model, adjust feature importance and update thresholds dynamically
        const versionParts = model_version.replace('v', '').split('.');
        const major = parseInt(versionParts[0]) || 1;
        const minor = parseInt(versionParts[1]) || 0;
        
        model_version = `v${major}.${minor + 1}`;
        console.log(`[ML Pipeline] Model retrained with ${recent_trades_count} new trades. New version: ${model_version}`);
    }

    res.json({
        signal,
        entry,
        confidence,
        model_version
    });
  } catch (error: any) {
    console.error('Live Trading Bot error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/performance-optimizer', (req, res) => {
  try {
    const { 
        trade_history = [],
        model_performance = {},
        risk_metrics = {},
        market_conditions = 'neutral'
    } = req.body;

    // Simulate analysis of profitable setups
    const setups = [
        { type: 'EMA_TREND', winrate: 0.55 + (Math.random() * 0.1) },
        { type: 'PULLBACK', winrate: 0.50 + (Math.random() * 0.1) },
        { type: 'BREAKOUT', winrate: 0.45 + (Math.random() * 0.1) }
    ];

    setups.sort((a, b) => b.winrate - a.winrate);
    const best_strategy_type = setups[0].type;

    // Adjust weights based on performance
    const adjusted_weights = {
        ema_trend: setups.find(s => s.type === 'EMA_TREND')?.winrate || 0.5,
        pullback: setups.find(s => s.type === 'PULLBACK')?.winrate || 0.5,
        breakout: setups.find(s => s.type === 'BREAKOUT')?.winrate || 0.5,
    };

    // Optimize risk
    const new_risk_params = {
        position_sizing: market_conditions === 'high_volatility' ? 'dynamic_reduced' : 'dynamic_normal',
        base_exposure: market_conditions === 'choppy' ? 0.05 : 0.15,
        sl_tp_ratio: best_strategy_type === 'EMA_TREND' ? [1, 2.5] : [1, 1.5]
    };

    const expected_improvement = 0.05 + Math.random() * 0.1; // 5% to 15% expected improvement

    res.json({
        best_strategy_type,
        adjusted_weights,
        new_risk_params,
        expected_improvement
    });
  } catch (error: any) {
    console.error('Performance Optimizer error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/professional-trading-system', (req, res) => {
  try {
    const { 
        market_data, // OHLCV, multiple timeframes
        account_state = { current_drawdown: 0, consecutive_losses: 0 }
    } = req.body;

    // Feature Engineering (Simulated)
    const ema_34 = market_data?.ema_34 || 100;
    const ema_89 = market_data?.ema_89 || 95;
    const ema_200 = market_data?.ema_200 || 90;
    const current_price = market_data?.close || 105;
    const volume_strength = market_data?.volume_strength || 'strong';
    const trend_direction = current_price > ema_34 && ema_34 > ema_89 ? 'UP' : (current_price < ema_34 && ema_34 < ema_89 ? 'DOWN' : 'SIDEWAYS');

    // Market Regime Detection (Simulated)
    let market_regime = 'SIDEWAYS';
    if (trend_direction === 'UP' && volume_strength === 'strong') {
        market_regime = 'TREND_UP';
    } else if (trend_direction === 'DOWN' && volume_strength === 'strong') {
        market_regime = 'TREND_DOWN';
    } else if (market_data?.volatility === 'extreme') {
        market_regime = 'HIGH_RISK';
    }

    // Risk Management
    if (account_state.current_drawdown > 0.05) {
        return res.json({
            signal: 'NO_TRADE',
            reason: 'Risk Management: Maximum drawdown limit exceeded (> 5%)'
        });
    }

    // Filtering Rules
    if (market_regime === 'SIDEWAYS') {
        return res.json({
            signal: 'NO_TRADE',
            reason: 'Filtering: Market is SIDEWAYS'
        });
    }
    if (market_regime === 'HIGH_RISK') {
         return res.json({
            signal: 'NO_TRADE',
            reason: 'Filtering: Market is HIGH_RISK (manipulation/unstable)'
        });
    }
    if (volume_strength === 'weak') {
        return res.json({
            signal: 'NO_TRADE',
            reason: 'Filtering: Volume is weak'
        });
    }

    // Signal Generation & Final Decision
    // (Simulate a valid trade if trend is UP and price pulls back to EMA 34)
    const is_pullback = trend_direction === 'UP' && Math.abs(current_price - ema_34) / current_price < 0.01;

    if (market_regime === 'TREND_UP' && is_pullback) {
        return res.json({
            signal: 'BUY',
            entry: current_price,
            stop_loss: ema_89,
            take_profit: current_price + (current_price - ema_89) * 2, // 1:2 Risk Reward
            confidence: 85,
            reason: 'Strong UP trend with valid EMA 34 pullback entry and strong volume.'
        });
    } else if (market_regime === 'TREND_DOWN' && trend_direction === 'DOWN') {
        // Just for example, another setup
        return res.json({
             signal: 'SELL',
             entry: current_price,
             stop_loss: ema_89,
             take_profit: current_price - (ema_89 - current_price) * 2,
             confidence: 80,
             reason: 'Strong DOWN trend continuation detected.'
        });
    }

    res.json({
        signal: 'NO_TRADE',
        reason: 'No valid high-probability setup detected.'
    });
  } catch (error: any) {
    console.error('Professional Trading System error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/data-labeling-system', (req, res) => {
  try {
    const { 
        historical_data = [], // Array of OHLCV
        look_forward_candles = 5 // N candles to check outcome
    } = req.body;

    // We simulate creating a training dataset
    // For each candle (except the last N candles), we extract features and label the outcome
    let number_of_samples = 0;
    
    if (historical_data && historical_data.length > look_forward_candles) {
        number_of_samples = historical_data.length - look_forward_candles;
    } else if (historical_data.length > 0) {
        number_of_samples = 0;
    } else {
        // Mock some samples if no data provided
        number_of_samples = 1500;
    }

    res.json({
        dataset_ready: true,
        samples: number_of_samples
    });
  } catch (error: any) {
    console.error('Data Labeling System error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/ml-model-trainer', (req, res) => {
  try {
    const { 
        model_type = 'XGBoost', // 'XGBoost' or 'LSTM'
        dataset_size = 10000
    } = req.body;

    // Simulate walk-forward validation and training
    let accuracy = 0.65;
    let overfitting_check = true; // Indicates no overfitting detected
    let feature_importance: any[] = [];

    if (model_type === 'XGBoost') {
        accuracy = 0.68 + (Math.random() * 0.05);
        feature_importance = [
            { feature: 'ema_34_distance', weight: 0.35 },
            { feature: 'volume_delta', weight: 0.25 },
            { feature: 'rsi', weight: 0.15 },
            { feature: 'market_regime', weight: 0.10 },
            { feature: 'pa_pattern', weight: 0.15 }
        ];
    } else {
        accuracy = 0.71 + (Math.random() * 0.04);
        feature_importance = [
            { feature: 'close_sequence_10', weight: 0.40 },
            { feature: 'volume_sequence_10', weight: 0.30 },
            { feature: 'volatility_rolling', weight: 0.20 },
            { feature: 'ema_200_distance', weight: 0.10 }
        ];
    }

    // In a real scenario, compare train accuracy vs validation accuracy
    if (Math.random() > 0.9) {
         overfitting_check = false; // Simulate occasional overfitting
    }

    res.json({
        model_type,
        accuracy,
        overfitting_check,
        feature_importance
    });
  } catch (error: any) {
    console.error('ML Model Trainer error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/trading-prediction-ai', (req, res) => {
  try {
    const { 
        ema_data = {},
        volume_data = {},
        structure_data = {},
        pa_data = {}
    } = req.body;

    // Simulate model prediction
    let prob_up = Math.random() * 100;
    let prob_down = 100 - prob_up;
    let confidence = Math.random();

    // Adjust probability based on mock features
    if (ema_data.trend === 'bullish' && volume_data.strength === 'high') {
        prob_up = 65 + (Math.random() * 20);
        prob_down = 100 - prob_up;
        confidence = 0.7 + (Math.random() * 0.2);
    } else if (ema_data.trend === 'bearish' && volume_data.strength === 'high') {
        prob_down = 65 + (Math.random() * 20);
        prob_up = 100 - prob_down;
        confidence = 0.7 + (Math.random() * 0.2);
    }

    res.json({
        prob_up: parseFloat(prob_up.toFixed(2)),
        prob_down: parseFloat(prob_down.toFixed(2)),
        confidence: parseFloat(confidence.toFixed(2))
    });
  } catch (error: any) {
    console.error('Trading Prediction AI error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/self-learning-trading-system', (req, res) => {
  try {
    const { 
        recent_trades = [],
        current_features = []
    } = req.body;

    // Simulate analyzing win/loss patterns and updating the model
    const model_updated = recent_trades.length >= 50; // Require a minimum batch size to avoid overfitting
    let improvement = 0;
    let new_best_features = current_features;

    if (model_updated) {
        // Simulate an improvement between 0.5% and 2.5%
        improvement = parseFloat((0.005 + Math.random() * 0.02).toFixed(4));
        
        // Simulate discovering new best features and adjusting weights
        new_best_features = [
            { name: 'ema_crossover_momentum', weight: 0.35 },
            { name: 'volume_profile_delta', weight: 0.25 },
            { name: 'volatility_squeeze', weight: 0.20 },
            { name: 'multi_timeframe_alignment', weight: 0.20 }
        ];
    }

    res.json({
        model_updated,
        improvement,
        new_best_features
    });
  } catch (error: any) {
    console.error('Self Learning Trading System error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

tradingRouter.post('/hedge-fund-ai-decision-system', (req, res) => {
  try {
    const { 
        ml_output = { prob_up: 50, prob_down: 50, confidence: 0.5 },
        market_regime = 'SIDEWAYS',
        risk_status = 'denied'
    } = req.body;

    const { prob_up, prob_down, confidence } = ml_output;

    const isTrend = market_regime.includes('TREND');
    const isRiskAllowed = risk_status === 'allowed';
    
    if (isTrend && isRiskAllowed) {
        if (prob_up > 65) {
            return res.json({
                signal: 'BUY',
                confidence,
                reason: 'ML + market confirmation'
            });
        }
        if (prob_down > 65) {
            return res.json({
                signal: 'SELL',
                confidence,
                reason: 'ML + market confirmation'
            });
        }
    }

    res.json({
        signal: 'NO_TRADE'
    });
  } catch (error: any) {
    console.error('Hedge Fund AI Decision System error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Bot State
interface BotConfig {
  strategy: string;
  risk: number;
  capital: number;
  timeframe: string;
}

let botState = {
  isRunning: false,
  config: { strategy: 'MACD Crossover', risk: 2, capital: 1000, timeframe: '15m' },
  activeOrders: 0
};

tradingRouter.get('/bot/status', (req, res) => {
  res.json(botState);
});

tradingRouter.post('/bot/start', (req, res) => {
  botState.isRunning = true;
  if (req.body.config) {
    botState.config = { ...botState.config, ...req.body.config };
  }
  broadcast('BOT_STATUS', botState);
  broadcast('LOG', { level: 'INFO', message: 'Bot started with strategy: ' + botState.config.strategy });
  res.json({ status: 'success', botState });
});

tradingRouter.post('/bot/stop', (req, res) => {
  botState.isRunning = false;
  botState.activeOrders = 0;
  broadcast('BOT_STATUS', botState);
  broadcast('LOG', { level: 'INFO', message: 'Bot stopped manually.' });
  res.json({ status: 'success', botState });
});

tradingRouter.post('/order', (req, res) => {
  const { pair, side, type, volume, price, stopLoss, takeProfit } = req.body;
  
  const newOrder: Order = {
    id: `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    pair,
    side,
    type,
    volume: Number(volume),
    price: price ? Number(price) : undefined,
    stopLoss: stopLoss ? Number(stopLoss) : undefined,
    takeProfit: takeProfit ? Number(takeProfit) : undefined,
    status: type === 'MARKET' ? 'FILLED' : 'OPEN',
    createdAt: new Date().toISOString(),
  };

  orders.push(newOrder);
  broadcast('ORDER_CREATED', newOrder);
  broadcast('LOG', { level: 'TRADE', message: `Order placed: ${side} ${type} ${volume} ${pair}` });

  // If MARKET order, simulate creating a position
  if (type === 'MARKET') {
      const entryPrice = price || 65000; // Mock current price if not provided
      const existingPositionIndex = positions.findIndex(p => p.pair === pair);
      if (existingPositionIndex >= 0) {
          // Simplistic position merge logic
          const p = positions[existingPositionIndex];
          if ((side === 'BUY' && p.side === 'LONG') || (side === 'SELL' && p.side === 'SHORT')) {
             p.size += newOrder.volume;
          } else {
             p.size -= newOrder.volume;
             if (p.size < 0) {
                 p.size = Math.abs(p.size);
                 p.side = side === 'BUY' ? 'LONG' : 'SHORT';
                 p.entry = entryPrice;
             } else if (p.size === 0) {
                 positions.splice(existingPositionIndex, 1);
             }
          }
      } else {
          positions.push({
              id: `pos_${Date.now()}`,
              pair,
              side: side === 'BUY' ? 'LONG' : 'SHORT',
              size: newOrder.volume,
              entry: entryPrice,
              mark: entryPrice,
              pnl: 0,
          });
      }
      broadcast('POSITIONS_UPDATED', positions);
  }

  res.json({ status: 'success', message: 'Order placed', order: newOrder });
});

tradingRouter.delete('/order/:id', (req, res) => {
  const { id } = req.params;
  const order = orders.find(o => o.id === id);
  if (order && order.status === 'OPEN') {
      order.status = 'CANCELED';
      broadcast('ORDER_UPDATED', order);
      broadcast('LOG', { level: 'INFO', message: `Order canceled: ${id}` });
      return res.json({ status: 'success', message: 'Order canceled' });
  }
  broadcast('LOG', { level: 'ERROR', message: `Failed to cancel order: ${id}` });
  return res.status(404).json({ status: 'error', message: 'Order not found or already processed' });
});

tradingRouter.delete('/position/:id', (req, res) => {
  const { id } = req.params;
  const index = positions.findIndex(p => p.id === id);
  if (index >= 0) {
      const pos = positions[index];
      positions.splice(index, 1);
      broadcast('POSITIONS_UPDATED', positions);
      broadcast('LOG', { level: 'TRADE', message: `Position closed: ${pos.pair} ${pos.side} (PnL: ${pos.pnl})` });
      return res.json({ status: 'success', message: 'Position closed' });
  }
  broadcast('LOG', { level: 'ERROR', message: `Failed to close position: ${id}` });
  return res.status(404).json({ status: 'error', message: 'Position not found' });
});

// Periodic bot simulation (if running)
setInterval(() => {
  if (botState.isRunning) {
    const rand = Math.random();
    if (rand > 0.95) {
      botState.activeOrders += 1;
      broadcast('BOT_STATUS', botState);
      broadcast('LOG', { level: 'TRADE', message: 'Bot executed algorithmic signal: BUY 1.5 ETH' });
    } else if (rand > 0.90 && rand <= 0.95) {
      broadcast('LOG', { level: 'ERROR', message: 'API Rate limit exceeded on Binance connector.' });
    } else if (rand > 0.85 && rand <= 0.90) {
      broadcast('LOG', { level: 'INFO', message: 'ETH price hit upper Bollinger Band resistance.', showToast: true });
    } else if (rand > 0.80 && rand <= 0.85) {
      broadcast('LOG', { level: 'TRADE', message: 'Trailing Stop Triggered: Sold 2.0 SOL.' });
    }
  }
}, 3000);

// Background Scanner
function calculateRSI(data: any[], period: number = 14) {
  if (!data || data.length <= period) return [];
  let rsiData = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgGain / (avgLoss === 0 ? 1e-10 : avgLoss);
  rsiData.push({ time: data[period].time, value: 100 - (100 / (1 + rs)) });

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    let rs = avgGain / (avgLoss === 0 ? 1e-10 : avgLoss);
    rsiData.push({ time: data[i].time, value: 100 - (100 / (1 + rs)) });
  }
  return rsiData;
}

function isPinbar(candle: any, trend: 'bullish' | 'bearish'): boolean {
  if (!candle) return false;
  const bodySize = Math.abs(candle.close - candle.open);
  const upperWick = candle.high - Math.max(candle.close, candle.open);
  const lowerWick = Math.min(candle.close, candle.open) - candle.low;
  
  if (trend === 'bullish') {
    return lowerWick > bodySize * 2.0 && upperWick < bodySize;
  } else {
    return upperWick > bodySize * 2.0 && lowerWick < bodySize;
  }
}

function isEngulfing(current: any, prev: any, trend: 'bullish' | 'bearish'): boolean {
  if (!current || !prev) return false;
  const currentBody = Math.abs(current.close - current.open);
  const prevBody = Math.abs(prev.close - prev.open);
  
  if (trend === 'bullish') {
    return current.close > current.open && prev.close < prev.open && currentBody > prevBody && current.close >= prev.open && current.open <= prev.close;
  } else {
    return current.close < current.open && prev.close > prev.open && currentBody > prevBody && current.close <= prev.open && current.open >= prev.close;
  }
}

let lastSignals: Record<string, string> = {};
const SCAN_INTERVAL = 2 * 60 * 1000;
const SCAN_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'];
const SCAN_TIMEFRAMES = ['1m', '15m', '1h'];
const MAX_CONCURRENT_TRADES = 3;

async function runBackgroundScan() {
  console.log('[Scanner] Starting background scan loop...');
  try {
    let openTradesCount = 0;
    try {
        openTradesCount = await TradeModel.countDocuments({ status: 'OPEN' });
    } catch (e) {
        // ignore if db not connected
    }
    
    for (const symbol of SCAN_SYMBOLS) {
      const timeframesData: Record<string, any> = {};
      let hasAllData = true;

      const promises = SCAN_TIMEFRAMES.map(tf => 
         fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=250`)
         .then(res => { if(!res.ok) throw new Error("fetch fail"); return res.json(); })
         .then(json => ({ timeframe: tf, data: json }))
      );

      let results;
      try {
         results = await Promise.all(promises);
      } catch (e) {
         hasAllData = false;
         continue;
      }

      for (const res of results) {
        const tf = res.timeframe;
        const json = res.data;
        const candles = json.map((d: any) => ({
          time: Math.floor(d[0] / 1000),
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
          volume: parseFloat(d[5])
        }));

        const ema20 = calculateServerEMA(candles, 20);
        const ema34 = calculateServerEMA(candles, 34);
        const ema50 = calculateServerEMA(candles, 50);
        const ema89 = calculateServerEMA(candles, 89);
        const ema200 = calculateServerEMA(candles, 200);
        const rsi14 = calculateRSI(candles, 14);

        const lastClose = candles[candles.length - 1]?.close;
        const lastCandle = candles[candles.length - 1];
        const prevCandle = candles[candles.length - 2];
        const lastEma20 = ema20[ema20.length - 1]?.value;
        const lastEma34 = ema34[ema34.length - 1]?.value;
        const lastEma50 = ema50[ema50.length - 1]?.value;
        const lastEma89 = ema89[ema89.length - 1]?.value;
        const lastEma200 = ema200[ema200.length - 1]?.value;
        const lastRsi = rsi14[rsi14.length - 1]?.value;

        if (!lastClose || !lastEma20 || !lastEma50 || !lastEma89 || !lastEma200 || !lastRsi) {
           hasAllData = false; break;
        }

        let crossedLongRecent = false;
        let crossedShortRecent = false;
        for (let i = 1; i <= 5; i++) {
           const idx = ema20.length - i;
           if (idx < 1) continue;
           const pIdx = idx - 1;
           if (ema20[idx]?.value > ema50[idx]?.value && ema20[pIdx]?.value <= ema50[pIdx]?.value) crossedLongRecent = true;
           if (ema20[idx]?.value < ema50[idx]?.value && ema20[pIdx]?.value >= ema50[pIdx]?.value) crossedShortRecent = true;
        }

        const recentCandles = candles.slice(-21, -1);
        const swingHigh = Math.max(...recentCandles.map((c: any) => c.high));
        const swingLow = Math.min(...recentCandles.map((c: any) => c.low));
        let fakeBreakoutBullish = false;
        let fakeBreakoutBearish = false;
        
        const brokeSupport = (lastCandle.low < swingLow) || (prevCandle.low < swingLow);
        const closedInsideSupport = (lastCandle.close > swingLow);
        if (brokeSupport && closedInsideSupport) fakeBreakoutBullish = true;

        const brokeResistance = (lastCandle.high > swingHigh) || (prevCandle.high > swingHigh);
        const closedInsideResistance = (lastCandle.close < swingHigh);
        if (brokeResistance && closedInsideResistance) fakeBreakoutBearish = true;

        timeframesData[tf] = {
            close: lastClose,
            lastCandle,
            prevCandle,
            ema20: lastEma20,
            ema34: lastEma34,
            ema50: lastEma50,
            ema89: lastEma89,
            ema200: lastEma200,
            crossedLongRecent,
            crossedShortRecent,
            fakeBreakoutBullish,
            fakeBreakoutBearish,
            rsi: lastRsi
        };
      }

      if (!hasAllData) continue;

      const tf1h = timeframesData['1h'];
      const tf15m = timeframesData['15m'];
      const tf1m = timeframesData['1m'];

      let signal = 'NONE';
      let triggeredStrategy = '';
      let score = 0;
      let mSignalCount = { BUY: 0, SELL: 0 };
      let strategiesMatched: string[] = [];

      // PILLAR 1: EMA Trend (34, 89, 200) Setup
      let p1Buy = tf1h.close > tf1h.ema200 && tf15m.ema34 > tf15m.ema89 && tf15m.ema89 > tf15m.ema200 && tf1m.close > tf1m.ema34;
      let p1Sell = tf1h.close < tf1h.ema200 && tf15m.ema34 < tf15m.ema89 && tf15m.ema89 < tf15m.ema200 && tf1m.close < tf1m.ema34;
      if (p1Buy) { mSignalCount.BUY++; strategiesMatched.push('EMA_Trend_34_89'); }
      if (p1Sell) { mSignalCount.SELL++; strategiesMatched.push('EMA_Trend_34_89'); }

      // PILLAR 2: Price Action & Liquidity Trap Breakout
      let isBullishPinbar = isPinbar(tf1m.lastCandle, 'bullish') || isEngulfing(tf1m.lastCandle, tf1m.prevCandle, 'bullish');
      let isBearishPinbar = isPinbar(tf1m.lastCandle, 'bearish') || isEngulfing(tf1m.lastCandle, tf1m.prevCandle, 'bearish');
      let p2Buy = tf1h.close > tf1h.ema200 && tf15m.fakeBreakoutBullish && isBullishPinbar;
      let p2Sell = tf1h.close < tf1h.ema200 && tf15m.fakeBreakoutBearish && isBearishPinbar;
      if (p2Buy) { mSignalCount.BUY++; strategiesMatched.push('PA_Liquidity_Trap'); }
      if (p2Sell) { mSignalCount.SELL++; strategiesMatched.push('PA_Liquidity_Trap'); }

      // PILLAR 3: Multi-TF Crossover & M1 Pullback
      let p3Buy = tf1h.close > tf1h.ema200 && tf15m.ema20 > tf15m.ema50 && tf15m.crossedLongRecent;
      let p3Sell = tf1h.close < tf1h.ema200 && tf15m.ema20 < tf15m.ema50 && tf15m.crossedShortRecent;
      if (p3Buy || p3Sell) {
          const m1Ema20Pull = Math.abs(tf1m.close - tf1m.ema20) / tf1m.close < 0.001; 
          const m1Ema50Pull = Math.abs(tf1m.close - tf1m.ema50) / tf1m.close < 0.001;
          const isPullback = m1Ema20Pull || m1Ema50Pull;
          
          if (p3Buy && isPullback && isBullishPinbar) { mSignalCount.BUY++; strategiesMatched.push('MultiTF_Pullback'); }
          if (p3Sell && isPullback && isBearishPinbar) { mSignalCount.SELL++; strategiesMatched.push('MultiTF_Pullback'); }
      }

      // Check overarching combination
      let side = '';
      if (mSignalCount.BUY > mSignalCount.SELL && mSignalCount.BUY >= 1) {
          side = 'BUY';
          score = mSignalCount.BUY * 3; // +3 for every matched pillar
          if (tf1m.rsi > 30 && tf1m.rsi < 70) score += 1;
      } else if (mSignalCount.SELL > mSignalCount.BUY && mSignalCount.SELL >= 1) {
          side = 'SELL';
          score = mSignalCount.SELL * 3;
          if (tf1m.rsi > 30 && tf1m.rsi < 70) score += 1;
      }

      if (score >= 3 && mSignalCount[side as 'BUY'|'SELL'] >= 1) {
          signal = side;
          triggeredStrategy = strategiesMatched.join(' + ');
      }

      console.log(`[Scanner Multi-TF] Evaluated ${symbol} - Score: ${score}/10 - Matched: ${mSignalCount.BUY} Buy / ${mSignalCount.SELL} Sell - Final Signal: ${signal}`);

      const signalKey = symbol;
      if (signal !== 'NONE') {
        const previousSignal = lastSignals[signalKey] || 'NONE';
        if (signal !== previousSignal) {
          lastSignals[signalKey] = signal;
          
          const entry = tf1m.close;
          const FEE_RATE = 0.001; 
          const feeSlippage = entry * FEE_RATE;
          
          let sl = 0;
          let breakeven = 0;
          let tp1 = 0;
          let tp2 = 0;
          
          if (signal === 'BUY') {
            breakeven = entry + feeSlippage;
            tp1 = breakeven + (entry * 0.005);
            tp2 = entry * 1.03;
            sl = entry * 0.99; // Lệnh SL cơ bản
            if (tf1m.low < entry * 0.99) sl = tf1m.low; // Đặt SL dưới râu nến nếu có thể
          } else {
            breakeven = entry - feeSlippage;
            tp1 = breakeven - (entry * 0.005);
            tp2 = entry * 0.97;
            sl = entry * 1.01;
            if (tf1m.high > entry * 1.01) sl = tf1m.high;
          }

          const strategiesSummary = `Confluence: ${strategiesMatched.length}/3 Pillars\nTriggers: ${triggeredStrategy}`;
          const formattedMessage = `COIN: ${symbol}\nSTRATEGY: Custom Combo (${strategiesMatched.length}/3)\nPRIZE: ${entry.toFixed(4)}\nSL: ${sl.toFixed(4)}\nBREAKEVEN: ${breakeven.toFixed(4)}\nTP1: ${tp1.toFixed(4)}\nTP2 (FINAL): ${tp2.toFixed(4)}\nSCORE: ${score}/10\n${strategiesSummary}`;
          
          console.log('\n--- Multi-TF Trading Signal ---');
          console.log(formattedMessage);
          console.log('-------------------------------\n');

          broadcast('LOG', { 
            level: 'INFO', 
            message: `🤖 Scanner Alert (Combo):\n${formattedMessage}`,
            showToast: true 
          });

          // Execution & Notifications
          if (openTradesCount >= MAX_CONCURRENT_TRADES) {
              console.log(`[Scanner] Skipped CCXT execution for ${symbol}: Reached max concurrent trades (${MAX_CONCURRENT_TRADES})`);
              continue;
          }

          try {
              let ccxtSymbol = symbol;
              if (symbol.endsWith('USDT')) {
                  ccxtSymbol = symbol.replace('USDT', '/USDT');
              }
              
              const POSITION_SIZE_USDT = Number(process.env.POSITION_SIZE_USDT) || 50;
              const LEVERAGE = Number(process.env.LEVERAGE) || 10;

              let notional = POSITION_SIZE_USDT * LEVERAGE;
              if (notional < 105) notional = 105;
              
              const tradeAmount = await calculateSafeAmount(ccxtSymbol, entry, notional);
              const orderSide = signal === 'BUY' ? 'buy' : 'sell';

              await sendTelegramMessage(`🚨 *MULTI-STRATEGY SCANNER SIGNAL*\n${formattedMessage}`);

              await setLeverage(ccxtSymbol, LEVERAGE);
              await executeOrder(ccxtSymbol, 'limit', orderSide, tradeAmount, entry, [tp1, tp2], sl);
              
              broadcast('SYSTEM_LOG', { message: `Combined Scanner executed ${signal} on ${ccxtSymbol} at ${entry} (TP1: ${tp1.toFixed(4)}, TP2: ${tp2.toFixed(4)}, SL: ${sl.toFixed(4)}) - Match: ${strategiesMatched.length}/3` });

              try {
                  await TradeModel.create({
                      symbol: ccxtSymbol,
                      direction: signal === 'BUY' ? 'LONG' : 'SHORT',
                      entryPrice: entry,
                      amount: tradeAmount,
                      status: 'OPEN',
                      aiConfidence: strategiesMatched.length / 3,
                      aiSignal: { 
                          source: 'Combined Strategy Scanner',
                          matchedPillars: strategiesMatched,
                          confluenceScore: strategiesMatched.length
                      }
                  });
              } catch (dbErr) {
                  console.error('[MongoDB] Failed to save scanner trade entry:', dbErr);
              }

          } catch (execErr) {
              console.error('Execution failed for scanner signal:', execErr);
              await sendTelegramMessage(`❌ *EXECUTION FAILED for ${symbol}*\n${(execErr as Error)?.message}`);
          }
        }
      } else {
        lastSignals[signalKey] = 'NONE';
      }
    }
  } catch (error) {
    console.error('Background scanner error:', error);
  }
}

// Start background scanner
setInterval(runBackgroundScan, SCAN_INTERVAL);
setInterval(checkAndMoveStopLosses, 15000); // Check Breakeven every 15s
runBackgroundScan(); // Run initially

