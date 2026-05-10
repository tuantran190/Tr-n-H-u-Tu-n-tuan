import { useState, useEffect } from 'react';
import { Power, Settings2, Cpu, ShieldAlert, Activity, DollarSign } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTradingStore } from '../store/useTradingStore'; // use it if we want to sync symbol optionally
import { useRealtimeStore } from '../store/useRealtimeStore';
import { tradingService } from '../services/tradingService';

export function AutoControlPanel() {
  const realtimeBotState = useRealtimeStore(s => s.botStatus);
  const [isPanelOpen, setIsPanelOpen] = useState(false); // for settings
  
  // Form State
  const [strategy, setStrategy] = useState('MACD Crossover');
  const [risk, setRisk] = useState('2');
  const [capital, setCapital] = useState('1000');
  const [timeframe, setTimeframe] = useState('15m');

  const fetchStatus = async () => {
    try {
      const data = await tradingService.getBotStatus();
      if (!realtimeBotState && data.config) {
        setStrategy(data.config.strategy);
        setRisk(data.config.risk.toString());
        setCapital(data.config.capital.toString());
        setTimeframe(data.config.timeframe);
      }
    } catch(err) {
      console.error('Failed to fetch bot status', err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (realtimeBotState) {
        setStrategy(realtimeBotState.config.strategy);
        setRisk(realtimeBotState.config.risk.toString());
        setCapital(realtimeBotState.config.capital.toString());
        setTimeframe(realtimeBotState.config.timeframe);
    }
  }, [realtimeBotState]);

  const handleStart = async () => {
    try {
      await tradingService.startBot({
        strategy,
        risk: Number(risk),
        capital: Number(capital),
        timeframe
      });
    } catch(err) {
      console.error(err);
    }
  };

  const handleStop = async () => {
    try {
      await tradingService.stopBot();
    } catch(err) {
      console.error(err);
    }
  };

  const isRunning = realtimeBotState?.isRunning || false;

  return (
    <div className="flex flex-col h-full bg-neutral-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Cpu className={cn("w-4 h-4", isRunning ? "text-emerald-400" : "text-neutral-500")} />
          Bot Control Base
        </h3>
        <button 
          onClick={() => setIsPanelOpen(!isPanelOpen)} 
          className={cn("transition-colors", isPanelOpen ? "text-white" : "text-neutral-500 hover:text-neutral-300")}
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 flex-col flex overflow-y-auto h-full space-y-4">
        {/* Status Area */}
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg p-3">
             <div className="text-[10px] text-neutral-500 uppercase font-medium mb-1">Status</div>
             <div className="flex items-center gap-2">
               <div className={cn("w-2 h-2 rounded-full", isRunning ? "bg-emerald-500 animate-pulse" : "bg-neutral-600")} />
               <span className={cn("font-bold text-sm", isRunning ? "text-emerald-400" : "text-neutral-400")}>
                 {isRunning ? 'RUNNING' : 'STOPPED'}
               </span>
             </div>
          </div>
          <div className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg p-3">
             <div className="text-[10px] text-neutral-500 uppercase font-medium mb-1">Active Orders</div>
             <div className="font-bold text-sm text-neutral-200">
               {realtimeBotState?.activeOrders || 0}
             </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="grid grid-cols-2 gap-2">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="col-span-2 py-3 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 bg-emerald-500 text-neutral-950 hover:bg-emerald-600 border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
            >
              <Power className="w-4 h-4" />
              START TRADING BOT
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="col-span-2 py-3 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all"
            >
              <ShieldAlert className="w-4 h-4" />
              STOP TRADING BOT
            </button>
          )}
        </div>

        {/* Configuration Form */}
        <div className="flex flex-col space-y-3 pt-2">
           <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-2">
             <Settings2 className="w-3.5 h-3.5" />
             Configuration {isRunning && <span className="text-amber-500 text-[10px]">(Locked while running)</span>}
           </div>

           <div className="space-y-1.5">
             <label className="text-[10px] text-neutral-500 uppercase font-medium">Strategy</label>
             <select 
               className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 outline-none focus:border-indigo-500/50"
               value={strategy}
               onChange={e => setStrategy(e.target.value)}
               disabled={isRunning}
             >
               <option value="MACD Crossover">MACD Crossover</option>
               <option value="RSI Mean Reversion">RSI Mean Reversion</option>
               <option value="Grid Trading">Grid Trading</option>
             </select>
           </div>

           <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1.5">
               <label className="text-[10px] text-neutral-500 uppercase font-medium">Capital (USDT)</label>
               <div className="relative">
                 <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                 <input 
                   type="number"
                   className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-3 py-2 text-sm text-neutral-200 outline-none focus:border-indigo-500/50"
                   value={capital}
                   onChange={e => setCapital(e.target.value)}
                   disabled={isRunning}
                 />
               </div>
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] text-neutral-500 uppercase font-medium">Risk per Trade (%)</label>
               <div className="relative">
                 <Activity className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                 <input 
                   type="number"
                   className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-3 py-2 text-sm text-neutral-200 outline-none focus:border-indigo-500/50"
                   value={risk}
                   onChange={e => setRisk(e.target.value)}
                   disabled={isRunning}
                 />
               </div>
             </div>
           </div>

           <div className="space-y-1.5">
             <label className="text-[10px] text-neutral-500 uppercase font-medium">Timeframe</label>
             <select 
               className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 outline-none focus:border-indigo-500/50"
               value={timeframe}
               onChange={e => setTimeframe(e.target.value)}
               disabled={isRunning}
             >
               <option value="1m">1 minute</option>
               <option value="5m">5 minutes</option>
               <option value="15m">15 minutes</option>
               <option value="1h">1 hour</option>
               <option value="4h">4 hours</option>
             </select>
           </div>
        </div>
      </div>
    </div>
  );
}

