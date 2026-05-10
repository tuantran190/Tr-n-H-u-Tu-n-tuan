import ccxt, { Exchange } from 'ccxt';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.BINANCE_API_KEY || '';
const secret = process.env.BINANCE_API_SECRET || '';
const isTestnet = process.env.BINANCE_TESTNET !== 'false'; // default to true for safety

let exchange: Exchange | null = null;

if (apiKey && secret) {
    exchange = new ccxt.binance({
        apiKey: apiKey,
        secret: secret,
        enableRateLimit: true,
        options: {
            defaultType: 'future', // Use futures for LONG/SHORT
        }
    });

    if (isTestnet) {
        if (typeof (exchange as any).enableDemoTrading === 'function') {
            (exchange as any).enableDemoTrading(true);
            console.log('[CCXT] Connected to Binance Futures DEMO Trading');
        } else {
            exchange.setSandboxMode(true);
            console.log('[CCXT] Connected to Binance Futures TESTNET (Sandbox Mode)');
        }
    } else {
        console.warn('⚠️ [CCXT] DANGER: Connected to Binance Futures LIVE ⚠️');
    }
}

export const calculateSafeAmount = async (symbol: string, entryPrice: number, usdtAmount: number = 20) => {
    if (!exchange || !exchange.markets) {
        if (exchange) await exchange.loadMarkets();
    }
    if (!exchange) {
        // Fallback calculation for mock
        return Number((usdtAmount / entryPrice).toFixed(4));
    }
    
    try {
        const rawAmount = usdtAmount / entryPrice;
        const market = exchange.market(symbol);
        if (market) {
            return Number(exchange.amountToPrecision(symbol, rawAmount));
        }
    } catch (e) {
        console.error('Error fetching precision:', e);
    }
    return Number((usdtAmount / entryPrice).toFixed(4)); 
};

export const setLeverage = async (symbol: string, leverage: number) => {
    if (!exchange) return;
    try {
        await exchange.setLeverage(leverage, symbol);
        console.log(`[CCXT] Set leverage to ${leverage}x for ${symbol}`);
    } catch (error: any) {
        // Binance testnet might throw if we already set it to the same or not supported
        console.log(`[CCXT] Note: Could not set leverage to ${leverage}x for ${symbol} -`, error?.message || error);
    }
};

export const executeOrder = async (symbol: string, type: 'market' | 'limit', side: 'buy' | 'sell', amount: number, price?: number, tps?: number[], sl?: number) => {
    if (!exchange) {
        console.warn(`[CCXT Mock Execution] ${side} ${amount} ${symbol} at ${type} (CCXT API Keys missing in env)`);
        return {
            id: `mock_order_${Date.now()}`,
            symbol,
            type,
            side,
            amount,
            price: price || 0,
            status: 'closed',
            datetime: new Date().toISOString()
        };
    }

    try {
        console.log(`[CCXT] Executing ${side} ${amount} ${symbol} ...`);
        
        let order;
        let executionPrice = price;

        if (type === 'limit') {
            // "Mua: Đặt bằng giá Ask thấp nhất. Bán: Đặt bằng giá Bid cao nhất."
            const ticker = await exchange.fetchTicker(symbol);
            executionPrice = side === 'buy' ? ticker.ask : ticker.bid;
            
            // Nếu giá không hợp lệ, dùng giá truyền vào
            if (!executionPrice) executionPrice = price;
            
            order = await exchange.createOrder(symbol, 'limit', side, amount, executionPrice);
            console.log(`[CCXT] Limit order placed at ${executionPrice}:`, order.id);

            // Chờ 5 giây xem lệnh Limit có khớp không
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            try {
                const fetchedOrder = await exchange.fetchOrder(order.id, symbol);
                if (fetchedOrder.status === 'open' || fetchedOrder.status === 'canceled') {
                    console.log(`[CCXT] Limit order not fully filled after 5s. Canceling & falling back to Market...`);
                    try {
                        if (fetchedOrder.status === 'open') {
                             await exchange.cancelOrder(order.id, symbol);
                        }
                    } catch(e) {}
                    
                    const filled = fetchedOrder.filled || 0;
                    const remaining = amount - filled;
                    
                    if (remaining > 0) {
                        const market = exchange.market(symbol);
                        const remainingAmount = Number(exchange.amountToPrecision(symbol, remaining)) || remaining;
                        if (remainingAmount > 0) {
                            const marketOrder = await exchange.createOrder(symbol, 'market', side, remainingAmount);
                            order = marketOrder; 
                            console.log(`[CCXT] Fallback Market order placed for remaining ${remainingAmount}:`, marketOrder.id);
                        }
                    }
                } else {
                    console.log(`[CCXT] Limit order successfully filled:`, order.id);
                }
            } catch (fetchErr) {
                console.error(`[CCXT] Error polling limit order status, assuming open/missed.`, fetchErr);
            }
        } else {
            order = await exchange.createOrder(symbol, type, side, amount, price);
            console.log(`[CCXT] Market Order successful:`, order.id);
        }

        const inverseSide = side === 'buy' ? 'sell' : 'buy';
        
        if (sl) {
            try {
                await exchange.createOrder(symbol, 'stop_market', inverseSide, amount, undefined, {
                    stopPrice: parseFloat(sl.toFixed(4)),
                    closePosition: true
                });
                console.log(`[CCXT] SL placed successfully at ${sl}`);
            } catch (err: any) {
                console.error(`[CCXT] Failed to place SL at ${sl}:`, err?.message || err);
            }
        }

        if (tps && tps.length > 0) {
            if (!exchange.markets) await exchange.loadMarkets();
            const rawAmountPerTp = amount / tps.length;
            const amountPerTp = Number(exchange.amountToPrecision(symbol, rawAmountPerTp)) || rawAmountPerTp;

            for (const tp of tps) {
                try {
                    // Use LIMIT order for TP to reduce fees and avoid immediate trigger errors
                    await exchange.createOrder(symbol, 'limit', inverseSide, amountPerTp, parseFloat(tp.toFixed(4)), {
                        reduceOnly: true
                    });
                    console.log(`[CCXT] TP placed successfully at ${tp} for amount ${amountPerTp}`);
                } catch (err: any) {
                    console.error(`[CCXT] Failed to place TP at ${tp}:`, err?.message || err);
                }
            }
        }

        return order;
    } catch (error: any) {
        const isTestnetError = error && (String(error).includes('NotSupported') || String(error).includes('testnet/sandbox mode is not supported'));
        
        if (isTestnet && isTestnetError) {
            console.warn(`⚠️ [CCXT Mock] Binance Futures testnet execution unsupported. Generating mock order for DB.`);
            return {
                id: `mock_testnet_${Date.now()}`,
                symbol,
                type,
                side,
                amount,
                price: price || 0,
                status: 'closed',
                info: { mocked: true },
                datetime: new Date().toISOString()
            };
        }
        
        console.error('[CCXT] Execution failed:', error?.message || error);
        throw error;
    }
};

