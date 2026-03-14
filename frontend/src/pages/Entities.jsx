import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAmlStore } from '../store/aml.store';
import DangerBadge from '../components/transactions/DangerBadge';
import { Building2, User, CreditCard, AlertTriangle, Globe, Hash, TrendingUp } from 'lucide-react';

const TABS = [
  { id: 'companies', label: 'Companies', icon: Building2 },
  { id: 'persons', label: 'Persons', icon: User },
  { id: 'accounts', label: 'Bank Accounts', icon: CreditCard },
];

export default function Entities() {
  const { entityTab, setEntityTab } = useAmlStore();
  const [flagFilter, setFlagFilter] = useState('ALL');

  const { data: companies, isLoading: cLoading } = useQuery({ queryKey: ['companies'], queryFn: api.getCompanies });
  const { data: persons, isLoading: pLoading } = useQuery({ queryKey: ['persons'], queryFn: api.getPersons });
  const { data: accounts, isLoading: aLoading } = useQuery({ queryKey: ['accounts'], queryFn: api.getBankAccounts });

  const currentData = entityTab === 'companies' ? companies : entityTab === 'persons' ? persons : accounts;
  const isLoading = entityTab === 'companies' ? cLoading : entityTab === 'persons' ? pLoading : aLoading;

  const filtered = (currentData || []).filter(e => flagFilter === 'ALL' || e.flagLevel === flagFilter);
  const sortedFiltered = [...filtered].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 };
    return (order[a.flagLevel] ?? 5) - (order[b.flagLevel] ?? 5);
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-navy-800 rounded-xl border border-white/5 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setEntityTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              entityTab === id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              entityTab === id ? 'bg-white/20' : 'bg-white/5'
            }`}>
              {id === 'companies' ? companies?.length : id === 'persons' ? persons?.length : accounts?.length}
            </span>
          </button>
        ))}
      </div>

      {/* Flag filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'].map(f => (
          <button
            key={f}
            onClick={() => setFlagFilter(f)}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-all duration-200 ${
              flagFilter === f ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/20'
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-500">{sortedFiltered.length} entities</span>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-36 animate-pulse bg-white/5" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedFiltered.map(entity => (
            <EntityCard key={entity.id} entity={entity} type={entityTab} />
          ))}
        </div>
      )}
    </div>
  );
}

function EntityCard({ entity, type }) {
  const [expanded, setExpanded] = useState(false);

  const borderColor = {
    CRITICAL: 'border-red-500/40 shadow-red-500/10',
    HIGH: 'border-orange-500/30',
    MEDIUM: 'border-yellow-500/20',
    LOW: 'border-blue-500/20',
    NONE: 'border-white/5',
  }[entity.flagLevel] || 'border-white/5';

  const TypeIcon = type === 'companies' ? Building2 : type === 'persons' ? User : CreditCard;

  return (
    <div className={`card-hover border ${borderColor} cursor-pointer transition-all duration-200 ${entity.flagLevel === 'CRITICAL' ? 'shadow-lg' : ''}`}
         onClick={() => setExpanded(e => !e)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            entity.flagLevel === 'CRITICAL' ? 'bg-red-500/20' :
            entity.flagLevel === 'HIGH' ? 'bg-orange-500/20' :
            entity.flagLevel === 'MEDIUM' ? 'bg-yellow-500/20' :
            'bg-white/5'
          }`}>
            <TypeIcon className={`w-4 h-4 ${
              entity.flagLevel === 'CRITICAL' ? 'text-red-400' :
              entity.flagLevel === 'HIGH' ? 'text-orange-400' :
              entity.flagLevel === 'MEDIUM' ? 'text-yellow-400' :
              'text-gray-400'
            }`} />
          </div>
          <h3 className="text-sm font-semibold text-white truncate">{entity.name}</h3>
        </div>
        <DangerBadge level={entity.flagLevel} />
      </div>

      {/* Properties */}
      <div className="space-y-1 text-xs text-gray-400">
        {entity.jurisdiction && (
          <div className="flex items-center gap-1.5">
            <Globe className="w-3 h-3" />
            <span>{entity.jurisdiction}</span>
          </div>
        )}
        {entity.nationality && (
          <div className="flex items-center gap-1.5">
            <Globe className="w-3 h-3" />
            <span>{entity.nationality} · {entity.role}</span>
          </div>
        )}
        {entity.bankName && (
          <div className="flex items-center gap-1.5">
            <CreditCard className="w-3 h-3" />
            <span className="truncate">{entity.bankName}</span>
          </div>
        )}
        {entity.balance !== undefined && (
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" />
            <span>${entity.balance.toLocaleString()} {entity.currency}</span>
          </div>
        )}
        {entity.registrationNumber && (
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-500">
            <Hash className="w-3 h-3" />
            <span>{entity.registrationNumber}</span>
          </div>
        )}
      </div>

      {/* Flag reasons */}
      {entity.flagReasons?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-1 mb-1.5">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="text-[11px] font-semibold text-red-400">Flag Reasons</span>
          </div>
          {expanded ? (
            <div className="flex flex-wrap gap-1">
              {entity.flagReasons.map(r => (
                <span key={r} className="text-[11px] bg-red-500/10 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5">
                  {r.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              <span className="text-[11px] bg-red-500/10 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5">
                {entity.flagReasons[0].replace(/_/g, ' ')}
              </span>
              {entity.flagReasons.length > 1 && (
                <span className="text-[11px] text-gray-500">+{entity.flagReasons.length - 1} more</span>
              )}
            </div>
          )}
        </div>
      )}

      {entity.cashFlowRatio !== undefined && entity.cashFlowRatio >= 0.7 && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-400">
          <AlertTriangle className="w-3 h-3" />
          Cash ratio: {(entity.cashFlowRatio * 100).toFixed(0)}% ≥ 70% threshold
        </div>
      )}
    </div>
  );
}
