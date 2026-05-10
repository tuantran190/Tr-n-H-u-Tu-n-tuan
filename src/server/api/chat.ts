import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';

export const chatRouter = Router();

// Ensure you have set process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

chatRouter.post('/stream', async (req, res) => {
  const { messages, context } = req.body;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      res.write(`data: ${JSON.stringify({ text: "⚠️ Please configure your GEMINI_API_KEY in the Environment Variables." })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const systemPrompt = `You are an expert AI trading assistant integrated into a professional trading terminal.
    
Current context:
- Symbol: ${context.symbol}
- Timeframe: ${context.timeframe}
- Current Price Context (Estimate): ${context.priceSuggestion || 'N/A'}
- Bot State: ${context.botState?.isRunning ? 'Running' : 'Stopped'}
- Active Bot Orders: ${context.botState?.activeOrders || 0}
- Strategy: ${context.botState?.config?.strategy || 'N/A'}
- Risk: ${context.botState?.config?.risk || 0}% per trade

Provide concise, analytical, and professional responses. If asked for a recommendation, give a clear but caveated opinion based on technical indicators (RSI, MACD, EMA). Always remind users that this is not financial advice. Format your output in Markdown.`;

    const chatHistory = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    // Inject system prompt into the first message or use systemInstruction
    // GenAI SDK allows systemInstruction parameter
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: chatHistory,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
      }
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        // Send data formatted as Server-Sent Events
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Chat stream error:', error);
    if (error?.message?.includes('API key not valid') || error?.status === 'INVALID_ARGUMENT') {
       res.write(`data: ${JSON.stringify({ text: "⚠️ Invalid Gemini API Key detected. Please configure a valid key." })}\n\n`);
    } else {
       res.write(`data: ${JSON.stringify({ error: error.message || 'Failed to generate response' })}\n\n`);
    }
    res.end();
  }
});
