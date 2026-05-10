import { create } from 'zustand';

interface LayoutState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  sizes: Record<string, number[]>;
  setSizes: (group: string, sizes: number[]) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  sizes: {
    'trading-main': [75, 25],
    'trading-left-vertical': [70, 30],
    'trading-right-vertical': [15, 35, 50],
  },
  setSizes: (group, sizes) => set((state) => ({
    sizes: {
      ...state.sizes,
      [group]: sizes,
    }
  }))
}));
