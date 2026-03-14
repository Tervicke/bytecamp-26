import { create } from 'zustand';

export const useAmlStore = create((set, get) => ({
  // Selected entity for detail panel
  selectedNodeId: null,
  selectedTransaction: null,
  trailTransactionId: null,

  // Filters
  flagFilter: 'ALL',
  searchQuery: '',
  entityTab: 'companies',

  // UI state
  isDetailPanelOpen: false,
  isTrailOpen: false,
  isSidebarCollapsed: false,

  // Analysis running state
  isAnalysisRunning: false,

  // Actions
  selectNode: (nodeId) => set({ selectedNodeId: nodeId, isDetailPanelOpen: true }),
  clearSelection: () => set({ selectedNodeId: null, isDetailPanelOpen: false }),

  openTrail: (txnId) => set({ trailTransactionId: txnId, isTrailOpen: true }),
  closeTrail: () => set({ trailTransactionId: null, isTrailOpen: false }),

  selectTransaction: (txn) => set({ selectedTransaction: txn }),

  setFlagFilter: (filter) => set({ flagFilter: filter }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setEntityTab: (tab) => set({ entityTab: tab }),

  toggleSidebar: () => set(s => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),

  setAnalysisRunning: (running) => set({ isAnalysisRunning: running }),
}));
