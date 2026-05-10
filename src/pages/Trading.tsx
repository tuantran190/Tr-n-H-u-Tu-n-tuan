import { useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useTradingStore } from '../store/useTradingStore';
import { useLayoutStore } from '../store/useLayoutStore';
import { useRealtimeStore } from '../store/useRealtimeStore';
import { ChartContainer } from '../components/ChartContainer';
import { BottomTerminal } from '../components/BottomTerminal';
import { AutoControlPanel } from '../components/AutoControlPanel';
import { StrategyBuilderPanel } from '../components/StrategyBuilderPanel';
import { AIChatPanel } from '../components/AIChatPanel';
import { TradingPanel } from '../components/TradingPanel';
import { GripHorizontal, GripVertical } from 'lucide-react';

export function Trading() {
  const symbol = useTradingStore(s => s.symbol);
  const setSymbol = useTradingStore(s => s.setSymbol);
  const timeframe = useTradingStore(s => s.timeframe);
  const setTimeframe = useTradingStore(s => s.setTimeframe);
  const indicators = useTradingStore(s => s.indicators);
  const toggleIndicator = useTradingStore(s => s.toggleIndicator);
  
  const sizes = useLayoutStore(s => s.sizes);
  const setSizes = useLayoutStore(s => s.setSizes);
  
  const connectRealtime = useRealtimeStore(s => s.connect);
  const disconnectRealtime = useRealtimeStore(s => s.disconnect);

  useEffect(() => {
    connectRealtime();
    return () => disconnectRealtime();
  }, [connectRealtime, disconnectRealtime]);

  return (
    <div className="h-full w-full bg-neutral-950 overflow-hidden p-1">
      <PanelGroup 
        direction="horizontal" 
        onLayout={(sizes) => setSizes('trading-main', sizes)}
        className="h-full w-full"
      >
        {/* Left Column: Chart & Bottom Panel */}
        <Panel defaultSize={sizes['trading-main']?.[0] || 75} minSize={30} className="flex flex-col min-w-0 h-full">
          <PanelGroup direction="vertical" onLayout={(s) => setSizes('trading-left-vertical', s)}>
            {/* Chart Area */}
            <Panel defaultSize={sizes['trading-left-vertical']?.[0] || 70} minSize={20} className="flex flex-col h-full bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
              {/* Top bar */}
              <div className="h-14 shrink-0 border-b border-neutral-800 flex items-center px-4 justify-between shadow-sm z-10 w-full overflow-x-auto">
                <div className="flex items-center gap-4">
                   <div className="font-bold text-lg">{symbol.replace('BINANCE:', '')}</div>
                   <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded text-sm overflow-hidden">
                      {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
                         <button 
                           key={tf}
                           onClick={() => setTimeframe(tf)}
                           className={`px-3 py-1 border-r border-neutral-800 last:border-0 ${
                             timeframe === tf 
                              ? 'bg-neutral-800 font-medium text-white' 
                              : 'hover:bg-neutral-800 text-neutral-400'
                           }`}
                         >
                           {tf}
                         </button>
                      ))}
                   </div>
                   <div className="h-4 w-px bg-neutral-800 mx-2" />
                   <div className="flex items-center gap-2">
                     <button
                       onClick={() => toggleIndicator('ema')}
                       className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                         indicators.ema ? 'bg-indigo-500/20 text-indigo-400' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
                       }`}
                     >
                       EMA
                     </button>
                     <button
                       onClick={() => toggleIndicator('rsi')}
                       className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                         indicators.rsi ? 'bg-amber-500/20 text-amber-400' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
                       }`}
                     >
                       RSI
                     </button>
                     <button
                       onClick={() => toggleIndicator('macd')}
                       className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                         indicators.macd ? 'bg-pink-500/20 text-pink-400' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
                       }`}
                     >
                       MACD
                     </button>
                   </div>
                </div>
                <div className="flex items-center gap-6 pr-2">
                   <div>
                     <div className="text-[10px] text-neutral-500 uppercase font-medium">24h Change</div>
                     <div className="text-sm font-bold text-emerald-400">+2.45%</div>
                   </div>
                   <div>
                     <div className="text-[10px] text-neutral-500 uppercase font-medium">24h High</div>
                     <div className="text-sm font-medium">66,800.00</div>
                   </div>
                   <div>
                     <div className="text-[10px] text-neutral-500 uppercase font-medium">24h Low</div>
                     <div className="text-sm font-medium">64,200.00</div>
                   </div>
                </div>
              </div>

              {/* Chart Viewport */}
              <div className="flex-1 min-h-0 relative group">
                 <ChartContainer />
                 {/* Smart Overlay */}
                 <div className="absolute top-4 left-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded shadow-lg backdrop-blur text-[10px] font-bold uppercase tracking-widest hidden group-hover:flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                   AI BUY ZONE
                 </div>
              </div>
            </Panel>

            <PanelResizeHandle className="h-2 flex items-center justify-center cursor-row-resize group mx-2">
              <div className="w-8 h-1 rounded-full bg-neutral-800 group-hover:bg-indigo-500/50 transition-colors" />
            </PanelResizeHandle>

            {/* Bottom Data Panel */}
            <Panel defaultSize={sizes['trading-left-vertical']?.[1] || 30} minSize={15} className="min-h-0 overflow-hidden">
              <PanelGroup direction="horizontal">
                <Panel defaultSize={60} minSize={30} className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
                   <BottomTerminal />
                </Panel>
                <PanelResizeHandle className="w-2 flex items-center justify-center cursor-col-resize group my-2">
                   <div className="h-8 w-1 rounded-full bg-neutral-800 group-hover:bg-indigo-500/50 transition-colors" />
                </PanelResizeHandle>
                <Panel defaultSize={40} minSize={20} className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
                   <AIChatPanel />
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="w-2 flex items-center justify-center cursor-col-resize group my-2">
           <div className="h-12 w-1 rounded-full bg-neutral-800 group-hover:bg-indigo-500/50 transition-colors" />
        </PanelResizeHandle>

        {/* Right Column: AI Auto Engine Panels */}
        <Panel defaultSize={sizes['trading-main']?.[1] || 25} minSize={20} maxSize={40} className="flex flex-col h-full min-w-0">
           <PanelGroup direction="vertical" onLayout={(s) => setSizes('trading-right-vertical', s)}>
             {/* System Control */}
             <Panel defaultSize={sizes['trading-right-vertical']?.[0] || 25} minSize={15} className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden shrink-0">
                <AutoControlPanel />
             </Panel>
             
             <PanelResizeHandle className="h-2 flex items-center justify-center cursor-row-resize group mx-2">
               <div className="w-8 h-1 rounded-full bg-neutral-800 group-hover:bg-indigo-500/50 transition-colors" />
             </PanelResizeHandle>

             {/* AI Core loop */}
             <Panel defaultSize={sizes['trading-right-vertical']?.[1] || 40} minSize={20} className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
                <StrategyBuilderPanel />
             </Panel>

             <PanelResizeHandle className="h-2 flex items-center justify-center cursor-row-resize group mx-2">
               <div className="w-8 h-1 rounded-full bg-neutral-800 group-hover:bg-indigo-500/50 transition-colors" />
             </PanelResizeHandle>

             {/* Auto-filled Action / Manual override */}
             <Panel defaultSize={sizes['trading-right-vertical']?.[2] || 35} minSize={20} className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
                <TradingPanel />
             </Panel>
           </PanelGroup>
        </Panel>

      </PanelGroup>
    </div>
  );
}
