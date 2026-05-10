import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Trading } from './pages/Trading';
import { AIAssistant } from './pages/AIAssistant';
import { StrategyBuilder } from './pages/StrategyBuilder';
import { Backtest } from './pages/Backtest';
import { Bots } from './pages/Bots';
import { Billing } from './pages/Billing';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'trading', element: <Trading /> },
      { path: 'ai-assistant', element: <AIAssistant /> },
      { path: 'strategy', element: <StrategyBuilder /> },
      { path: 'backtest', element: <Backtest /> },
      { path: 'bots', element: <Bots /> },
      { path: 'billing', element: <Billing /> },
    ]
  }
]);

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster theme="dark" position="bottom-right" richColors />
    </>
  );
}
