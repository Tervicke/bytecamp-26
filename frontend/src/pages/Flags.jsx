import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAmlStore } from '../store/aml.store';
import DangerBadge from '../components/transactions/DangerBadge';
import { AlertTriangle, RefreshCw, CheckCircle, Building2, User, CreditCard, Clock, Shield } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const ENTITY_ICONS = { Company: Building2, Person: User, BankAccount: CreditCard };

export default function Flags() {
  const queryClient = useQueryClient();
  const { isAnalysisRunning, setAnalysisRunning } = useAmlStore();
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [overrideLevel, setOverrideLevel] = useState('');
  const [runResult, setRunResult] = useState(null);

  const { data: flags, isLoading } = useQuery({
    queryKey: ['flags'],
    queryFn: api.getFlags,
  });

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: api.getDashboardStats,
  });

  const handleRunAnalysis = async () => {
    setAnalysisRunning(true);
    setRunResult(null);
    try {
      const result = await api.runAnalysis();
      setRunResult(result);
      queryClient.invalidateQueries({ queryKey: ['flags'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } finally {
      setAnalysisRunning(false);
    }
  };

  const handleOverride = async () => {
    if (!overrideTarget || !overrideLevel) return;
    await api.overrideFlagLevel(overrideTarget.entityId, overrideLevel);
    setOverrideTarget(null);
    setOverrideLevel('');
    queryClient.invalidateQueries({ queryKey: ['flags'] });
  };

  const active = flags?.filter(f => !f.resolvedAt) || [];
  const resolved = flags?.filter(f => f.resolvedAt) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Admin Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Run Analysis */}
        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Analysis Pipeline</h3>
              <p className="text-xs text-gray-500 mt-0.5">Trigger full graph analysis: cycles, volumes, cash flow ratios</p>
            </div>
            <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
          {stats && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-navy-800 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-red-400">{stats.criticalAlerts}</p>
                <p className="text-[11px] text-gray-500">Critical</p>
              </div>
              <div className="bg-navy-800 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-white">{stats.entitiesFlagged}</p>
                <p className="text-[11px] text-gray-500">Flagged</p>
              </div>
            </div>
          )}
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalysisRunning}
            className="btn-primary w-full justify-center"
          >
            <RefreshCw className={`w-4 h-4 ${isAnalysisRunning ? 'animate-spin' : ''}`} />
            {isAnalysisRunning ? 'Analysis Running...' : 'Run Full Analysis'}
          </button>
          {runResult && (
            <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-green-300">
                <p className="font-semibold">Analysis Complete</p>
                <p>{runResult.cyclesFound} cycles found · {runResult.entitiesFlagged} entities flagged</p>
              </div>
            </div>
          )}
        </div>

        {/* Flag Override */}
        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Manual Flag Override</h3>
              <p className="text-xs text-gray-500 mt-0.5">Admin can override any entity's flag level (PATCH /api/flags/:id)</p>
            </div>
            <div className="w-8 h-8 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
            </div>
          </div>
          <div className="space-y-2">
            <select
              className="input-base w-full"
              value={overrideTarget?.entityId || ''}
              onChange={e => {
                const f = flags?.find(fe => fe.entityId === e.target.value);
                setOverrideTarget(f);
              }}
            >
              <option value="">Select entity...</option>
              {active.map(f => (
                <option key={f.id} value={f.entityId}>{f.entityName} ({f.entityType})</option>
              ))}
            </select>
            <select
              className="input-base w-full"
              value={overrideLevel}
              onChange={e => setOverrideLevel(e.target.value)}
              disabled={!overrideTarget}
            >
              <option value="">Set flag level...</option>
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'].map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <button
              onClick={handleOverride}
              disabled={!overrideTarget || !overrideLevel}
              className="btn-danger w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <AlertTriangle className="w-4 h-4" />
              Apply Override
            </button>
          </div>
        </div>
      </div>

      {/* Active Flags Table */}
      <div className="card p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-white">Active Flags</h3>
            <span className="badge-critical">{active.length}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-navy-800/40 border-b border-white/5">
              <tr>
                <th className="table-header">Entity</th>
                <th className="table-header">Type</th>
                <th className="table-header">Risk Level</th>
                <th className="table-header">Reason</th>
                <th className="table-header">Triggered By</th>
                <th className="table-header">Time</th>
                <th className="table-header">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="table-cell"><div className="h-4 bg-white/5 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : active.map(flag => {
                const Icon = ENTITY_ICONS[flag.entityType] || Building2;
                return (
                  <tr key={flag.id} className={`${
                    flag.flagLevel === 'CRITICAL' ? 'row-critical' :
                    flag.flagLevel === 'HIGH' ? 'row-high' :
                    flag.flagLevel === 'MEDIUM' ? 'row-medium' : 'row-low'
                  } hover:bg-white/3 transition-colors`}>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                        <span className="font-medium text-white">{flag.entityName}</span>
                      </div>
                    </td>
                    <td className="table-cell text-gray-400">{flag.entityType}</td>
                    <td className="table-cell"><DangerBadge level={flag.flagLevel} /></td>
                    <td className="table-cell max-w-xs">
                      <p className="text-xs text-gray-400 truncate" title={flag.reason}>{flag.reason}</p>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs font-mono bg-navy-800 px-1.5 py-0.5 rounded text-indigo-400">
                        {flag.triggeredBy}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(flag.createdAt), { addSuffix: true })}
                      </div>
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => { setOverrideTarget(flag); }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                      >
                        Override
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolved Flags */}
      {resolved.length > 0 && (
        <div className="card p-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-white">Resolved Flags</h3>
            <span className="text-xs text-gray-500">{resolved.length}</span>
          </div>
          <div className="divide-y divide-white/5">
            {resolved.map(flag => {
              const Icon = ENTITY_ICONS[flag.entityType] || Building2;
              return (
                <div key={flag.id} className="flex items-center justify-between px-4 py-3 opacity-60">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm text-gray-400">{flag.entityName}</span>
                    <DangerBadge level={flag.flagLevel} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    Resolved {format(new Date(flag.resolvedAt), 'MMM d')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
