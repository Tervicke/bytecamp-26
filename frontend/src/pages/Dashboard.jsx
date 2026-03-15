import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import StatCard from '../components/common/StatCard';
import AlertsPanel from '../components/common/AlertsPanel';
import {
  ArrowLeftRight,
  AlertTriangle,
  Activity,
  GitFork,
  RefreshCw,
  Building2,
  User,
  CreditCard,
  ShieldAlert,
  Zap,
  TrendingUp,
  Search,
  Bell
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useAmlStore } from '../store/aml.store';

const COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
  NONE: '#6b7280'
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: api.getDashboardStats,
  });

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['volume-chart'],
    queryFn: api.getVolumeChart,
  });

  const { isAnalysisRunning, setAnalysisRunning } = useAmlStore();

  const handleRunAnalysis = async () => {
    setAnalysisRunning(true);
    try { await api.runAnalysis(); } finally { setAnalysisRunning(false); }
  };

  const riskData = stats?.riskDistribution ? Object.entries(stats.riskDistribution)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">AML Command Center</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">System Status: Operational</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search entities..."
              className="input-base pl-10 w-64"
            />
          </div>
          <button className="btn-secondary p-2.5">
            <Bell className="w-4 h-4" />
          </button>
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalysisRunning}
            className="btn-primary"
          >
            <RefreshCw className={`w-4 h-4 ${isAnalysisRunning ? 'animate-spin' : ''}`} />
            {isAnalysisRunning ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card-hover group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Volume</p>
              <h3 className="stat-value">{stats?.totalTransactions ?? '—'}</h3>
              <div className="flex items-center gap-1 mt-2 text-emerald-400 text-xs font-bold">
                <TrendingUp className="w-3 h-3" />
                <span>+12.5%</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform duration-300">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="card-hover group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Flagged Txns</p>
              <h3 className="stat-value text-orange-400">{stats?.flaggedTransactions ?? '—'}</h3>
              <p className="text-[10px] text-gray-500 mt-2 font-medium">Requires immediate review</p>
            </div>
            <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-400 group-hover:scale-110 transition-transform duration-300">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="card-hover group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full -mr-12 -mt-12 blur-2xl" />
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Critical Alerts</p>
              <h3 className="stat-value text-red-500">{stats?.criticalAlerts ?? '—'}</h3>
              <div className="flex items-center gap-1 mt-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-[10px] text-red-400 font-bold uppercase">Live Monitoring</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-red-500/10 text-red-500 group-hover:scale-110 transition-transform duration-300 glow-red">
              <Zap className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="card-hover group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Active Cycles</p>
              <h3 className="stat-value text-indigo-400">{stats?.activeCycles ?? '—'}</h3>
              <p className="text-[10px] text-gray-500 mt-2 font-medium">Circular flows detected</p>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform duration-300">
              <GitFork className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div className="space-y-8">
        {/* Top Row: Transaction Volume Trend (Full Width) */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">Transaction Volume Trend</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                <div className="w-2 h-2 rounded-full bg-indigo-500" /> TOTAL
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500">
                <div className="w-2 h-2 rounded-full bg-red-500" /> SUSPICIOUS
              </div>
            </div>
          </div>

          {chartLoading ? (
            <div className="h-80 bg-white/5 rounded-2xl animate-pulse" />
          ) : (
            <div className="h-80 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="suspGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#4b5563', fontSize: 10, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis
                    tick={{ fill: '#4b5563', fontSize: 10, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(13, 17, 23, 0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      fontSize: '11px',
                      backdropFilter: 'blur(8px)',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                    }}
                    itemStyle={{ padding: '2px 0' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#6366f1"
                    fill="url(#totalGrad)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="suspicious"
                    stroke="#ef4444"
                    fill="url(#suspGrad)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Bottom Row: 3 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Risk Distribution */}
          <div className="card">
            <h3 className="text-lg font-bold text-white mb-6">Risk Distribution</h3>
            {statsLoading ? (
              <div className="h-56 bg-white/5 rounded-2xl animate-pulse" />
            ) : riskData.length > 0 ? (
              <div className="h-56 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={8}
                      dataKey="value"
                      stroke="none"
                    >
                      {riskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name] || COLORS.NONE} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(13, 17, 23, 0.9)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        backdropFilter: 'blur(8px)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-white">{stats?.entitiesFlagged ?? 0}</span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Flagged</span>
                </div>
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center text-gray-500 text-xs italic">
                No risk data available
              </div>
            )}

            {/* Risk Legend */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              {Object.entries(COLORS).filter(([k]) => k !== 'NONE').map(([level, color]) => (
                <div key={level} className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">{level}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Flagged Entities */}
          <div className="card">
            <h3 className="text-lg font-bold text-white mb-6">High-Risk Entities</h3>
            {statsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 bg-white/5 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : stats?.topFlaggedEntities?.length > 0 ? (
              <div className="space-y-4">
                {stats.topFlaggedEntities.map((entity) => (
                  <div key={entity.id} className="group flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all duration-300 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-navy-900 border border-white/5 text-gray-400 group-hover:text-indigo-400 transition-colors">
                        {entity.type === 'Company' && <Building2 className="w-4 h-4" />}
                        {entity.type === 'Person' && <User className="w-4 h-4" />}
                        {entity.type === 'BankAccount' && <CreditCard className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white truncate max-w-[140px]">{entity.name}</p>
                        <p className="text-[10px] text-gray-500 font-medium">{entity.type}</p>
                      </div>
                    </div>
                    <span className={`
                      ${entity.flagLevel === 'CRITICAL' ? 'badge-critical' :
                        entity.flagLevel === 'HIGH' ? 'badge-high' :
                          entity.flagLevel === 'MEDIUM' ? 'badge-medium' : 'badge-low'}
                    `}>
                      {entity.flagLevel}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-gray-500 text-xs italic">
                No high-risk entities found
              </div>
            )}
          </div>

          {/* Alerts Panel (Activity Feed) */}
          <div className="card flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Live Alerts Feed</h3>
              <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold animate-pulse">LIVE</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <AlertsPanel limit={5} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