export const moveStopLossToEntry = async (symbol: string, entryPrice: number, side: 'buy' | 'sell', remainingAmount: number) => {
    if (!exchange) return;
    try {
        const inverseSide = side === 'buy' ? 'sell' : 'buy';
        
        // Lấy tất cả lệnh mở để tìm SL cũ
        const openOrders = await exchange.fetchOpenOrders(symbol);
        
        // Lệnh SL thường là stop_market
        const slOrders = openOrders.filter(o => o.type === 'stop_market' || o.type === 'stop');
        
        for (const slOrder of slOrders) {
            await exchange.cancelOrder(slOrder.id, symbol);
            console.log(`[CCXT] Canceled old SL: ${slOrder.id}`);
        }
        
        // Đặt SL mới tại Entry
        await exchange.createOrder(symbol, 'stop_market', inverseSide, remainingAmount || undefined, undefined, {
             stopPrice: parseFloat(entryPrice.toFixed(4)),
             closePosition: true
        });
        console.log(`[CCXT] Moved SL to breakeven at ${entryPrice} for ${symbol}`);
    } catch (e) {
        console.error(`[CCXT] Failed to move SL to entry for ${symbol}:`, e);
    }
};

let breakevenCache: Record<string, boolean> = {};

export const checkAndMoveStopLosses = async () => {
    if (!exchange) return;
    try {
        const positions = await exchange.fetchPositions();
        
        for (const position of positions) {
            const contracts = position.contracts || 0;
            if (contracts > 0) {
               const symbol = position.symbol;
               if (!breakevenCache[symbol]) {
                   const openOrders = await exchange.fetchOpenOrders(symbol);
                   const limitOrders = openOrders.filter(o => o.type === 'limit' && o.reduceOnly);
                   
                   // Nếu chỉ còn 1 TP (Limit), tức là TP1 đã bị khớp
                   if (limitOrders.length === 1) {
                       const slOrders = openOrders.filter(o => o.type === 'stop_market' || o.type === 'stop');
                       let slPriceDiff = 0;
                       
                       if (slOrders.length > 0) {
                           const slOrder = slOrders[0];
                           const slStopPrice = slOrder.stopPrice || (slOrder.info && slOrder.info.stopPrice) || 0;
                           const entryPrice = position.entryPrice || 0;
                           if (entryPrice > 0 && slStopPrice > 0) {
                               slPriceDiff = Math.abs(Number(slStopPrice) - Number(entryPrice)) / Number(entryPrice);
                           }
                       }
                       
                       // Cách entry đủ xa (ví dụ: > 0.2%) thì mới dời SL
                       if (slOrders.length > 0 && slPriceDiff > 0.002) {
                           console.log(`[CCXT] TP1 hit for ${symbol}, moving SL to Breakeven...`);
                           const entryPrice = position.entryPrice || 0;
                           const side = position.side === 'long' ? 'buy' : 'sell';
                           if (entryPrice > 0) {
                               await moveStopLossToEntry(symbol, entryPrice, side, contracts);
                               breakevenCache[symbol] = true;
                           }
                       }
                   }
               }
            } else {
               // Đã đóng vị thế, xóa cache
               if (breakevenCache[position.symbol]) {
                   delete breakevenCache[position.symbol];
               }
            }
        }
    } catch (e) {
        // Fallback im lặng nếu lỗi để tránh log rác
    }
}

export const fetchBalance = async () => {
   if (!exchange) return { free: 0, total: 0 };
   try {
       const balance = await exchange.fetchBalance();
       return balance;
   } catch (error) {
       console.error('[CCXT] Get balance failed:', error);
       return null;
   }
}
