import { WebSocketServer, WebSocket as NodeWebSocket } from 'ws';
import { Server } from 'http';
import { EventEmitter } from 'events';

let wss: WebSocketServer;
const clients: Set<NodeWebSocket> = new Set();
export const marketEvents = new EventEmitter();

let binanceWs: NodeWebSocket | null = null;
let lastPrice = 0;

function connectBinance() {
  binanceWs = new NodeWebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');
  
  binanceWs.on('open', () => {
    console.log('[Binance WS] Connected');
  });

  binanceWs.on('message', (data: any) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.p) {
         lastPrice = parseFloat(parsed.p);
         const payload = { symbol: 'BTCUSDT', price: lastPrice, time: parsed.E };
         
         // Broadcast to all connected frontend clients
         broadcast('MARKET_DATA', payload);

         // Emit internally for execution engine (low latency)
         marketEvents.emit('tick', payload);
      }
    } catch (e) {
      console.error('Binance WS parse error', e);
    }
  });

  binanceWs.on('close', () => {
    console.log('[Binance WS] Disconnected, reconnecting in 3s...');
    setTimeout(connectBinance, 3000);
  });

  binanceWs.on('error', (err) => {
    console.error('[Binance WS] Error:', err);
  });
}

export function setupWsServer(server: Server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    clients.add(ws);
    
    // Send latest price immediately upon connect
    if (lastPrice > 0) {
      ws.send(JSON.stringify({ type: 'MARKET_DATA', payload: { symbol: 'BTCUSDT', price: lastPrice, time: Date.now() } }));
    }

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  // Start external market stream
  connectBinance();
}

export function broadcast(type: string, payload: any) {
  if (!wss) return;
  const message = JSON.stringify({ type, payload });
  for (const client of clients) {
    if (client.readyState === NodeWebSocket.OPEN) {
      client.send(message);
    }
  }
}
