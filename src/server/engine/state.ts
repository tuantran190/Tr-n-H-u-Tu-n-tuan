export enum PositionState {
  FLAT = 'FLAT',
  LONG = 'LONG',
  SHORT = 'SHORT'
}

interface TradeState {
  status: PositionState;
  entryPrice: number | null;
  quantity: number | null;
  symbol: string;
  openedAt: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
}

class TradeStateManager {
  private static instance: TradeStateManager;
  private state: Map<string, TradeState> = new Map();

  private constructor() {}

  public static getInstance(): TradeStateManager {
    if (!TradeStateManager.instance) {
      TradeStateManager.instance = new TradeStateManager();
    }
    return TradeStateManager.instance;
  }

  public getSymbolState(symbol: string): TradeState {
    if (!this.state.has(symbol)) {
      this.state.set(symbol, {
        status: PositionState.FLAT,
        entryPrice: null,
        quantity: null,
        symbol,
        openedAt: null,
        stopLoss: null,
        takeProfit: null
      });
    }
    return this.state.get(symbol)!;
  }

  public openPosition(symbol: string, direction: PositionState.LONG | PositionState.SHORT, price: number, quantity: number, sl: number, tp: number) {
    const s = this.getSymbolState(symbol);
    if (s.status !== PositionState.FLAT) {
        throw new Error(`Cannot open position. Already ${s.status} on ${symbol}`);
    }
    s.status = direction;
    s.entryPrice = price;
    s.quantity = quantity;
    s.openedAt = Date.now();
    s.stopLoss = sl;
    s.takeProfit = tp;
  }

  public closePosition(symbol: string) {
    const s = this.getSymbolState(symbol);
    s.status = PositionState.FLAT;
    s.entryPrice = null;
    s.quantity = null;
    s.openedAt = null;
    s.stopLoss = null;
    s.takeProfit = null;
  }
}

export const stateManager = TradeStateManager.getInstance();
