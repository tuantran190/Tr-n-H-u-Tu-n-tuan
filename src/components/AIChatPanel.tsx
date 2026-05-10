import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';
import { useTradingStore } from '../store/useTradingStore';
import { tradingService } from '../services/tradingService';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export function AIChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: 'Hello! I am your AI trading assistant. How can I help you analyze the market today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  const symbol = useTradingStore(s => s.symbol);
  const timeframe = useTradingStore(s => s.timeframe);
  const suggestedPrice = useTradingStore(s => s.suggestedPrice);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = input.trim();
    setInput('');
    const newMessages = [...messages, { id: Date.now().toString(), role: 'user' as const, text: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Gather context
      let botState = null;
      try {
         const data = await tradingService.getBotStatus();
         botState = data;
      } catch(e) {}

      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          context: {
            symbol,
            timeframe,
            suggestedPrice,
            botState
          }
        })
      });

      if (!res.ok || !res.body) throw new Error('Failed to start chat stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      const aiResponseId = Date.now().toString() + '_ai';
      setMessages(prev => [...prev, { id: aiResponseId, role: 'model', text: '' }]);

      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
           const chunkValue = decoder.decode(value);
           const lines = chunkValue.split('\n');
           for (const line of lines) {
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                 try {
                   const data = JSON.parse(line.replace('data: ', ''));
                   if (data.text) {
                     setMessages(prev => prev.map(m => m.id === aiResponseId ? { ...m, text: m.text + data.text } : m));
                   } else if (data.error) {
                     console.error('Chat error:', data.error);
                   }
                 } catch (e) {
                   // Ignore parse errors from incomplete chunks
                 }
              }
           }
        }
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: 'Sorry, I encountered an error. Please check if the GEMINI_API_KEY is configured in the backend.'}]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-950/50 shrink-0">
        <h3 className="font-semibold text-sm flex items-center gap-2 text-indigo-400">
          <Bot className="w-4 h-4" />
          AI Trading Assistant
        </h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex gap-3 max-w-[90%]", msg.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1", msg.role === 'user' ? "bg-emerald-500/20 text-emerald-500" : "bg-indigo-500/20 text-indigo-500")}>
              {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className={cn("p-3 rounded-lg text-sm", msg.role === 'user' ? "bg-emerald-500/10 text-emerald-100 border border-emerald-500/20 rounded-tr-none" : "bg-neutral-800 text-neutral-200 border border-neutral-700 rounded-tl-none")}>
               <div className={cn(msg.role === 'model' && "markdown-body max-w-none text-sm break-words [&>p]:mb-2 [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4 [&>h1]:font-bold [&>h1]:text-lg [&>h2]:font-bold [&>h3]:font-bold")}>
                 {msg.role === 'user' ? <div className="whitespace-pre-wrap">{msg.text}</div> : <Markdown>{msg.text}</Markdown>}
               </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 max-w-[90%]">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="p-3 rounded-lg text-sm bg-neutral-800 border border-neutral-700 rounded-tl-none text-neutral-400 flex items-center gap-2">
               <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-neutral-950 border-t border-neutral-800">
         <div className="relative flex items-center">
           <input 
             type="text" 
             className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-4 pr-10 py-3 text-sm text-neutral-200 placeholder:text-neutral-500 outline-none focus:border-indigo-500/50"
             placeholder="Ask about the market or trading strategy..."
             value={input}
             onChange={e => setInput(e.target.value)}
             onKeyDown={e => e.key === 'Enter' && handleSend()}
             disabled={isLoading}
           />
           <button 
             onClick={handleSend}
             disabled={!input.trim() || isLoading}
             className="absolute right-2 p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
           >
             <Send className="w-4 h-4" />
           </button>
         </div>
         <div className="text-center mt-2">
            <p className="text-[10px] text-neutral-600">AI can make mistakes. Please verify important information.</p>
         </div>
      </div>
    </div>
  );
}
