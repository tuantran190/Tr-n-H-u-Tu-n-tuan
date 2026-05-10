import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Play, Square } from 'lucide-react';
import { useRealtimeStore } from '../store/useRealtimeStore';

import { tradingService } from '../services/tradingService';

export function BottomTerminal() {
  const [tab, setTab] = useState<'positions' | 'orders' | 'logs'>('positions');
  const [positions, setPositions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  
  const [logLevelFilter, setLogLevelFilter] = useState<'ALL' | 'INFO' | 'ERROR' | 'TRADE'>('ALL');
  const [searchLog, setSearchLog] = useState('');

  const botStatus = useRealtimeStore(s => s.botStatus);
  const logs = useRealtimeStore(s => s.logs);

  const filteredLogs = logs.filter(log => {
    if (logLevelFilter !== 'ALL' && log.level !== logLevelFilter) return false;
    if (searchLog && !log.message.toLowerCase().includes(searchLog.toLowerCase())) return false;
    return true;
  });

  const exportLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading_logs_${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchPositions = async () => {
    try {
      const data = await tradingService.getPositions();
      setPositions(data);
    } catch(err) {}
  };

  const fetchOrders = async () => {
    try {
       const data = await tradingService.getOrders();
       setOrders(data);
    } catch(err) {}
  }

  useEffect(() => {
    fetchPositions();
    fetchOrders();

    const handleUpdate = () => {
      fetchPositions();
      fetchOrders();
    };

    window.addEventListener('orders_updated', handleUpdate);
    // Periodically sync
    const interval = setInterval(handleUpdate, 5000);

    return () => {
      window.removeEventListener('orders_updated', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  const closePosition = async (id: string) => {
    try {
      await tradingService.closePosition(id);
      fetchPositions();
    } catch (e) { console.error(e) }
  };

  const cancelOrder = async (id: string) => {
    try {
      await tradingService.cancelOrder(id);
      fetchOrders();
    } catch (e) { console.error(e) }
  };

  return (
    <div className="h-full flex flex-col pt-1">
      <div className="flex border-b border-neutral-800 px-4 gap-6 text-sm font-medium shrink-0">
        {(['positions', 'orders', 'logs'] as const).map(t => (
          <button 
            key={t}
            onClick={() => setTab(t)}
            className={cn(
               "py-2 capitalize border-b-2 transition-colors",
               tab === t ? "border-emerald-500 text-emerald-400" : "border-transparent text-neutral-500 hover:text-neutral-300"
            )}
          >
            {t} ({t === 'positions' ? positions.length : t === 'orders' ? orders.filter(o=>o.status==='OPEN').length : logs.length})
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto bg-neutral-950/30">
        {tab === 'positions' && (
          <table className="w-full text-xs text-left">
            <thead className="text-neutral-500 uppercase sticky top-0 bg-neutral-900 border-b border-neutral-800">
              <tr>
                <th className="px-4 py-2 font-medium">Pair</th>
                <th className="px-4 py-2 font-medium">Side</th>
                <th className="px-4 py-2 font-medium text-right">Size</th>
                <th className="px-4 py-2 font-medium text-right">Entry</th>
                <th className="px-4 py-2 font-medium text-right">Mark</th>
                <th className="px-4 py-2 font-medium text-right">PnL (ROE)</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {positions.length > 0 ? positions.map(pos => (
                <tr key={pos.id} className="hover:bg-neutral-900/50 group">
                  <td className="px-4 py-2.5 font-medium">{pos.pair}</td>
                  <td className={cn("px-4 py-2.5 font-bold", pos.side === 'LONG' ? "text-emerald-400" : "text-red-400")}>{pos.side}</td>
                  <td className="px-4 py-2.5 font-mono text-right">{pos.size}</td>
                  <td className="px-4 py-2.5 font-mono text-right">{pos.entry}</td>
                  <td className="px-4 py-2.5 font-mono text-right">{pos.mark}</td>
                  <td className={cn("px-4 py-2.5 font-mono text-right font-medium", pos.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {pos.pnl >= 0 ? '+' : ''}{pos.pnl} ({(pos.pnl / (pos.size * pos.entry) * 100).toFixed(2)}%)
                  </td>
                  <td className="px-4 py-2.5 text-right">
                     <button onClick={() => closePosition(pos.id)} className="px-2 py-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded text-[10px] font-bold uppercase transition-colors">Close</button>
                  </td>
                </tr>
              )) : (
                <tr>
                   <td colSpan={7} className="text-center py-6 text-neutral-600">No open positions.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'orders' && (
          <table className="w-full text-xs text-left">
            <thead className="text-neutral-500 uppercase sticky top-0 bg-neutral-900 border-b border-neutral-800">
              <tr>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Pair</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Side</th>
                <th className="px-4 py-2 font-medium text-right">Price</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
                <th className="px-4 py-2 font-medium text-right">Status</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {orders.length > 0 ? orders.slice().reverse().map((order) => (
                <tr key={order.id} className="hover:bg-neutral-900/50 group">
                  <td className="px-4 py-2.5 font-mono text-neutral-400">{new Date(order.createdAt).toLocaleTimeString()}</td>
                  <td className="px-4 py-2.5 font-medium">{order.pair}</td>
                  <td className="px-4 py-2.5 font-medium">{order.type}</td>
                  <td className={cn("px-4 py-2.5 font-bold", order.side === 'BUY' ? 'text-emerald-400' : 'text-red-400')}>{order.side}</td>
                  <td className="px-4 py-2.5 font-mono text-right">{order.price ? order.price : 'Market'}</td>
                  <td className="px-4 py-2.5 font-mono text-right">{order.volume}</td>
                  <td className="px-4 py-2.5 font-medium text-right">
                    <span className={cn(order.status === 'FILLED' ? 'text-emerald-500' : order.status === 'CANCELED' ? 'text-neutral-500' : 'text-amber-500')}>{order.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                     {order.status === 'OPEN' && (
                       <button onClick={() => cancelOrder(order.id)} className="px-2 py-1 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white rounded text-[10px] font-bold uppercase transition-colors">Cancel</button>
                     )}
                  </td>
                </tr>
              )) : (
                <tr>
                   <td colSpan={8} className="text-center py-6 text-neutral-600">No order history.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'logs' && (
          <div className="flex flex-col h-full bg-neutral-950">
            <div className="flex items-center gap-4 px-4 py-2 border-b border-neutral-800 bg-neutral-900 shrink-0">
               <div className="flex gap-2">
                 {['ALL', 'INFO', 'TRADE', 'ERROR'].map(level => (
                   <button 
                     key={level}
                     onClick={() => setLogLevelFilter(level as any)}
                     className={cn("px-2 py-1 rounded text-[10px] font-bold tracking-wider", logLevelFilter === level ? 'bg-indigo-500 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700')}
                   >
                     {level}
                   </button>
                 ))}
               </div>
               <div className="flex-1">
                 <input 
                   type="text" 
                   placeholder="Search logs..." 
                   className="w-full max-w-sm bg-neutral-800 border border-neutral-700 rounded-md px-3 py-1.5 text-xs outline-none text-neutral-300 focus:border-indigo-500/50"
                   value={searchLog}
                   onChange={e => setSearchLog(e.target.value)}
                 />
               </div>
               <button 
                 onClick={exportLogs}
                 className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 rounded-md text-white transition-colors border border-neutral-700"
               >
                 Export TXT
               </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
               <div className="text-xs font-mono text-neutral-400 space-y-1">
                 {filteredLogs.length > 0 ? filteredLogs.map(log => (
                    <div key={log.id} className="flex gap-3 items-start group">
                       <span className="text-neutral-600 shrink-0 w-24">[{log.timestamp}]</span>
                       <span className={cn(
                          "shrink-0 w-12 font-bold",
                          log.level === 'INFO' ? "text-indigo-400" :
                          log.level === 'ERROR' ? "text-red-400" :
                          log.level === 'TRADE' ? "text-emerald-400" : "text-neutral-500"
                       )}>
                         {log.level}
                       </span>
                       <span className="text-neutral-300 group-hover:text-white transition-colors whitespace-pre-wrap">{log.message}</span>
                    </div>
                 )) : (
                    <div className="text-neutral-600 text-center py-4">No logs found.</div>
                 )}
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
