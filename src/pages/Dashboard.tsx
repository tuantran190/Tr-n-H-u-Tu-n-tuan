import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, Wallet, Activity, TrendingUp } from 'lucide-react';

const mockData = [
  { date: '1', value: 4000 },
  { date: '2', value: 4200 },
  { date: '3', value: 3800 },
  { date: '4', value: 4600 },
  { date: '5', value: 4800 },
  { date: '6', value: 4500 },
  { date: '7', value: 5200 },
];

export function Dashboard() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-neutral-400 mb-4">
            <span className="text-sm font-medium">Total Balance</span>
            <Wallet className="w-4 h-4" />
          </div>
          <div className="text-3xl font-bold tracking-tight">$45,231.89</div>
          <div className="flex items-center gap-1 text-sm text-emerald-400 mt-2 mt-2">
            <ArrowUpRight className="w-4 h-4" />
            <span>+20.1% from last month</span>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-neutral-400 mb-4">
            <span className="text-sm font-medium">Active Bots</span>
            <Activity className="w-4 h-4" />
          </div>
          <div className="text-3xl font-bold tracking-tight">3</div>
          <div className="text-sm text-neutral-500 mt-2">
            2 Profitable / 1 In Loss
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between text-neutral-400 mb-4">
            <span className="text-sm font-medium">Total PnL</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-3xl font-bold tracking-tight text-emerald-400">+$8,432.00</div>
          <div className="text-sm text-neutral-500 mt-2">
            All time
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 h-[400px]">
        <h3 className="text-sm font-medium text-neutral-400 mb-6">Equity Curve</h3>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mockData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px' }}
              itemStyle={{ color: '#a3a3a3' }}
            />
            <Area type="monotone" dataKey="value" stroke="#34d399" fillOpacity={1} fill="url(#colorValue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
