import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import StatCard from '../components/common/StatCard';
import AlertsPanel from '../components/common/AlertsPanel';
import { ArrowLeftRight, AlertTriangle, Activity, GitFork, RefreshCw, Building2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAmlStore } from '../store/aml.store';
import GraphVisualization from '../components/graph/GraphVisualization';
import NodeDetailPanel from '../components/graph/NodeDetailPanel';

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: api.getDashboardStats,
  });

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['volume-chart'],
    queryFn: api.getVolumeChart,
  });

  const { data: graphData, isLoading: graphLoading } = useQuery({
    queryKey: ['graph'],
    queryFn: api.getFullGraph,
  });

  const { isAnalysisRunning, setAnalysisRunning, selectNode: selectNodeFn } = useAmlStore();

  const handleRunAnalysis = async () => {
    setAnalysisRunning(true);
    try { await api.runAnalysis(); } finally { setAnalysisRunning(false); }
  };

  // Mini graph: only flagged nodes
  const miniGraph = graphData ? {
    nodes: graphData.nodes.filter(n => n.flagLevel !== 'NONE'),
    links: graphData.links.filter(l => {
      const srcFlagged = graphData.nodes.find(n => n.id === l.source)?.flagLevel !== 'NONE';
      const tgtFlagged = graphData.nodes.find(n => n.id === l.target)?.flagLevel !== 'NONE';
      return srcFlagged && tgtFlagged;
    }),
  } : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Transactions"
          value={stats?.totalTransactions ?? '—'}
          icon={ArrowLeftRight}
          color="indigo"
          loading={statsLoading}
        />
        <StatCard
          title="Flagged Transactions"
          value={stats?.flaggedTransactions ?? '—'}
          icon={AlertTriangle}
          color="orange"
          trend={12}
          loading={statsLoading}
        />
        <StatCard
          title="Critical Alerts"
          value={stats?.criticalAlerts ?? '—'}
          icon={Activity}
          color="red"
          trend={8}
          loading={statsLoading}
        />
        <StatCard
          title="Active Cycles"
          value={stats?.activeCycles ?? '—'}
          icon={GitFork}
          color="red"
          loading={statsLoading}
        />
        <StatCard
          title="Entities Flagged"
          value={stats?.entitiesFlagged ?? '—'}
          icon={Building2}
          color="yellow"
          loading={statsLoading}
        />
        <StatCard
          title="Analysis Runs"
          value={stats?.analysisRuns ?? '—'}
          icon={RefreshCw}
          color="green"
          subtitle="Last 30 days"
          loading={statsLoading}
        />
      </div>

      {/* Analysis alert banner */}
      {stats?.activeCycles > 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-red-300">{stats.activeCycles} Active Circular Fund Flow Cycle{stats.activeCycles === 1 ? '' : 's'} Detected</p>
              <p className="text-xs text-red-400/60">
                Please review the flagged entities and transaction graph for details.
              </p>
            </div>
          </div>
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalysisRunning}
            className="btn-danger text-xs whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalysisRunning ? 'animate-spin' : ''}`} />
            {isAnalysisRunning ? 'Running...' : 'Re-run Analysis'}
          </button>
        </div>
      )}

      {/* Chart + Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Volume Chart */}
        <div className="xl:col-span-2 card">
          <h3 className="text-sm font-semibold text-white mb-4">Transaction Volume (14 days)</h3>
          {chartLoading ? (
            <div className="h-56 bg-white/5 rounded-lg animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Area type="monotone" dataKey="total" name="Total" stroke="#6366f1" fill="url(#totalGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="suspicious" name="Suspicious" stroke="#ef4444" fill="url(#suspGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Alerts */}
        <AlertsPanel limit={5} />
      </div>

      {/* Mini graph */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Flagged Entity Network</h3>
            <p className="text-xs text-gray-500 mt-0.5">Only showing entities with active flags. Click a node for details.</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Critical</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" />High</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />Medium</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Low</div>
          </div>
        </div>
        {graphLoading ? (
          <div className="h-72 bg-white/5 rounded-xl animate-pulse" />
        ) : miniGraph ? (
          <div className="relative">
            <GraphVisualization
              graphData={miniGraph}
              height={300}
              onNodeClick={(node) => selectNodeFn(node.id)}
            />
            <NodeDetailPanel />
          </div>
        ) : null}
      </div>
    </div>
  );
}
