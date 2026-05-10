import { apiService } from './api';

export const tradingService = {
  getBotStatus() {
    return apiService.get<any>('/api/trading/bot/status', { silent: true });
  },
  startBot(config: any) {
     return apiService.post<any>('/api/trading/bot/start', { config });
  },
  stopBot() {
     return apiService.post<any>('/api/trading/bot/stop');
  },
  getPositions() {
     return apiService.get<any>('/api/trading/positions');
  },
  getOrders() {
     return apiService.get<any>('/api/trading/orders');
  },
  placeOrder(order: any) {
     return apiService.post<any>('/api/trading/order', order);
  },
  cancelOrder(id: string) {
     return apiService.delete<any>(`/api/trading/order/${id}`);
  },
  closePosition(id: string) {
     return apiService.delete<any>(`/api/trading/position/${id}`);
  },
  getHistory(symbol: string, timeframe: string) {
     return apiService.get<any>(`/api/trading/history?symbol=${symbol}&timeframe=${timeframe}`);
  },
  scan(symbols: string[], timeframe: string) {
     return apiService.post<any>(`/api/trading/scan`, { symbols, timeframe });
  },
  analyze(candles: any[], ema34?: any[], ema89?: any[], ema200?: any[]) {
     return apiService.post<any>(`/api/trading/analyze`, { candles, ema34, ema89, ema200 });
  },
  pullback(candles: any[], trend: string, ema34?: any[], ema89?: any[], ema200?: any[]) {
     return apiService.post<any>(`/api/trading/pullback`, { candles, trend, ema34, ema89, ema200 });
  },
  priceAction(candles: any[], emaZoneValue?: number) {
     return apiService.post<any>(`/api/trading/price-action`, { candles, emaZoneValue });
  },
  marketFilter(candles: any[], ema34?: any[], ema89?: any[]) {
     return apiService.post<any>(`/api/trading/filter`, { candles, ema34, ema89 });
  },
  score(trend: string, pullback_valid: boolean, pa_signal: string | null, market_valid: boolean, ema34?: any[], ema89?: any[], ema200?: any[]) {
     return apiService.post<any>(`/api/trading/score`, { trend, pullback_valid, pa_signal, market_valid, ema34, ema89, ema200 });
  },
  decision(trend: string, pullback_valid: boolean, pa_signal: string | null, is_valid_market: boolean, score: number, current_price: number, ema89_val: number) {
     return apiService.post<any>(`/api/trading/decision`, { trend, pullback_valid, pa_signal, is_valid_market, score, current_price, ema89_val });
  },
  mtfAnalyze(h1: any, m15: any, m5: any) {
     return apiService.post<any>(`/api/trading/mtf-analyze`, { h1, m15, m5 });
  },
  liquidityTrap(candles: any[], swingHigh?: number, swingLow?: number) {
     return apiService.post<any>(`/api/trading/liquidity-trap`, { candles, swingHigh, swingLow });
  },
  marketStructure(swings: any[], proposed_trade: string) {
     return apiService.post<any>(`/api/trading/structure`, { swings, proposed_trade });
  },
  volumeValidation(candles: any[]) {
     return apiService.post<any>(`/api/trading/volume`, { candles });
  },
  tradeQualityScore(
    has_trend_alignment: boolean,
    has_ema_separation: boolean,
    has_strong_pa: boolean,
    has_volume_confirmation: boolean,
    no_liquidity_trap: boolean
  ) {
     return apiService.post<any>(`/api/trading/quality-score`, {
        has_trend_alignment,
        has_ema_separation,
        has_strong_pa,
        has_volume_confirmation,
        no_liquidity_trap
     });
  },
  finalDecision(
    htf_alignment: boolean,
    trend: string,
    fake_breakout: boolean,
    structure_valid: boolean,
    score: number,
    current_price: number,
    recent_low: number,
    recent_high: number
  ) {
     return apiService.post<any>(`/api/trading/final-decision`, {
        htf_alignment,
        trend,
        fake_breakout,
        structure_valid,
        score,
        current_price,
        recent_low,
        recent_high
     });
  },
  riskManager(
    account_balance: number,
    daily_loss_pct: number,
    consecutive_losses: number,
    drawdown_pct: number,
    signal: string,
    risk_per_trade_pct: number = 1
  ) {
     return apiService.post<any>(`/api/trading/risk-manager`, {
        account_balance,
        daily_loss_pct,
        consecutive_losses,
        drawdown_pct,
        signal,
        risk_per_trade_pct
     });
  },
  positionSize(
    account_balance: number,
    stop_loss_distance: number,
    risk_per_trade_pct: number = 1,
    is_high_volatility: boolean = false
  ) {
     return apiService.post<any>(`/api/trading/position-size`, {
        account_balance,
        stop_loss_distance,
        risk_per_trade_pct,
        is_high_volatility
     });
  },
  alphaDetection(
    historical_expectancy: number,
    recent_similar_trades_win_rate: number,
    market_conditions_match: boolean,
    signal_score: number
  ) {
     return apiService.post<any>(`/api/trading/alpha-detection`, {
        historical_expectancy,
        recent_similar_trades_win_rate,
        market_conditions_match,
        signal_score
     });
  },
  capitalProtection(
    current_drawdown: number,
    is_high_volatility: boolean
  ) {
     return apiService.post<any>(`/api/trading/capital-protection`, {
        current_drawdown,
        is_high_volatility
     });
  },
  portfolioAllocation(
    capital: number,
    open_positions: any[],
    requested_symbols: string[]
  ) {
     return apiService.post<any>(`/api/trading/portfolio-allocation`, {
        capital,
        open_positions,
        requested_symbols
     });
  },
  executionEngine(
    is_volatile: boolean,
    is_news_spike: boolean,
    order_size: number,
    average_daily_volume: number
  ) {
     return apiService.post<any>(`/api/trading/execution-engine`, {
        is_volatile,
        is_news_spike,
        order_size,
        average_daily_volume
     });
  },
  marketRegime(
    ema_34: number, ema_89: number, ema_200: number,
    ema_34_slope: number, ema_89_slope: number, ema_200_slope: number,
    price_movement: number,
    volatility: number,
    volume_spike: boolean,
    fake_breakout: boolean
  ) {
     return apiService.post<any>(`/api/trading/market-regime`, {
        ema_34, ema_89, ema_200,
        ema_34_slope, ema_89_slope, ema_200_slope,
        price_movement,
        volatility,
        volume_spike,
        fake_breakout
     });
  },
  probabilisticModel(
    market_features: any,
    market_regime: string
  ) {
     return apiService.post<any>(`/api/trading/probabilistic-model`, {
        market_features,
        market_regime
     });
  },
  hedgeFundDecision(
    regime: string,
    edge_strength: string,
    prob_up: number,
    prob_down: number
  ) {
     return apiService.post<any>(`/api/trading/hedge-fund-decision`, {
        regime,
        edge_strength,
        prob_up,
        prob_down
     });
  },
  strategyOptimizer(
    market_condition: string
  ) {
     return apiService.post<any>(`/api/trading/strategy-optimizer`, {
        market_condition
     });
  },
  hedgeFundRisk(
    account_equity: number,
    drawdown: number,
    volatility: number,
    recent_trades: any[]
  ) {
     return apiService.post<any>(`/api/trading/hedge-fund-risk`, {
        account_equity,
        drawdown,
        volatility,
        recent_trades
     });
  },
  finalExecutionLayer(
    ai_signal: string,
    can_trade: boolean,
    risk_multiplier: number,
    exposure: number,
    exposure_limit: number,
    market_regime: string,
    base_position_size: number
  ) {
     return apiService.post<any>(`/api/trading/final-execution`, {
        ai_signal,
        can_trade,
        risk_multiplier,
        exposure,
        exposure_limit,
        market_regime,
        base_position_size
     });
  },
  featureEngineering(ohlcv: any[]) {
      return apiService.post<any>(`/api/trading/feature-engineering`, {
         ohlcv
      });
  },
  marketStructureV2(
    swing_highs: number[],
    swing_lows: number[],
    recent_candles: any[],
    ema_direction: string
  ) {
      return apiService.post<any>(`/api/trading/market-structure`, {
         swing_highs,
         swing_lows,
         recent_candles,
         ema_direction
      });
  },
  detectLiquidityTrap(
    price_action: any[],
    recent_highs: number[],
    recent_lows: number[]
  ) {
      return apiService.post<any>(`/api/trading/liquidity-trap`, {
         price_action,
         recent_highs,
         recent_lows
      });
  },
  priceActionSignal(
    last_candles: any[],
    ema_zones: any,
    market_regime: string
  ) {
      return apiService.post<any>(`/api/trading/price-action-signal`, {
         last_candles,
         ema_zones,
         market_regime
      });
  },
  volumeConfirmation(
    volume_data: number[],
    price_movement: number,
    signal_direction: string
  ) {
      return apiService.post<any>(`/api/trading/volume-confirmation`, {
         volume_data,
         price_movement,
         signal_direction
      });
  },
  tradeScoringV2(
    trend_aligned: boolean,
    structure_valid: boolean,
    pa_signal_strong: boolean,
    volume_confirmed: boolean,
    no_liquidity_trap: boolean
  ) {
      return apiService.post<any>(`/api/trading/trade-scoring`, {
         trend_aligned,
         structure_valid,
         pa_signal_strong,
         volume_confirmed,
         no_liquidity_trap
      });
  },
  riskManagerV2(
    daily_loss: number,
    consecutive_losses: number,
    drawdown: number
  ) {
      return apiService.post<any>(`/api/trading/risk-manager`, {
         daily_loss,
         consecutive_losses,
         drawdown
      });
  },
  decisionEngine(
    regime: string,
    structure_valid: boolean,
    pa_signal: string,
    liquidity_trap: boolean,
    volume_confirmed: boolean,
    score: number,
    risk_allowed: boolean,
    current_price: number,
    recent_low: number,
    recent_high: number
  ) {
      return apiService.post<any>(`/api/trading/decision-engine`, {
         regime,
         structure_valid,
         pa_signal,
         liquidity_trap,
         volume_confirmed,
         score,
         risk_allowed,
         current_price,
         recent_low,
         recent_high
      });
  },
  executionSystem(
    regime: string,
    volatility: string,
    order_size: number,
    is_duplicate: boolean,
    large_order_threshold: number
  ) {
      return apiService.post<any>(`/api/trading/execution-system`, {
         regime,
         volatility,
         order_size,
         is_duplicate,
         large_order_threshold
      });
  },
  backtestEngine(
    ohlcv: any[],
    strategy_rules: any,
    spread: number,
    slippage: number
  ) {
      return apiService.post<any>(`/api/trading/backtest-engine`, {
         ohlcv,
         strategy_rules,
         spread,
         slippage
      });
  },
  edgeEvaluator(
    expectancy: number,
    winrate: number,
    profit_factor: number,
    average_rr: number
  ) {
      return apiService.post<any>(`/api/trading/edge-evaluator`, {
         expectancy,
         winrate,
         profit_factor,
         average_rr
      });
  },
  mlPrediction(
    ema_distance: number,
    volume: number,
    volatility: number,
    structure: string,
    pa_patterns: any[]
  ) {
      return apiService.post<any>(`/api/trading/ml-prediction`, {
         ema_distance,
         volume,
         volatility,
         structure,
         pa_patterns
      });
  },
  strategyAdaptation(
    market_condition: string,
    winrate_trend: string,
    volatility_shift: string
  ) {
      return apiService.post<any>(`/api/trading/strategy-adaptation`, {
         market_condition,
         winrate_trend,
         volatility_shift
      });
  },
  capitalProtectionV2(
    drawdown: number,
    consecutive_losses: number,
    volatility_spike: boolean
  ) {
      return apiService.post<any>(`/api/trading/capital-protection`, {
         drawdown,
         consecutive_losses,
         volatility_spike
      });
  },
  regimeLearning(
    trend_performance: number,
    sideways_performance: number,
    volatility_performance: number
  ) {
      return apiService.post<any>(`/api/trading/regime-learning`, {
         trend_performance,
         sideways_performance,
         volatility_performance
      });
  },
  portfolioAllocationV2(
    candidates: any[],
    correlations: Record<string, string[]>
  ) {
      return apiService.post<any>(`/api/trading/portfolio-allocation`, {
         candidates,
         correlations
      });
  },
  hedgeFundDecisionV2(
    has_edge: boolean,
    prob_up: number,
    prob_down: number,
    risk_state: string,
    current_regime: string,
    best_regime: string,
    base_position_size: number
  ) {
      return apiService.post<any>(`/api/trading/hedge-fund-decision`, {
         has_edge,
         prob_up,
         prob_down,
         risk_state,
         current_regime,
         best_regime,
         base_position_size
      });
  },
  mlTrainingPipeline(
    data_points: number,
    model_preference: string,
    features: string[]
  ) {
      return apiService.post<any>(`/api/trading/ml-training-pipeline`, {
         data_points,
         model_preference,
         features
      });
  },
  tradingAnalytics(
    trade_history: any[],
    initial_capital: number
  ) {
      return apiService.post<any>(`/api/trading/trading-analytics`, {
         trade_history,
         initial_capital
      });
  },
  liveTradingBot(
    market_data: any,
    recent_trades_count: number,
    current_model_version: string
  ) {
      return apiService.post<any>(`/api/trading/live-trading-bot`, {
         market_data,
         recent_trades_count,
         current_model_version
      });
  },
  performanceOptimizer(
    trade_history: any[],
    model_performance: any,
    risk_metrics: any,
    market_conditions: string
  ) {
      return apiService.post<any>(`/api/trading/performance-optimizer`, {
         trade_history,
         model_performance,
         risk_metrics,
         market_conditions
      });
  },
  professionalTradingSystem(
    market_data: any,
    account_state?: any
  ) {
      return apiService.post<any>(`/api/trading/professional-trading-system`, {
         market_data,
         account_state
      });
  },
  dataLabelingSystem(
    historical_data: any[],
    look_forward_candles: number
  ) {
      return apiService.post<any>(`/api/trading/data-labeling-system`, {
         historical_data,
         look_forward_candles
      });
  },
  mlModelTrainer(
    model_type: string,
    dataset_size?: number
  ) {
      return apiService.post<any>(`/api/trading/ml-model-trainer`, {
         model_type,
         dataset_size
      });
  },
  tradingPredictionAi(
    ema_data: any,
    volume_data: any,
    structure_data: any,
    pa_data: any
  ) {
      return apiService.post<any>(`/api/trading/trading-prediction-ai`, {
         ema_data,
         volume_data,
         structure_data,
         pa_data
      });
  },
  selfLearningTradingSystem(
    recent_trades: any[],
    current_features: any[]
  ) {
      return apiService.post<any>(`/api/trading/self-learning-trading-system`, {
         recent_trades,
         current_features
      });
  },
  hedgeFundAiDecisionSystem(
    ml_output: any,
    market_regime: string,
    risk_status: string
  ) {
      return apiService.post<any>(`/api/trading/hedge-fund-ai-decision-system`, {
         ml_output,
         market_regime,
         risk_status
      });
  }
};
