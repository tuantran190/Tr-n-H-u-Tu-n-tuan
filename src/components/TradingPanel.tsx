import { useState, useCallback } from 'react';
import { useTradingStore } from '../store/useTradingStore';
import { cn } from '../lib/utils';
import { Settings2, Loader2, Check } from 'lucide-react';

export function TradingPanel() {
  const symbol = useTradingStore((s) => s.symbol);
  const actionLine = useTradingStore((s) => s.highlightAction);
  const suggestedPrice = useTradingStore((s) => s.suggestedPrice);
  const suggestedSize = useTradingStore((s) => s.suggestedSize);
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [orderType, setOrderType] = useState<'MARKET'|'LIMIT'|'STOP'>('LIMIT');
  const [side, setSide] = useState<'BUY'|'SELL'>('BUY');
  const [price, setPrice] = useState(suggestedPrice?.toString() || '');
  const [volume, setVolume] = useState(suggestedSize?.toString() || '');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  // Sync suggestion with input if empty
  if (actionLine && side !== actionLine && !price && !volume) {
    setSide(actionLine);
    if (suggestedPrice) setPrice(suggestedPrice.toString());
    if (suggestedSize) setVolume(suggestedSize.toString());
  }

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      const res = await fetch('/api/trading/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair: symbol.replace('BINANCE:', ''),
          side,
          type: orderType,
          volume: Number(volume),
          price: orderType !== 'MARKET' ? Number(price) : undefined,
          stopLoss: stopLoss ? Number(stopLoss) : undefined,
          takeProfit: takeProfit ? Number(takeProfit) : undefined,
        })
      });
      if (!res.ok) throw new Error('Order failed');
      
      setExecuted(true);
      setTimeout(() => setExecuted(false), 2000);
      
      // Clear form optionally
      if (orderType === 'MARKET') setVolume('');
      
      // Dispatch an event to refresh orders
      window.dispatchEvent(new CustomEvent('orders_updated'));
    } catch (err) {
      console.error(err);
      alert('Order failed');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="h-full flex flex-col pt-3 pb-4">
      <div className="px-4 flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">Order Execution</h3>
        <button className="text-neutral-500 hover:text-neutral-300 transition-colors"><Settings2 className="w-4 h-4" /></button>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 space-y-5">
        
        {/* Order Types */}
        <div className="flex gap-1 p-1 bg-neutral-950 rounded-lg">
          <button onClick={() => setOrderType('MARKET')} className={cn("flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm", orderType === 'MARKET' ? 'bg-neutral-800 text-neutral-200' : 'text-neutral-400 hover:bg-neutral-800')}>Market</button>
          <button onClick={() => setOrderType('LIMIT')} className={cn("flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm", orderType === 'LIMIT' ? 'bg-neutral-800 text-neutral-200' : 'text-neutral-400 hover:bg-neutral-800')}>Limit</button>
          <button onClick={() => setOrderType('STOP')} className={cn("flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm", orderType === 'STOP' ? 'bg-neutral-800 text-neutral-200' : 'text-neutral-400 hover:bg-neutral-800')}>Stop</button>
        </div>

        {/* Action Toggle */}
        <div className="flex gap-1 p-1">
          <button onClick={() => setSide('BUY')} className={cn("flex-1 py-2 rounded-md font-bold uppercase tracking-wider transition-colors text-xs border", side === 'BUY' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-neutral-900 border-neutral-800 text-neutral-500')}>Buy</button>
          <button onClick={() => setSide('SELL')} className={cn("flex-1 py-2 rounded-md font-bold uppercase tracking-wider transition-colors text-xs border", side === 'SELL' ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-neutral-900 border-neutral-800 text-neutral-500')}>Sell</button>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          {orderType !== 'MARKET' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-neutral-400 font-medium">
                <label>{orderType === 'LIMIT' ? 'Limit Price' : 'Stop Price'} (USDT)</label>
                <span className="text-neutral-500">Best Bid/Ask</span>
              </div>
              <input 
                type="number" 
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono text-neutral-200 outline-none transition-all placeholder:text-neutral-700 focus:border-indigo-500/50"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-neutral-400 font-medium">
              <label>Volume</label>
              <span className="text-neutral-500 cursor-pointer hover:underline text-[10px] uppercase font-bold tracking-wider">Max: 100.00</span>
            </div>
            <input 
              type="number" 
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono text-neutral-200 outline-none transition-all placeholder:text-neutral-700 focus:border-indigo-500/50"
              placeholder="0.00"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1.5">
                <div className="text-xs text-neutral-400 font-medium">Take Profit</div>
                <input 
                  type="number" 
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono text-neutral-200 outline-none transition-all placeholder:text-neutral-700 focus:border-emerald-500/50 focus:bg-emerald-500/5"
                  placeholder="0.00"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                />
             </div>
             <div className="space-y-1.5">
                <div className="text-xs text-neutral-400 font-medium">Stop Loss</div>
                <input 
                  type="number" 
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono text-neutral-200 outline-none transition-all placeholder:text-neutral-700 focus:border-red-500/50 focus:bg-red-500/5"
                  placeholder="0.00"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                />
             </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4">
          <button 
            onClick={handleExecute}
            disabled={isExecuting || executed || !volume || (orderType !== 'MARKET' && !price)}
            className={cn(
              "w-full py-3.5 rounded-lg font-bold text-sm tracking-widest uppercase transition-all flex justify-center items-center gap-2",
              executed ? "bg-indigo-500 text-white" :
              side === 'BUY' 
                ? "bg-emerald-500 text-neutral-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:bg-emerald-400 disabled:opacity-50 disabled:shadow-none" 
                : "bg-red-500 text-neutral-950 shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:bg-red-400 disabled:opacity-50 disabled:shadow-none" 
            )}
          >
            {isExecuting ? <Loader2 className="w-5 h-5 animate-spin" /> : executed ? <><Check className="w-5 h-5" /> ORDER PLACED</> : `${side} ${symbol.replace('BINANCE:', '')}`}
          </button>
        </div>
        
        {/* Account Info summary */}
        <div className="border-t border-neutral-800 pt-4 mt-2 space-y-2 text-xs">
          <div className="flex justify-between text-neutral-500 font-medium uppercase tracking-wider text-[10px]">
            <span>Required Margin</span>
            <span className="font-mono text-neutral-300">{Number(volume) > 0 ? (Number(volume) * (Number(price) || 65000) * 0.1).toFixed(2) : '0.00'} USDT</span>
          </div>
          <div className="flex justify-between text-neutral-500 font-medium uppercase tracking-wider text-[10px]">
            <span>Available Balance</span>
            <span className="font-mono text-neutral-300">12,450.00 USDT</span>
          </div>
        </div>
      </div>
    </div>
  );
}
