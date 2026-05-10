import { create } from 'zustand';

interface TradingState {
  symbol: string;
  timeframe: string;
  indicators: {
    ema: boolean;
    rsi: boolean;
    macd: boolean;
  };
  highlightAction: 'BUY' | 'SELL' | null;
  suggestedPrice: number | null;
  suggestedSize: number | null;
  setSymbol: (s: string) => void;
  setTimeframe: (t: string) => void;
  toggleIndicator: (indicator: 'ema' | 'rsi' | 'macd') => void;
  setHighlightAction: (action: 'BUY' | 'SELL' | null, price?: number, size?: number) => void;
}

export const useTradingStore = create<TradingState>((set) => ({
  symbol: 'BINANCE:BTCUSDT',
  timeframe: '15m',
  indicators: {
    ema: true,
    rsi: false,
    macd: true,
  },
  highlightAction: null,
  suggestedPrice: null,
  suggestedSize: null,
  setSymbol: (symbol) => set({ symbol }),
  setTimeframe: (timeframe) => set({ timeframe }),
  toggleIndicator: (indicator) => set((state) => ({ 
    indicators: { ...state.indicators, [indicator]: !state.indicators[indicator] }
  })),
  setHighlightAction: (action, price, size) => set({ 
    highlightAction: action, 
    suggestedPrice: price || null, 
    suggestedSize: size || null 
  }),
}));
