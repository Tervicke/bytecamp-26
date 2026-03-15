import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAmlStore } from '../../store/aml.store';
import DangerBadge, { rowClass } from './DangerBadge';
import { ChevronUp, ChevronDown, Eye, GitBranch, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const FLAG_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 };

export default function TransactionTable({ showOnlySuspicious = false }) {
  const { flagFilter, searchQuery, openTrail, selectTransaction } = useAmlStore();
  const [sortBy, setSortBy] = useState('txnDate');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', flagFilter, searchQuery, page, pageSize],
    queryFn: () => api.getTransactions({
      flagLevel: showOnlySuspicious ? 'CRITICAL' : flagFilter,
      search: searchQuery,
      page,
      limit: pageSize
    }),
  });

  const transactions = data?.transactions || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const sorted = [...transactions].sort((a, b) => {
    let av = a[sortBy], bv = b[sortBy];
    if (sortBy === 'flagLevel') { av = FLAG_ORDER[a.flagLevel]; bv = FLAG_ORDER[b.flagLevel]; }
    if (sortBy === 'amount') { av = parseFloat(a.amount); bv = parseFloat(b.amount); }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ChevronUp className="w-3 h-3 opacity-20" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-indigo-400" /> : <ChevronDown className="w-3 h-3 text-indigo-400" />;
  };

  const handleViewTrail = (e, txn) => {
    e.stopPropagation();
    openTrail(txn.id);
    selectTransaction(txn);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-navy-800/60 border-b border-white/5">
            <tr>
              <th className="table-header w-8" />
              {[
                { col: 'id', label: 'TXN ID' },
                { col: 'fromAccountName', label: 'From Account' },
                { col: 'toAccountName', label: 'To Account' },
                { col: 'amount', label: 'Amount' },
                { col: 'txnType', label: 'Type' },
                { col: 'txnDate', label: 'Date' },
                { col: 'flagLevel', label: 'Risk Level' },
              ].map(({ col, label }) => (
                <th
                  key={col}
                  className="table-header cursor-pointer hover:text-gray-300 select-none"
                  onClick={() => toggleSort(col)}
                >
                  <div className="flex items-center gap-1">
                    {label}
                    <SortIcon col={col} />
                  </div>
                </th>
              ))}
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="table-cell">
                      <div className="h-4 bg-white/5 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="table-cell text-center text-gray-500 py-12">
                  No transactions found
                </td>
              </tr>
            ) : (
              sorted.map(txn => (
                <tr
                  key={txn.id}
                  className={`${rowClass(txn.flagLevel)} cursor-pointer hover:bg-white/3 transition-colors duration-200 group`}
                  onClick={() => selectTransaction(txn)}
                >
                  {/* Pulse indicator */}
                  <td className="pl-4">
                    {txn.isSuspicious && (
                      <span className={`inline-block w-2 h-2 rounded-full ${txn.flagLevel === 'CRITICAL' ? 'bg-red-500 animate-pulse' :
                          txn.flagLevel === 'HIGH' ? 'bg-orange-500' : 'bg-yellow-500'
                        }`} />
                    )}
                  </td>
                  <td className="table-cell font-mono text-xs text-indigo-400">{txn.id}</td>
                  <td className="table-cell">
                    <span className="font-mono text-xs bg-navy-800 px-1.5 py-0.5 rounded text-gray-300">
                      {txn.fromAccountName}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-gray-600" />
                      <span className="font-mono text-xs bg-navy-800 px-1.5 py-0.5 rounded text-gray-300">
                        {txn.toAccountName}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell font-semibold tabular-nums">
                    <span className={txn.isSuspicious ? 'text-white' : 'text-gray-400'}>
                      ${Number(txn.amount).toLocaleString()}
                    </span>
                    &nbsp;<span className="text-xs text-gray-500">{txn.currency}</span>
                  </td>
                  <td className="table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${txn.txnType === 'cash' ? 'bg-orange-500/20 text-orange-400' :
                        txn.txnType === 'wire' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                      }`}>
                      {txn.txnType.toUpperCase()}
                    </span>
                  </td>
                  <td className="table-cell text-xs text-gray-400">
                    {format(new Date(txn.txnDate), 'MMM d, HH:mm')}
                  </td>
                  <td className="table-cell">
                    <DangerBadge level={txn.flagLevel} />
                  </td>
                  <td className="table-cell">
                    {txn.isSuspicious && (
                      <button
                        onClick={(e) => handleViewTrail(e, txn)}
                        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                        View Trail
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Footer */}
      <div className="px-4 py-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-gray-500">
          {totalCount > 0 ? (
            <>
              Showing <span className="text-gray-300">{(page - 1) * pageSize + 1}</span> to <span className="text-gray-300">{Math.min(page * pageSize, totalCount)}</span> of <span className="text-gray-300">{totalCount}</span> transactions
              {transactions.filter(t => t.isSuspicious).length > 0 && (
                <span className="ml-2 text-red-400">
                  · {transactions.filter(t => t.isSuspicious).length} suspicious on this page
                </span>
              )}
            </>
          ) : (
            'No transactions to show'
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-white/5 bg-navy-800 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                let pageNum;
                if (totalPages <= 5) pageNum = i + 1;
                else if (page <= 3) pageNum = i + 1;
                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = page - 2 + i;

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`min-w-[32px] h-8 text-xs font-medium rounded-lg transition-all duration-200 ${page === pageNum
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-white/5 bg-navy-800 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
