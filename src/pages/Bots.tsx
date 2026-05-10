import { useState } from 'react';
import { Play, Square, Settings, Activity, AlertCircle, RefreshCw, ShieldAlert, Wallet, PieChart, History } from 'lucide-react';
import { cn } from '../lib/utils';

const MOCK_BOTS = [
  { id: 1, name: 'ETH Scalper α', strategy: 'AI + RSI', pair: 'ETH/USDT', status: 'running', pnl: '+4.2%', capital: '25%', allocated: '$12,500', uptime: '14d 2h', exchanges: ['Binance'] },
  { id: 2, name: 'BTC Mean Reversion', strategy: 'Bollinger Bounds', pair: 'BTC/USDT', status: 'running', pnl: '+1.8%', capital: '50%', allocated: '$25,000', uptime: '5d 12h', exchanges: ['Bybit'] },
  { id: 3, name: 'SOL Momentum', strategy: 'Trend Follow', pair: 'SOL/USDT', status: 'stopped', pnl: '-0.5%', capital: '25%', allocated: '$12,500', uptime: '-', exchanges: ['OKX'] },
];

export function Bots() {
  const [bots, setBots] = useState(MOCK_BOTS);
  const [isEmergencyHalted, setIsEmergencyHalted] = useState(false);

  const toggleBot = (id: number) => {
    setBots(bots.map(bot => {
      if (bot.id === id) {
        return { ...bot, status: bot.status === 'running' ? 'stopped' : 'running' };
      }
      return bot;
    }));
  };

  const handleEmergencyStop = () => {
    setIsEmergencyHalted(true);
    setBots(bots.map(bot => ({ ...bot, status: 'stopped' })));
  };

  return (
    <div className="h-full flex flex-col gap-6 w-full max-w-7xl mx-auto py-2">
      
      {/* Header & Global Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bot Fleet Command</h2>
          <p className="text-neutral-400 text-sm mt-1">Manage multiple automated engines and capital allocation.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-4 py-2 rounded-lg font-medium transition-colors text-sm flex items-center gap-2">
            <History className="w-4 h-4" /> Replay Mode
          </button>
          <button className="bg-emerald-500 hover:bg-emerald-600 text-neutral-950 px-4 py-2 rounded-lg font-medium transition-colors text-sm flex items-center gap-2">
            <Play className="w-4 h-4" /> Deploy New Bot
          </button>
          <button 
            onClick={handleEmergencyStop}
            className="bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:bg-red-600 text-white px-6 py-2 rounded-lg font-bold transition-colors text-sm flex items-center gap-2 uppercase tracking-wide ml-4"
          >
            <ShieldAlert className="w-4 h-4" /> Stop All
          </button>
        </div>
      </div>

      {isEmergencyHalted && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 animate-pulse">
          <ShieldAlert className="w-6 h-6" />
          <div>
             <div className="font-bold">SYSTEM HALTED</div>
             <div className="text-sm">Emergency STOP ALL triggered. All active orders cancelled. API keys locked for 5 minutes.</div>
          </div>
          <button onClick={() => setIsEmergencyHalted(false)} className="ml-auto px-4 py-2 bg-neutral-950 border border-red-500/30 rounded-lg text-sm font-bold text-red-500 hover:bg-red-500/10">RESET SHIELD</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0 flex-1">
        
        {/* Left Col: Capital Allocation */}
        <div className="flex flex-col gap-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col h-full">
             <div className="flex items-center gap-2 text-neutral-200 font-semibold mb-6">
               <PieChart className="w-5 h-5 text-indigo-400" /> Capital Allocation
             </div>
             
             <div className="flex-1 flex flex-col justify-center gap-6">
                <div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Total Capital</div>
                  <div className="text-4xl font-mono font-bold">$50,000</div>
                </div>

                <div className="space-y-4 w-full">
                  {bots.map(bot => (
                    <div key={bot.id} className="space-y-1.5">
                       <div className="flex justify-between items-center text-sm">
                         <span className="text-neutral-300 font-medium">{bot.name}</span>
                         <span className="font-mono text-neutral-400">{bot.allocated}</span>
                       </div>
                       <div className="h-2 bg-neutral-950 rounded-full overflow-hidden w-full relative group cursor-pointer">
                         <div 
                           className={cn("h-full rounded-full transition-all duration-500", bot.status === 'running' ? "bg-indigo-500" : "bg-neutral-700")} 
                           style={{ width: bot.capital }} 
                         />
                         <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                       </div>
                    </div>
                  ))}
                  
                  <div className="space-y-1.5 pt-2 border-t border-neutral-800">
                     <div className="flex justify-between items-center text-sm text-neutral-500">
                       <span>Unallocated Draft</span>
                       <span className="font-mono">$0.00</span>
                     </div>
                  </div>
                </div>
             </div>

             <button className="mt-6 w-full py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm font-medium text-neutral-400 hover:text-white transition-colors">
               AI Auto-Rebalance
             </button>
          </div>
        </div>

        {/* Right Col: Bot List */}
        <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto pr-2">
          {bots.map((bot) => (
            <div key={bot.id} className={cn(
               "bg-neutral-900 border rounded-xl p-5 flex items-center gap-6 transition-colors",
               bot.status === 'running' ? "border-neutral-700" : "border-neutral-800 opacity-60"
            )}>
              
              {/* Status Indicator */}
              <div className={cn(
                 "flex p-3 rounded-xl border transition-colors",
                 bot.status === 'running' 
                   ? "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]" 
                   : "bg-neutral-950 border-neutral-800"
              )}>
                 {bot.status === 'running' 
                  ? <Activity className="w-6 h-6 text-emerald-400" />
                  : <Square className="w-6 h-6 text-neutral-500" />
                 }
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-lg text-neutral-100">{bot.name}</h3>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                    bot.status === 'running' 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-neutral-800 text-neutral-400 border-neutral-700"
                  )}>
                    {bot.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-neutral-400 font-medium tracking-wide">
                  <span>{bot.strategy}</span>
                  <span className="text-neutral-700">•</span>
                  <span className="text-indigo-400">{bot.pair}</span>
                  <span className="text-neutral-700">•</span>
                  <span>{bot.exchanges.join(', ')}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-8 px-8 border-x border-neutral-800">
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1 uppercase tracking-wider font-bold">30d PnL</div>
                  <div className={cn(
                    "text-lg font-mono font-bold",
                    bot.pnl.startsWith('+') ? "text-emerald-400" : "text-red-400"
                  )}>
                    {bot.pnl}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1 uppercase tracking-wider font-bold">Uptime</div>
                  <div className="font-medium text-neutral-300 text-lg font-mono">{bot.uptime}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => toggleBot(bot.id)}
                  disabled={isEmergencyHalted}
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all border",
                    bot.status === 'running'
                      ? "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-red-400 hover:border-red-500/30"
                      : "bg-emerald-500 text-neutral-950 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:bg-emerald-400 disabled:opacity-50 disabled:shadow-none"
                  )}
                >
                  {bot.status === 'running' ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                </button>
                <button className="w-12 h-12 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 flex items-center justify-center transition-colors">
                  <Settings className="w-5 h-5" />
                </button>
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
