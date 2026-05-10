import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Play, Loader2 } from 'lucide-react';

export function Backtest() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runBacktest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coin: 'BTC/USDT', timeframe: '1h' })
      });
      const data = await res.json();
      setResults(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <h2 className="text-2xl font-bold tracking-tight">Backtesting Engine</h2>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        
        {/* Settings Panel */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-neutral-500 uppercase">Strategy</label>
              <select className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500">
                <option>MA Crossover</option>
                <option>RSI Mean Reversion</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-neutral-500 uppercase">Pair</label>
              <select className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500">
                <option>BTC/USDT</option>
                <option>ETH/USDT</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-neutral-500 uppercase">Timeframe</label>
              <select className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500">
                <option>1h</option>
                <option>4h</option>
                <option>1d</option>
              </select>
            </div>
          </div>

          <button 
            onClick={runBacktest}
            disabled={loading}
            className="mt-auto w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-neutral-950 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {loading ? 'Running...' : 'Run Backtest'}
          </button>
        </div>

        {/* Results Area */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {results ? (
            <>
              {/* Metrics */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <div className="text-xs text-neutral-500 mb-1">Net Profit</div>
                  <div className="text-xl font-bold text-emerald-400">+{results.metrics.pnl}%</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <div className="text-xs text-neutral-500 mb-1">Win Rate</div>
                  <div className="text-xl font-bold">{results.metrics.winrate}%</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <div className="text-xs text-neutral-500 mb-1">Max Drawdown</div>
                  <div className="text-xl font-bold text-red-400">-{results.metrics.drawdown}%</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <div className="text-xs text-neutral-500 mb-1">Total Trades</div>
                  <div className="text-xl font-bold">{results.metrics.totalTrades}</div>
                </div>
              </div>

              {/* Chart */}
              <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl p-6 min-h-[300px]">
                <h3 className="text-sm font-medium text-neutral-400 mb-6">Equity Curve</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={results.equityCurve}>
                    <defs>
                      <linearGradient id="backtestEq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px' }}
                      itemStyle={{ color: '#a3a3a3' }}
                    />
                    <Area type="monotone" dataKey="equity" stroke="#3b82f6" fillOpacity={1} fill="url(#backtestEq)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-center text-neutral-500">
              Configure parameters and run backtest to see results.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
