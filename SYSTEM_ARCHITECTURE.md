# Auto Trading System Architecture

This document describes the production-ready architecture for the requested Auto Trading Platform, combining FastAPI, PostgreSQL, Redis, and an AI Decision Engine.

## 1. High-Level Architecture

The system is designed as a distributed, event-driven architecture to ensure high availability, low latency, and modularity.

*   **Frontend (Next.js / React)**: Handles UI, WebSocket connections, and user interactions.
*   **API Gateway / Backend (FastAPI)**: Handles REST API requests, authentication, and routes commands to the engine.
*   **Auto Engine Worker (Python / asyncio)**: A background process running the core trading loop.
*   **Message Broker (Redis)**: Manages pub/sub for real-time WebSocket events, task queues, and caching orderbook data.
*   **Database (PostgreSQL)**: Stores users, bots, strategies, trade history, and system logs.

## 2. Core Auto Engine Loop

The Auto Engine runs independently of the web server as a daemon process (e.g., using Celery or raw `asyncio` loops).

```python
import asyncio
import logging

class AutoTradingEngine:
    def __init__(self, bot_config):
        self.bot_config = bot_config
        self.is_running = False

    async def start(self):
        self.is_running = True
        while self.is_running:
            try:
                # 1. Scan Market
                market_data = await self.scan_market()
                
                # 2. Analyze with AI & Indicators
                analysis = await self.analyze_with_ai(market_data)
                
                # 3. Make Decision
                decision = await self.make_decision(analysis)
                
                if decision.action in ['BUY', 'SELL']:
                    # 4. Check Override / Await Approval (Semi-Auto)
                    approved = await self.wait_for_override(decision)
                    if approved:
                        # 5. Execute Trade
                        trade_result = await self.execute_trade(decision)
                        
                        # 6. Manage Risk (Stop Loss, Take Profit)
                        await self.manage_risk(trade_result)
                        
                # 7. Log & Broadcast Event
                await self.log_event("LOOP_COMPLETE", decision)
                
            except Exception as e:
                logging.error(f"Engine Loop Error: {e}")
                await self.handle_emergency()
                
            await asyncio.sleep(self.bot_config.scan_interval)
```

## 3. AI Decision Engine

The AI component is invoked during the `analyze_with_ai` phase. Instead of returning raw chat text, we force the LLM (OpenAI/Gemini/Claude) to output structured JSON using function calling or strict JSON mode.

**Prompt Example:**
```text
You are an institutional quant AI. Analyze the following OHLCV data and technical indicators.
Return a JSON decision object.
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": <0-100>,
  "reasoning": ["reason 1", "reason 2"],
  "suggested_price": <float>,
  "suggested_size_usd": <float>
}
```

## 4. Multi-Bot & Capital Management

*   **Capital Allocation**: A master `PortfolioManager` service allocates a percentage of the total exchange balance to specific bots (e.g., Bot A gets 30%, Bot B gets 20%).
*   **Risk Limits**: Before `execute_trade` is called, a `RiskValidator` checks daily drawdown boundaries. If drawdown exceeds X%, the bot triggers an internal circuit breaker.

## 5. WebSocket Real-Time Infrastructure

*   **Redis Pub/Sub**: The Auto Engine publishes events to Redis channels (e.g., `bot:1:status`, `market:BTC:price`).
*   **FastAPI WebSocket Handler**: Subscribes to Redis channels and forwards JSON blobs to the connected React clients.

## 6. Emergency System (STOP ALL)

When "STOP ALL" is triggered from the UI:
1.  Frontend sends `POST /api/emergency/stop-all`.
2.  FastAPI sets a global `EMERGENCY_HALT` flag in Redis.
3.  FastAPI issues cancel-all-orders commands directly to exchange APIs (Binance, Bybit).
4.  Auto Engine workers read the Redis flag on their next tick and gracefully shut down.
