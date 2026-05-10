import { GoogleGenAI } from '@google/genai';

export async function generateStrategyCode(prompt: string): Promise<string> {
  // In a real scenario, this uses the Google Gemini API to generate Python or Node.js strategy code.
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an expert quantitative developer. Provide ONLY python code for a trading strategy using ccxt or backtrader based on this prompt: ${prompt}`,
      });
      const text = response.text || '';
      return text.replace(/```python|```/gi, '').trim();
    } catch (e: any) {
      if (e?.message?.includes('API key not valid') || e?.status === 'INVALID_ARGUMENT') {
        console.warn('⚠️ Invalid Gemini API Key detected. Please configure a valid key in the AI Studio Secrets panel. Using fallback strategy.');
      } else {
        console.error('Gemini error:', e);
      }
      
      return `# ERROR: Invalid Gemini API Key.
# Please configure a valid GEMINI_API_KEY in your AI Studio secrets environment.
# Returning a default fallback strategy:

import backtrader as bt

class AIStrategy(bt.Strategy):
    params = (('period', 14),)
    
    def __init__(self):
        self.sma = bt.indicators.SimpleMovingAverage(self.data, period=self.params.period)
        
    def next(self):
        if self.data.close[0] > self.sma[0]:
            self.buy()
        elif self.data.close[0] < self.sma[0]:
            self.sell()`.trim();
    }
  }

  // Fallback if no API key or error
  return `
import backtrader as bt

class AIStrategy(bt.Strategy):
    params = (('period', 14),)
    
    def __init__(self):
        self.sma = bt.indicators.SimpleMovingAverage(self.data, period=self.params.period)
        
    def next(self):
        if self.data.close[0] > self.sma[0]:
            self.buy()
        elif self.data.close[0] < self.sma[0]:
            self.sell()
  `.trim();
}
