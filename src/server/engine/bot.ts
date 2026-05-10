import { marketEvents } from '../ws';
import { stateManager, PositionState } from './state';
import { executeOrder } from './ccxt-executor';
import { sendTelegramMessage } from './telegram';
import { broadcast } from '../ws';
import { TradeModel } from '../db/models/Trade';

const SYMBOL = 'BTC/USDT'; // Use standard ccxt symbol format
const ASSET = 'BTCUSDT';  // Binance WS / state format
const TRADE_AMOUNT = 0.001; // BTC

const STRATEGY_PERIOD = 34; // Needs more prices for EMA 34
const prices: number[] = [];

// AI Brain - Simulate the ML models trained previously
function getTradingPrediction(prices: number[], currentPrice: number) {
    // 1. Calculate EMA 34 (simplified)
    const k = 2 / (34 + 1);
    let ema34 = prices[0];
    for (let i = 1; i < prices.length; i++) {
        ema34 = (prices[i] * k) + (ema34 * (1 - k));
    }

    // 2. Market Structure / Price Action
    const maxRecent = Math.max(...prices.slice(-10));
    const minRecent = Math.min(...prices.slice(-10));
    
    let paTrend = 'SIDEWAYS';
    if (currentPrice > maxRecent * 0.999) paTrend = 'BULLISH';
    if (currentPrice < minRecent * 1.001) paTrend = 'BEARISH';
    
    let emaTrend = 'SIDEWAYS';
    if (currentPrice > ema34 * 1.0005) emaTrend = 'BULLISH';
    if (currentPrice < ema34 * 0.9995) emaTrend = 'BEARISH';

    // Simulate AI Model Probability output
    let prob_up = 50;
    let prob_down = 50;
    let confidence = 0.5;

    if (emaTrend === 'BULLISH' && paTrend === 'BULLISH') {
        prob_up = 75 + Math.random() * 10;
        prob_down = 100 - prob_up;
        confidence = 0.85;
    } else if (emaTrend === 'BEARISH' && paTrend === 'BEARISH') {
        prob_down = 75 + Math.random() * 10;
        prob_up = 100 - prob_down;
        confidence = 0.85;
    }

    // Regime and Risk Check (Hedge Fund AI System simulation)
    const market_regime = (paTrend !== 'SIDEWAYS') ? 'TREND' : 'SIDEWAYS';
    const risk_status = 'allowed'; // Assume risk engine allows

    let signal: 'BUY' | 'SELL' | 'NO_TRADE' = 'NO_TRADE';
    if (market_regime === 'TREND' && risk_status === 'allowed') {
         if (prob_up > 65) signal = 'BUY';
         if (prob_down > 65) signal = 'SELL';
    }

    return {
        signal,
        confidence,
        ema34,
        prob_up,
        prob_down
    };
}

export function startBotEngine() {
    marketEvents.on('tick', async (payload: { symbol: string, price: number, time: number }) => {
        if (payload.symbol !== ASSET) return;
        
        const price = payload.price;
        
        // Push to buffer
        prices.push(price);
        if (prices.length > STRATEGY_PERIOD * 2) {
            prices.shift();
        }
        
        // Wait until we have enough data for EMA
        if (prices.length >= STRATEGY_PERIOD) {
             const state = stateManager.getSymbolState(ASSET);
             
             // Run AI Prediction
             const aiDecision = getTradingPrediction(prices, price);
             
             // Output to system logs occasionally or specifically when threshold reached
             // broadcast('SYSTEM_LOG', { message: `AI Stats - UP: ${aiDecision.prob_up.toFixed(1)}%, DOWN: ${aiDecision.prob_down.toFixed(1)}%, EMA34: ${aiDecision.ema34.toFixed(2)}` });

             if (state.status === PositionState.FLAT) {
                  if (aiDecision.signal === 'BUY') {
                      await triggerTrade(PositionState.LONG, price, aiDecision);
                  } else if (aiDecision.signal === 'SELL') {
                      await triggerTrade(PositionState.SHORT, price, aiDecision);
                  }
             } else if (state.status === PositionState.LONG) {
                  // Exit if strong bear signal
                  if (aiDecision.signal === 'SELL') {
                      await closeTrade('sell', price, aiDecision);
                  }
             } else if (state.status === PositionState.SHORT) {
                  // Exit if strong bull signal
                  if (aiDecision.signal === 'BUY') {
                      await closeTrade('buy', price, aiDecision);
                  }
             }
        }
    });
}

