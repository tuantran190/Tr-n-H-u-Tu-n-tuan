import { create } from 'zustand';

export type EngineMode = 'MANUAL' | 'SEMI_AUTO' | 'FULL_AUTO';
export type EngineStatus = 'SCANNING' | 'ANALYZING' | 'DECIDING' | 'AWAITING_APPROVAL' | 'EXECUTING' | 'IDLE';

export interface EventLog {
  id: string;
  time: string;
  message: string;
  type: 'scan' | 'analyze' | 'decision' | 'execute' | 'error' | 'system' | 'info';
}

export interface Decision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string[];
  asset: string;
  suggestedPrice: number;
  suggestedSize: number;
}

interface AutoEngineState {
  mode: EngineMode;
  isRunning: boolean;
  status: EngineStatus;
  currentDecision: Decision | null;
  countdown: number | null;
  logs: EventLog[];
  
  setMode: (mode: EngineMode) => void;
  toggleRunning: () => void;
  emergencyStop: () => void;
  addLog: (log: Omit<EventLog, 'id'>) => void;
  setDecision: (decision: Decision | null) => void;
  setStatus: (status: EngineStatus) => void;
  setCountdown: (val: number | null) => void;
}

export const useAutoEngineStore = create<AutoEngineState>((set) => ({
  mode: 'SEMI_AUTO',
  isRunning: false,
  status: 'IDLE',
  currentDecision: null,
  countdown: null,
  logs: [
    { id: '1', time: new Date().toLocaleTimeString(), message: 'Auto Engine initialized.', type: 'system' }
  ],
  
  setMode: (mode) => set({ mode }),
  toggleRunning: () => set((state) => {
    const isRunning = !state.isRunning;
    return {
      isRunning,
      status: isRunning ? 'SCANNING' : 'IDLE',
      logs: [{
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString(),
        message: `Engine ${isRunning ? 'started' : 'stopped'}`,
        type: 'system'
      }, ...state.logs]
    };
  }),
  emergencyStop: () => set((state) => ({
    isRunning: false,
    status: 'IDLE',
    mode: 'MANUAL',
    currentDecision: null,
    countdown: null,
    logs: [{
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString(),
      message: 'EMERGENCY STOP TRIGGERED. All systems halted.',
      type: 'error'
    }, ...state.logs]
  })),
  addLog: (log) => set((state) => ({
    logs: [{ ...log, id: Date.now().toString() }, ...state.logs].slice(0, 50)
  })),
  setDecision: (currentDecision) => set({ currentDecision }),
  setStatus: (status) => set({ status }),
  setCountdown: (countdown) => set({ countdown }),
}));
