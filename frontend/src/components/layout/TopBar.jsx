import { Bell, Search, RefreshCw, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAmlStore } from '../../store/aml.store';

export default function TopBar({ title }) {
  const { setSearchQuery, searchQuery, isAnalysisRunning, setAnalysisRunning } = useAmlStore();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: api.getDashboardStats,
  });

  const handleRunAnalysis = async () => {
    setAnalysisRunning(true);
    try {
      await api.runAnalysis();
    } finally {
      setAnalysisRunning(false);
    }
  };

  return (
    <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 border-b border-white/5 bg-navy-800/50 backdrop-blur-md">
      {/* Title */}
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <p className="text-xs text-gray-500">AML Shield — Transaction Intelligence Platform</p>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Run Analysis */}
        <button
          onClick={handleRunAnalysis}
          disabled={isAnalysisRunning}
          className="btn-secondary text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isAnalysisRunning ? 'animate-spin' : ''}`} />
          {isAnalysisRunning ? 'Running...' : 'Run Analysis'}
        </button>

        {/* Alert bell */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200">
          <Bell className="w-4 h-4" />
          {stats?.criticalAlerts > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </button>

        {/* User */}
        <div className="flex items-center gap-2 pl-3 border-l border-white/10">
          <div className="w-8 h-8 bg-indigo-600/30 border border-indigo-500/30 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-white">Admin</p>
            <p className="text-[10px] text-gray-500">Investigator</p>
          </div>
        </div>
      </div>
    </header>
  );
}
