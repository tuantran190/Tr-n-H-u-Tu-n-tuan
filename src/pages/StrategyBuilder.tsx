import { useState } from 'react';
import { Plus, X, ArrowRight, Play, Server, Code2 } from 'lucide-react';

export function StrategyBuilder() {
  const [mode, setMode] = useState<'visual' | 'code'>('visual');

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Strategy Builder</h2>
        <div className="flex gap-3">
          <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-1 mr-4">
             <button
               onClick={() => setMode('visual')}
               className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${mode === 'visual' ? 'bg-indigo-500/20 text-indigo-400' : 'text-neutral-500 hover:text-neutral-300'}`}
             >
               VISUAL RULES
             </button>
             <button
               onClick={() => setMode('code')}
               className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${mode === 'code' ? 'bg-indigo-500/20 text-indigo-400' : 'text-neutral-500 hover:text-neutral-300'}`}
             >
               PYTHON CODE
             </button>
          </div>
          <button className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-sm font-medium rounded-lg transition-colors">
            Load Template
          </button>
          <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors">
            Deploy to Auto Engine
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        {/* Editor Area */}
        <div className="lg:col-span-3 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
          {mode === 'code' ? (
            <>
              <div className="px-4 py-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-400">strategy.py</span>
                <Code2 className="w-4 h-4 text-neutral-500"/>
              </div>
              <div className="flex-1 p-4 font-mono text-sm text-neutral-300 overflow-auto bg-[#0d0d0d]">
                <pre><code>{`import backtrader as bt

class AI_Rule_Strategy(bt.Strategy):
    def __init__(self):
        self.rsi = bt.ind.RSI(period=14)
        
    def next(self):
        ai_confidence = self.get_ai_confidence()
        
        # Rule 1
        if self.rsi[0] < 30 and ai_confidence > 80:
            if not self.position:
                self.buy()
                
        # Rule 2
        elif self.position:
            profit = (self.data.close[0] - self.position.price) / self.position.price
            if profit > 0.05:
                self.sell()
`}</code></pre>
              </div>
            </>
          ) : (
            <div className="flex-1 p-8 bg-[#0d0d0d] overflow-y-auto pattern-dots pattern-neutral-800 pattern-bg-transparent pattern-size-4 opacity-100 flex flex-col gap-6">
               <h3 className="font-medium text-neutral-400 flex items-center gap-2 mb-2"><Server className="w-5 h-5"/> Logic Flow</h3>
               
               {/* Rule Block 1 */}
               <div className="bg-neutral-900/90 border border-indigo-500/30 rounded-xl p-5 shadow-lg backdrop-blur-sm max-w-2xl relative">
                  <div className="absolute top-4 right-4 text-neutral-500 hover:text-red-400 cursor-pointer"><X className="w-4 h-4" /></div>
                  <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">Rule 1 (Entry)</div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                     <span className="px-3 py-1.5 bg-neutral-800 rounded font-mono text-xs text-neutral-300 font-bold border border-neutral-700">IF</span>
                     
                     <div className="flex items-center gap-2 bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800">
                        <select className="bg-transparent text-sm text-neutral-200 outline-none"><option>RSI (14)</option></select>
                        <select className="bg-transparent text-sm text-emerald-400 outline-none"><option>&lt;</option></select>
                        <input className="w-12 bg-transparent text-sm text-neutral-200 outline-none text-center" defaultValue="30" />
                     </div>

                     <span className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded font-mono text-xs font-bold border border-indigo-500/20">AND</span>

                     <div className="flex items-center gap-2 bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800">
                        <select className="bg-transparent text-sm text-indigo-300 outline-none"><option>AI_Confidence</option></select>
                        <select className="bg-transparent text-sm text-emerald-400 outline-none"><option>&gt;</option></select>
                        <input className="w-12 bg-transparent text-sm text-neutral-200 outline-none text-center" defaultValue="80%" />
                     </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                     <span className="px-3 py-1.5 bg-neutral-800 rounded font-mono text-xs text-neutral-300 font-bold border border-neutral-700">THEN</span>
                     
                     <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                        <select className="bg-transparent text-sm text-emerald-400 font-bold outline-none"><option>EXECUTE BUY</option></select>
                     </div>
                     <span className="text-neutral-500 text-sm">with current Risk Limit.</span>
                  </div>
               </div>

               {/* Add connector */}
               <div className="w-0.5 h-6 bg-neutral-800 ml-8" />

               {/* Rule Block 2 */}
               <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 shadow-lg backdrop-blur-sm max-w-2xl relative">
                  <div className="absolute top-4 right-4 text-neutral-500 hover:text-red-400 cursor-pointer"><X className="w-4 h-4" /></div>
                  <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Rule 2 (Exit)</div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                     <span className="px-3 py-1.5 bg-neutral-800 rounded font-mono text-xs text-neutral-300 font-bold border border-neutral-700">IF</span>
                     
                     <div className="flex items-center gap-2 bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800">
                        <select className="bg-transparent text-sm text-neutral-200 outline-none"><option>Position Profit</option></select>
                        <select className="bg-transparent text-sm text-emerald-400 outline-none"><option>&gt;</option></select>
                        <input className="w-12 bg-transparent text-sm text-neutral-200 outline-none text-center" defaultValue="5%" />
                     </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                     <span className="px-3 py-1.5 bg-neutral-800 rounded font-mono text-xs text-neutral-300 font-bold border border-neutral-700">THEN</span>
                     
                     <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">
                        <select className="bg-transparent text-sm text-red-400 font-bold outline-none"><option>EXECUTE SELL (Close)</option></select>
                     </div>
                  </div>
               </div>

               {/* Add Rule Button */}
               <div className="mt-2">
                  <button className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-neutral-800 text-neutral-500 hover:border-indigo-500/50 hover:text-indigo-400 rounded-xl font-medium transition-colors max-w-2xl w-full justify-center">
                    <Plus className="w-4 h-4" /> Add Rule
                  </button>
               </div>
            </div>
          )}
        </div>

        {/* Strategy Settings */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col gap-6 overflow-y-auto">
          <div>
            <h3 className="font-medium mb-4">Configuration</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-neutral-500 uppercase font-medium tracking-wider">Strategy Name</label>
                <input 
                  type="text" 
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 font-medium"
                  defaultValue="Trend + AI Confidence"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-neutral-500 uppercase font-medium tracking-wider">Framework</label>
                <select className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-neutral-300">
                  <option>Auto Engine Runtime v2</option>
                  <option>Backtrader Export</option>
                  <option>CCXT Export</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-4">Data Feeds</h3>
             <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                <span className="text-sm text-neutral-300 flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full"/> Market Data</span>
                <span className="text-xs px-2 py-0.5 bg-neutral-800 rounded text-neutral-400 font-mono">1m, 15m, 1h</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-800">
                <span className="text-sm text-neutral-300 flex items-center gap-2"><div className="w-2 h-2 bg-indigo-500 rounded-full"/> AI Vision Core</span>
                <span className="text-xs px-2 py-0.5 bg-neutral-800 rounded text-neutral-400 font-mono">Connected</span>
              </div>
            </div>
          </div>
          
          <button className="mt-auto px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
            <Play className="w-4 h-4"/> Test Logic in Backtester
          </button>
        </div>
      </div>
    </div>
  );
}
