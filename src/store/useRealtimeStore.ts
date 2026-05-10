import { create } from 'zustand';
import { toast } from 'sonner';
import { wsService } from '../services/websocket';

const playSound = (type: 'trade' | 'error' | 'alert') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (type === 'trade') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'error') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (e) {
    // Ignore audio context errs
  }
};

interface LogMessage {
  id: string;
  timestamp: string;
  level: 'INFO' | 'ERROR' | 'TRADE';
  message: string;
}

interface RealtimeState {
  wsConnected: boolean;
  botStatus: any;
  logs: LogMessage[];
  ordersUpdated: number;
  positionsUpdated: number;
  connect: () => void;
  disconnect: () => void;
}

let unsub: (() => void) | null = null;

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  wsConnected: false,
  botStatus: null,
  logs: [],
  ordersUpdated: 0,
  positionsUpdated: 0,
  
  connect: () => {
    wsService.connect(
      () => set({ wsConnected: true }),
      () => set({ wsConnected: false })
    );

    if (!unsub) {
      unsub = wsService.subscribe((data) => {
        if (data.type === 'BOT_STATUS') {
          set({ botStatus: data.payload });
        } else if (data.type === 'LOG') {
          const newLog = {
            id: Date.now().toString() + Math.random(),
            timestamp: new Date().toLocaleTimeString(),
            level: data.payload.level || 'INFO',
            message: data.payload.message
          };
          set(state => ({ 
            logs: [newLog, ...state.logs].slice(0, 100)
          }));
          
          if (newLog.level === 'ERROR') {
             toast.error(newLog.message);
             playSound('error');
          } else if (newLog.level === 'TRADE') {
             toast.success(newLog.message);
             playSound('trade');
          } else {
             if (data.payload.showToast) {
               toast.info(newLog.message);
             }
          }
        } else if (data.type === 'ORDER_CREATED' || data.type === 'ORDER_UPDATED') {
          set(state => ({ ordersUpdated: state.ordersUpdated + 1 }));
          window.dispatchEvent(new CustomEvent('orders_updated'));
        } else if (data.type === 'POSITIONS_UPDATED') {
          set(state => ({ positionsUpdated: state.positionsUpdated + 1 }));
          window.dispatchEvent(new CustomEvent('orders_updated'));
        }
      });
    }
  },
  
  disconnect: () => {
    wsService.disconnect();
    if (unsub) {
      unsub();
      unsub = null;
    }
  }
}));