async function triggerTrade(direction: PositionState.LONG | PositionState.SHORT, price: number, aiRef: any) {
    const side = direction === PositionState.LONG ? 'buy' : 'sell';
    
    // 1. Alert Telegram with ML stats
    await sendTelegramMessage(`🚨 *AI SIGNAL ALERT*\nSymbol: ${SYMBOL}\nDirection: *${direction}*\nPrice: ${price}\nConfidence: ${aiRef.confidence.toFixed(2)}\nProb UP: ${aiRef.prob_up.toFixed(1)}% | Prob DOWN: ${aiRef.prob_down.toFixed(1)}%`);
    
    // 2. State update
    stateManager.openPosition(ASSET, direction, price, TRADE_AMOUNT, price * 0.95, price * 1.05);

    // 3. Execution
    try {
       await executeOrder(SYMBOL, 'market', side as any, TRADE_AMOUNT);
       broadcast('SYSTEM_LOG', { message: `AI triggered ${direction} on ${SYMBOL} at ${price} (Confidence: ${aiRef.confidence.toFixed(2)})` });
       
       // 4. Save to DB
       try {
           await TradeModel.create({
               symbol: SYMBOL,
               direction: direction,
               entryPrice: price,
               amount: TRADE_AMOUNT,
               status: 'OPEN',
               aiConfidence: aiRef.confidence,
               aiSignal: aiRef
           });
       } catch (dbErr) {
           console.error('[MongoDB] Failed to save trade entry:', dbErr);
       }

    } catch(e) {
       // Rollback state if execution failed
       stateManager.closePosition(ASSET);
       await sendTelegramMessage(`❌ *EXECUTION FAILED*\nCould not execute ${side} for ${SYMBOL}`);
    }
}

async function closeTrade(side: 'buy' | 'sell', price: number, aiRef: any) {
     const state = stateManager.getSymbolState(ASSET);
     if (!state.entryPrice) return;
     
     const pr = state.entryPrice;
     const profit = side === 'sell' ? (price - pr) : (pr - price);
     
     // 1. State update
     stateManager.closePosition(ASSET);
     
     // 2. Alert
     await sendTelegramMessage(`✅ *AI POSITION CLOSED*\nSymbol: ${SYMBOL}\nClose Price: ${price}\nEst PnL: ${profit.toFixed(2)}\nReason: Model signal flip (Prob UP: ${aiRef.prob_up.toFixed(1)}%)`);

     // 3. Execution
     try {
       await executeOrder(SYMBOL, 'market', side, TRADE_AMOUNT);
       broadcast('SYSTEM_LOG', { message: `AI closed position on ${SYMBOL} at ${price}` });

       // 4. Save to DB
       try {
           const dbTrade = await TradeModel.findOne({ symbol: SYMBOL, status: 'OPEN' }).sort({ createdAt: -1 });
           if (dbTrade) {
               dbTrade.status = 'CLOSED';
               dbTrade.exitPrice = price;
               dbTrade.profit = profit;
               dbTrade.closedAt = new Date();
               await dbTrade.save();
           }
       } catch (dbErr) {
           console.error('[MongoDB] Failed to save trade exit:', dbErr);
       }
       
     } catch(e) {
       await sendTelegramMessage(`❌ *EXECUTION FAILED*\nCould not close position for ${SYMBOL}`);
     }
}
