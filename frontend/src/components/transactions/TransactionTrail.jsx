import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAmlStore } from '../../store/aml.store';
import { X, AlertTriangle, GitBranch, DollarSign } from 'lucide-react';
import GraphVisualization from '../graph/GraphVisualization';
import DangerBadge from './DangerBadge';
import { format } from 'date-fns';

export default function TransactionTrail() {
  const { trailTransactionId, isTrailOpen, closeTrail, openTrail, selectedTransaction, selectTransaction } = useAmlStore();

  const { data: trail, isLoading } = useQuery({
    queryKey: ['trail', trailTransactionId],
    queryFn: () => api.getTransactionTrail(trailTransactionId),
    enabled: !!trailTransactionId && isTrailOpen,
  });

  // Use the transaction already stored in Zustand (set when clicking "View Trail" in the table)
  const txn = selectedTransaction;

  // Related transactions come from the trail API response, not mock data
  // trail.relatedTransactions is an array of transaction objects from the backend
  const relatedTxns = Array.isArray(trail?.relatedTransactions)
    ? trail.relatedTransactions.filter(Boolean)
    : [];

  if (!isTrailOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeTrail} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-5xl max-h-[90vh] bg-navy-800 border border-white/10 rounded-2xl shadow-2xl flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Transaction Trail</h2>
              <p className="text-xs text-gray-500 font-mono">{trailTransactionId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {txn && <DangerBadge level={txn.flagLevel} />}
            <button onClick={closeTrail} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Graph panel */}
          <div className="flex-1 p-4 overflow-hidden">
            {isLoading ? (
              <div className="h-80 bg-white/5 rounded-xl animate-pulse flex items-center justify-center">
                <p className="text-gray-500 text-sm">Loading trail graph...</p>
              </div>
            ) : trail ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                    Suspicious Fund Flow Network
                  </span>
                </div>
                <GraphVisualization
                  graphData={trail}
                  height={340}
                />
                {/* Legend */}
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-0.5 bg-red-500" />
                    <span>Cycle path</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500" />
                    <span>Critical entity</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-red-500/30 transform rotate-45 inline-block" />
                    <span>Person</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-indigo-500/50" />
                    <span>Bank Account</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center">
                <p className="text-gray-500 text-sm">No trail data available for this transaction.</p>
              </div>
            )}
          </div>

          {/* Right sidebar - details */}
          <div className="w-72 border-l border-white/5 flex flex-col overflow-hidden">
            {/* Transaction summary */}
            {txn && (
              <div className="p-4 border-b border-white/5 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction Details</h3>
                <div className="space-y-2">
                  <InfoRow label="Amount" value={`$${Number(txn.amount).toLocaleString()} ${txn.currency}`} highlight />
                  <InfoRow label="Type" value={txn.txnType?.toUpperCase()} />
                  <InfoRow label="Date" value={txn.txnDate ? format(new Date(txn.txnDate), 'MMM d, yyyy HH:mm') : '—'} />
                  <InfoRow label="From" value={txn.fromAccountName || txn.fromAccountId || '—'} />
                  <InfoRow label="To" value={txn.toAccountName || txn.toAccountId || '—'} />
                  <InfoRow label="Description" value={txn.description} />
                  {txn.flagReasons?.length > 0 && (
                    <div className="pt-1">
                      <p className="text-xs text-gray-500 mb-1">Flag reasons:</p>
                      {txn.flagReasons.map(r => (
                        <span key={r} className="inline-block text-[11px] bg-red-500/10 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5 mr-1 mb-1">
                          {r.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Related suspicious transactions */}
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Related Transactions ({relatedTxns.length})
              </h3>
              {relatedTxns.length === 0 ? (
                <p className="text-xs text-gray-600">
                  {isLoading ? 'Loading...' : 'No related transactions'}
                </p>
              ) : (
                <div className="space-y-2">
                  {relatedTxns.map(rt => (
                    <button
                      key={rt.id}
                      onClick={() => {
                        openTrail(rt.id);
                        selectTransaction(rt);
                      }}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all duration-200 hover:border-white/20 cursor-pointer ${
                        rt.flagLevel === 'CRITICAL' ? 'bg-red-500/5 border-red-500/20' :
                        rt.flagLevel === 'HIGH' ? 'bg-orange-500/5 border-orange-500/20' :
                        'bg-white/3 border-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-mono text-indigo-400">{rt.id}</span>
                        <DangerBadge level={rt.flagLevel?.toUpperCase()} />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <DollarSign className="w-3 h-3" />
                        ${Number(rt.amount).toLocaleString()} {rt.currency}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">{rt.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className={`text-xs text-right ${highlight ? 'text-white font-semibold' : 'text-gray-300'}`}>{value}</span>
    </div>
  );
}
