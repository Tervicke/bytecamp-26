import { X, Building2, User, CreditCard, AlertTriangle, Hash } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAmlStore } from '../../store/aml.store';
import DangerBadge from '../transactions/DangerBadge';

const TYPE_ICONS = {
  company: Building2,
  person: User,
  account: CreditCard,
};

export default function NodeDetailPanel() {
  const { selectedNodeId, isDetailPanelOpen, clearSelection } = useAmlStore();

  const { data: entity, isLoading } = useQuery({
    queryKey: ['entity', selectedNodeId],
    queryFn: () => api.getEntity(selectedNodeId),
    enabled: !!selectedNodeId,
  });

  if (!isDetailPanelOpen) return null;

  const TypeIcon = TYPE_ICONS[entity?.type] || Hash;

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 z-10" onClick={clearSelection} />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-80 bg-navy-800 border-l border-white/10 z-20 animate-slide-in flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <TypeIcon className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">Entity Detail</span>
          </div>
          <button onClick={clearSelection} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          ) : entity ? (
            <>
              {/* Name + flag */}
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-white leading-tight">{entity.name}</h3>
                  <DangerBadge level={entity.flagLevel} />
                </div>
                <p className="text-xs text-gray-500 font-mono">{entity.id}</p>
              </div>

              {/* Flag reasons */}
              {entity.flagReasons?.length > 0 && (
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs font-semibold text-red-400">Flag Reasons</span>
                  </div>
                  <ul className="space-y-1">
                    {entity.flagReasons.map(r => (
                      <li key={r} className="text-xs text-gray-400 flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                        {r.replace(/_/g, ' ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Properties */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Properties</h4>
                {entity.jurisdiction && (
                  <DetailRow label="Jurisdiction" value={entity.jurisdiction} />
                )}
                {entity.registrationNumber && (
                  <DetailRow label="Reg. Number" value={entity.registrationNumber} mono />
                )}
                {entity.nationality && (
                  <DetailRow label="Nationality" value={entity.nationality} />
                )}
                {entity.role && (
                  <DetailRow label="Role" value={entity.role} />
                )}
                {entity.bankName && (
                  <DetailRow label="Bank" value={entity.bankName} />
                )}
                {entity.accountNumber && (
                  <DetailRow label="Account" value={entity.accountNumber} mono />
                )}
                {entity.currency && (
                  <DetailRow label="Currency" value={entity.currency} />
                )}
                {entity.balance !== undefined && (
                  <DetailRow label="Balance" value={`$${entity.balance.toLocaleString()}`} />
                )}
                {entity.cashFlowRatio !== undefined && (
                  <DetailRow
                    label="Cash Flow Ratio"
                    value={`${(entity.cashFlowRatio * 100).toFixed(0)}%`}
                    highlight={entity.cashFlowRatio >= 0.7}
                  />
                )}
                {entity.txnCount30d !== undefined && (
                  <DetailRow
                    label="Txns (30d)"
                    value={entity.txnCount30d}
                    highlight={entity.txnCount30d >= 10}
                  />
                )}
                {entity.layer !== null && entity.layer !== undefined && (
                  <DetailRow label="Propagation Layer" value={`Layer ${entity.layer}`} />
                )}
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-sm text-center pt-8">Entity not found</p>
          )}
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value, mono, highlight }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-medium ${mono ? 'font-mono' : ''} ${highlight ? 'text-red-400' : 'text-gray-200'}`}>
        {value}
      </span>
    </div>
  );
}
