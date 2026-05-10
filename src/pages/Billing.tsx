import { CheckCircle2, Zap, Shield, Database } from 'lucide-react';
import { cn } from '../lib/utils';

export function Billing() {
  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="mb-12">
        <h2 className="text-3xl font-bold tracking-tight mb-2">Billing & Subscription</h2>
        <p className="text-neutral-400">Manage your subscription, credits, and API limits.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        
        {/* Basic Plan */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col">
          <div className="mb-4">
            <h3 className="text-xl font-bold">Starter</h3>
            <p className="text-sm text-neutral-500 mt-1">For manual traders and beginners.</p>
          </div>
          <div className="mb-6">
            <span className="text-4xl font-bold">$0</span>
            <span className="text-neutral-500">/mo</span>
          </div>
          <div className="flex-1">
             <ul className="space-y-3 text-sm text-neutral-300">
              <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Manual Trading Terminal</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 1 Exchange Connection</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 10 AI Chats / month</li>
              <li className="flex items-center gap-3 text-neutral-600"><CheckCircle2 className="w-4 h-4 opacity-30" /> No active bots</li>
            </ul>
          </div>
          <button className="mt-8 w-full py-2.5 rounded-lg font-medium bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700 transition-colors">
            Downgrade
          </button>
        </div>

        {/* Pro Plan */}
        <div className="bg-neutral-950 border-2 border-emerald-500/50 rounded-2xl p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-emerald-500 text-neutral-950 text-xs font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
            Current Plan
          </div>
          <div className="mb-4">
            <h3 className="text-xl font-bold text-emerald-400">Pro Automator</h3>
            <p className="text-sm text-neutral-500 mt-1">For serious algorithmic traders.</p>
          </div>
          <div className="mb-6">
            <span className="text-4xl font-bold">$49</span>
            <span className="text-neutral-500">/mo</span>
          </div>
          <div className="flex-1">
             <ul className="space-y-3 text-sm text-neutral-300">
              <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 5 Active Trading Bots</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Unlimited AI Strategy Gen</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Up to 5 Exchange Accounts</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 10,000 Backtest Credits / mo</li>
            </ul>
          </div>
          <button className="mt-8 w-full py-2.5 rounded-lg font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 cursor-default">
            Active
          </button>
        </div>

        {/* Enterprise Plan */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col">
          <div className="mb-4">
            <h3 className="text-xl font-bold">Institutional</h3>
            <p className="text-sm text-neutral-500 mt-1">Full automation and massive scale.</p>
          </div>
          <div className="mb-6">
            <span className="text-4xl font-bold">$299</span>
            <span className="text-neutral-500">/mo</span>
          </div>
          <div className="flex-1">
             <ul className="space-y-3 text-sm text-neutral-300">
              <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Unlimited Bots</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Dedicated IP & RPC Nodes</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Real-time Auto-Pilot System</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> 500,000 Backtest Credits / mo</li>
            </ul>
          </div>
          <button className="mt-8 w-full py-2.5 rounded-lg font-medium bg-emerald-500 text-neutral-950 hover:bg-emerald-600 transition-colors">
            Upgrade to Pro
          </button>
        </div>

      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold mb-1">Credit Usage</h3>
            <p className="text-sm text-neutral-500">Credits are consumed when running intensive backtests or AI model fine-tuning.</p>
          </div>
          <button className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-neutral-700">
            Buy More Credits
          </button>
        </div>

        <div className="space-y-4">
           <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-neutral-400">Backtesting Engine</span>
              <span className="font-mono">8,760 / 10,000</span>
            </div>
            <div className="h-2 w-full bg-neutral-950 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-[87%] rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
