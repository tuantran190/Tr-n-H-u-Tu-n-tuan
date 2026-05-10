type MessageHandler = (data: any) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private messageHandlers: Set<MessageHandler> = new Set();
  private manualClose = false;

  constructor() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}`;
  }

  connect(onOpen?: () => void, onClose?: () => void) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.manualClose = false;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      if (onOpen) onOpen();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.messageHandlers.forEach(handler => handler(data));
      } catch (e) {
        console.error('Failed to parse WebSocket message', e);
      }
    };

    this.ws.onclose = () => {
      if (onClose) onClose();
      if (!this.manualClose) {
        this.handleReconnect(onOpen, onClose);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket connection error:', error);
      // ws.onclose will be called after onerror, triggering reconnect logic
    };
  }

  private handleReconnect(onOpen?: () => void, onClose?: () => void) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const timeout = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`WebSocket disconnected. Reconnecting in ${timeout}ms (Attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(onOpen, onClose), timeout);
    } else {
      console.error('WebSocket max reconnect attempts reached.');
    }
  }

  disconnect() {
    this.manualClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(handler: MessageHandler) {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }
  
  send(type: string, payload: any) {
     if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type, payload }));
     }
  }
}

export const wsService = new WebSocketService();
