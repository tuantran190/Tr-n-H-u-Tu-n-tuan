import { useState } from 'react';
import { Send, Bot, Code2, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function AIAssistant() {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string; code?: string }[]>([
    {
      role: 'ai',
      content: 'Hello! I am your Quant AI Assistant. How can I help you build a trading strategy today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });
      const data = await res.json();
      
      setMessages(prev => [...prev, {
        role: 'ai',
        content: data.reply,
        code: data.code
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'ai', content: 'An error occurred while communicating with the server.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <h2 className="text-2xl font-bold tracking-tight">AI Strategy Assistant</h2>
      
      <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col overflow-hidden">
        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={cn(
              "flex gap-4 max-w-4xl",
              msg.role === 'user' ? "ml-auto" : ""
            )}>
              {msg.role === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-emerald-400" />
                </div>
              )}
              
              <div className="space-y-4 w-full">
                <div className={cn(
                  "p-4 rounded-xl text-sm leading-relaxed",
                  msg.role === 'user' 
                    ? "bg-neutral-800 text-neutral-200" 
                    : "bg-neutral-950/50 border border-neutral-800 text-neutral-300"
                )}>
                  {msg.content}
                </div>
                
                {msg.code && (
                  <div className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950">
                    <div className="px-4 py-2 bg-neutral-900 border-b border-neutral-800 flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-neutral-500" />
                      <span className="text-xs font-medium text-neutral-400">Generated Strategy</span>
                    </div>
                    <pre className="p-4 text-xs font-mono text-neutral-300 overflow-x-auto">
                      <code>{msg.code}</code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-4 max-w-4xl">
               <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                </div>
                <div className="p-4 rounded-xl text-sm leading-relaxed bg-neutral-950/50 border border-neutral-800 text-neutral-400">
                  Thinking...
                </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 bg-neutral-900 border-t border-neutral-800">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Describe your strategy (e.g., 'Moving average crossover with 14 and 50 periods')..."
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
