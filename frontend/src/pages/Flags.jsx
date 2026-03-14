import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAmlStore } from '../store/aml.store';
import DangerBadge from '../components/transactions/DangerBadge';
import { AlertTriangle, RefreshCw, CheckCircle, Building2, User, CreditCard, Clock, Shield, Search } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const ENTITY_ICONS = { Company: Building2, Person: User, BankAccount: CreditCard };

export default function Flags() {
  const queryClient = useQueryClient();
  const { isAnalysisRunning, setAnalysisRunning } = useAmlStore();
  
  // Tabs & Pagination state
  const [currentTab, setCurrentTab] = useState('ALL'); // ALL, Company, Person, BankAccount
  const [page, setPage] = useState(1);
  const limit = 10;

  // Manual Override state
  const [overrideType, setOverrideType] = useState(''); // Target type first
  const [overrideTargetId, setOverrideTargetId] = useState(''); // Selected entity ID from dropdown
  const [overrideLevel, setOverrideLevel] = useState('');
  const [runResult, setRunResult] = useState(null);

  // Fetch flagged entities for the table
  const { data: flagData, isLoading } = useQuery({
    queryKey: ['flags', currentTab, page],
    queryFn: () => api.getFlags({ type: currentTab, page, limit }),
  });

  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: api.getDashboardStats,
  });

  // Fetch ALL entities of the selected type for the manual override dropdown
  const { data: entityOptions = [], isLoading: isLoadingOptions } = useQuery({
    queryKey: ['entities-list', overrideType],
    queryFn: async () => {
      if (!overrideType) return [];
      if (overrideType === 'Company') return api.getCompanies();
      if (overrideType === 'Person') return api.getPersons();
      if (overrideType === 'BankAccount') return api.getBankAccounts();
      return [];
    },
    enabled: !!overrideType,
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
    if (!overrideTargetId || !overrideLevel) return;
    try {
      await api.overrideFlagLevel(overrideTargetId, overrideLevel);
      setOverrideTargetId('');
      setOverrideType('');
      setOverrideLevel('');
      queryClient.invalidateQueries({ queryKey: ['flags'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (err) {
      console.error("Override failed:", err);
    }
  };

  const flags = flagData?.flags || [];
  const total = flagData?.total || 0;
  const counts = flagData?.flaggedByType || dashboardStats?.flaggedByType || { Company: 0, Person: 0, BankAccount: 0 };
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Admin Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Run Analysis Panel */}
        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Analysis Pipeline</h3>
              <p className="text-xs text-gray-500 mt-0.5">Trigger full graph analysis & summary breakdown</p>
            </div>
            <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
          
          {dashboardStats ? (
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-navy-800 rounded-lg p-2.5 text-center border border-white/5">
                  <p className="text-lg font-bold text-red-400">{dashboardStats.criticalAlerts}</p>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Critical Alerts</p>
                </div>
                <div className="bg-navy-800 rounded-lg p-2.5 text-center border border-white/5">
                  <p className="text-lg font-bold text-white">{dashboardStats.entitiesFlagged}</p>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Total Flagged</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-navy-900/50 rounded-lg p-2 border border-white/5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Building2 className="w-3 h-3 text-indigo-400" />
                    <span className="text-[10px] text-gray-500">Companies</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{dashboardStats.flaggedByType?.Company || 0}</p>
                </div>
                <div className="bg-navy-900/50 rounded-lg p-2 border border-white/5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <User className="w-3 h-3 text-indigo-400" />
                    <span className="text-[10px] text-gray-500">Persons</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{dashboardStats.flaggedByType?.Person || 0}</p>
                </div>
                <div className="bg-navy-900/50 rounded-lg p-2 border border-white/5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CreditCard className="w-3 h-3 text-indigo-400" />
                    <span className="text-[10px] text-gray-500">Banks</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{dashboardStats.flaggedByType?.BankAccount || 0}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-24 bg-navy-800/50 rounded-lg animate-pulse mb-4" />
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

        {/* Two-Step Manual Flag Override */}
        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Manual Flag Override</h3>
              <p className="text-xs text-gray-500 mt-0.5">Override flags by selecting an entity category</p>
            </div>
            <div className="w-8 h-8 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
            </div>
          </div>
          <div className="space-y-3">
            {/* Step 1: Select Type */}
            <select
              className="input-base w-full"
              value={overrideType}
              onChange={e => {
                setOverrideType(e.target.value);
                setOverrideTargetId('');
              }}
            >
              <option value="">1. Choose Entity Type...</option>
              <option value="Company">Company</option>
              <option value="Person">Person</option>
              <option value="BankAccount">Bank Account</option>
            </select>

            {/* Step 2: Select Entity from fetched list */}
            <select
              className="input-base w-full disabled:opacity-50"
              value={overrideTargetId}
              onChange={e => setOverrideTargetId(e.target.value)}
              disabled={!overrideType || isLoadingOptions}
            >
              <option value="">
                {isLoadingOptions ? "Loading entities..." : `2. Select ${overrideType || 'Entity'}...`}
              </option>
              {entityOptions.map(ent => (
                <option key={ent.id} value={ent.id}>
                  {ent.name || ent.accountNumber || ent.id} ({ent.flagLevel || 'NONE'})
                </option>
              ))}
            </select>

            {overrideTargetId && (
              <div className="flex gap-3">
                <select
                  className="input-base flex-1"
                  value={overrideLevel}
                  onChange={e => setOverrideLevel(e.target.value)}
                >
                  <option value="">3. Set Risk Level...</option>
                  {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                <button
                  onClick={handleOverride}
                  disabled={!overrideLevel}
                  className="btn-danger flex-1 justify-center disabled:opacity-40"
                >
                  Apply Override
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs for Table */}
      <div className="flex items-center gap-1 p-1 bg-navy-800 rounded-xl border border-white/5 w-fit">
        {[
          { id: 'ALL', label: 'All Flags', count: counts.Company + counts.Person + counts.BankAccount },
          { id: 'Company', label: 'Companies', icon: Building2, count: counts.Company },
          { id: 'Person', label: 'Persons', icon: User, count: counts.Person },
          { id: 'BankAccount', label: 'Banks', icon: CreditCard, count: counts.BankAccount },
        ].map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => {
              setCurrentTab(id);
              setPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              currentTab === id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              currentTab === id ? 'bg-white/20' : 'bg-white/5'
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Flagged Entities Table */}
      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-navy-800/40 border-b border-white/5">
              <tr>
                <th className="table-header">Entity</th>
                <th className="table-header">Type</th>
                <th className="table-header">Level</th>
                <th className="table-header">Risk Reason</th>
                <th className="table-header">Source</th>
                <th className="table-header">Detected</th>
                <th className="table-header">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(isLoading) ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="table-cell"><div className="h-4 bg-white/5 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : flags.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center text-gray-500 py-12">
                    No active flags found for this category.
                  </td>
                </tr>
              ) : flags.map(flag => {
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
                    <td className="table-cell text-[10px] text-gray-400 uppercase tracking-tighter">{flag.entityType}</td>
                    <td className="table-cell"><DangerBadge level={flag.flagLevel} size="xs" /></td>
                    <td className="table-cell max-w-[200px]">
                      <p className="text-xs text-gray-400 truncate" title={flag.reason}>{flag.reason}</p>
                    </td>
                    <td className="table-cell">
                      <span className="text-[10px] font-mono bg-navy-800 px-1.5 py-0.5 rounded text-indigo-400">
                        {flag.triggeredBy}
                      </span>
                    </td>
                    <td className="table-cell text-[10px] text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(flag.createdAt), { addSuffix: true })}
                      </div>
                    </td>
                    <td className="table-cell font-medium">
                       <button 
                         onClick={() => {
                           setOverrideType(flag.entityType);
                           setOverrideTargetId(flag.entityId);
                           setOverrideLevel(flag.flagLevel);
                           window.scrollTo({ top: 0, behavior: 'smooth' });
                         }}
                         className="text-indigo-400 hover:text-indigo-300 text-xs"
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

        {/* Pagination Footer */}
        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 bg-navy-800/20 border-t border-white/5">
            <div className="text-xs text-gray-500">
              Showing <span className="text-white">{(page - 1) * limit + 1}</span> to <span className="text-white">{Math.min(page * limit, total)}</span> of <span className="text-white">{total}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 bg-navy-800 rounded border border-white/5 text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`px-3 py-1 rounded text-xs transition-colors ${
                    page === i + 1 ? 'bg-indigo-600 text-white' : 'bg-navy-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {i + 1}
                </button>
              )).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))}
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 bg-navy-800 rounded border border-white/5 text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
