import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Activity, LayoutDashboard, LineChart, MessageSquare, Settings2, Code2, Bot, CreditCard, Coins, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLayoutStore } from '../store/useLayoutStore';

export function Layout() {
  const location = useLocation();
  const isTerminal = location.pathname === '/trading';
  const { sidebarCollapsed, toggleSidebar } = useLayoutStore();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/bots', label: 'Bot Fleet', icon: Bot },
    { to: '/trading', label: 'Auto Engine', icon: LineChart },
    { to: '/ai-assistant', label: 'AI Builder', icon: MessageSquare },
    { to: '/strategy', label: 'Strategies', icon: Code2 },
    { to: '/backtest', label: 'Backtest Engine', icon: Activity },
  ];

  const bottomNavItems = [
    { to: '/billing', label: 'Billing & Plans', icon: CreditCard },
  ];

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-neutral-800">
      {/* Sidebar */}
      <aside className={cn(
        "border-r border-neutral-800 bg-neutral-900/50 flex flex-col transition-all duration-300",
        sidebarCollapsed ? "w-[72px]" : "w-64"
      )}>
        <div className={cn(
          "px-6 py-5 border-b border-neutral-800 flex items-center h-14",
          sidebarCollapsed ? "justify-center px-0" : "gap-3"
        )}>
          <Activity className="text-emerald-400 shrink-0" />
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">
                Quant AI
              </h1>
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest leading-none mt-1">Pro Plan</span>
            </div>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex items-center rounded-md text-sm font-medium transition-colors group",
                sidebarCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5",
                isActive 
                  ? "bg-emerald-500/10 text-emerald-400" 
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-110", sidebarCollapsed && "w-5 h-5")} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-neutral-800 space-y-1">
           {bottomNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex items-center rounded-md text-sm font-medium transition-colors group",
                sidebarCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5",
                isActive 
                  ? "bg-emerald-500/10 text-emerald-400" 
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
          <button 
            className={cn(
              "w-full flex items-center text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-md transition-colors group",
              sidebarCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5"
            )}
            title={sidebarCollapsed ? "Settings" : undefined}
          >
            <Settings2 className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
            {!sidebarCollapsed && <span>Settings</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 border-b border-neutral-800 bg-neutral-950 flex items-center px-4 justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleSidebar}
              className="p-2 -ml-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 rounded-lg transition-colors"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity cursor-help bg-neutral-900 px-2 py-1 rounded hidden sm:flex">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">System Online</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-full px-3 py-1">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-neutral-200">1,240 <span className="text-neutral-500">Credits</span></span>
            </div>
            <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-sm font-medium border border-neutral-700 cursor-pointer hover:bg-neutral-700 transition-colors">
              AI
            </div>
          </div>
        </header>
        <div className={cn("flex-1 bg-neutral-950 overflow-hidden", !isTerminal && "p-6 overflow-auto")}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
