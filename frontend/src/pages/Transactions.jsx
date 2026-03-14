import { useState } from 'react';
import { useAmlStore } from '../store/aml.store';
import TransactionTable from '../components/transactions/TransactionTable';
import TransactionTrail from '../components/transactions/TransactionTrail';
import AddTransactionModal from '../components/forms/AddTransactionModal';
import { Search, Filter, AlertTriangle, ArrowLeftRight, Plus, CheckCircle, Upload, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const FLAG_FILTERS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];
const FLAG_COLORS = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30',
  HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30',
  MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30',
  LOW: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30',
  NONE: 'bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30',
  ALL: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/30',
};

export default function Transactions() {
  const { flagFilter, setFlagFilter, searchQuery, setSearchQuery, isTrailOpen } = useAmlStore();
  const [localSearch, setLocalSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const [uploadStatus, setUploadStatus] = useState(null); // null, 'success', 'error'

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: api.getDashboardStats,
  });

  const handleSearch = (e) => {
    const val = e.target.value;
    setLocalSearch(val);
    setSearchQuery(val);
  };

  const uploadMutation = useMutation({
    mutationFn: (file) => api.uploadTransactionsCSV(file),
    onSuccess: (data) => {
      setUploadStatus('success');
      // Prepend new transactions to actively viewed table cache
      if (data.transactions && data.transactions.length > 0) {
        const formattedTxns = data.transactions.map(t => ({
          ...t,
          fromAccountName: t.fromAccountName || t.fromAccountId,
          toAccountName: t.toAccountName || t.toAccountId
        }));
        queryClient.setQueryData(['transactions', flagFilter, searchQuery], (old) => {
          if (!old) return formattedTxns;
          const existingIds = new Set(old.map(t => t.id));
          const newTxns = formattedTxns.filter(t => !existingIds.has(t.id));
          return [...newTxns, ...old];
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      }
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setTimeout(() => setUploadStatus(null), 3000);
    },
    onError: (err) => {
      console.error(err);
      setUploadStatus('error');
      setTimeout(() => setUploadStatus(null), 3000);
    }
  });

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file);
    // Reset input so the same file could be uploaded again
    e.target.value = '';
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500 mt-1">
            Track all financial transfers. Vulnerable transactions are highlighted with danger indicators.
          </p>
        </div>
        {stats && (
          <div className="flex items-center gap-3 flex-shrink-0">
            {uploadStatus === 'success' && (
              <span className="text-xs text-green-400 flex items-center gap-1 animate-fade-in">
                <CheckCircle className="w-3.5 h-3.5" /> Uploaded
              </span>
            )}
            {uploadStatus === 'error' && (
              <span className="text-xs text-red-400 flex items-center gap-1 animate-fade-in">
                <AlertTriangle className="w-3.5 h-3.5" /> Failed
              </span>
            )}
            
            <div className="relative">
              <input 
                type="file" 
                accept=".csv"
                id="csv-upload"
                className="hidden" 
                onChange={handleFileUpload}
                disabled={uploadMutation.isPending}
              />
              <label 
                htmlFor="csv-upload" 
                className={`btn-primary text-xs cursor-pointer ${uploadMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {uploadMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploadMutation.isPending ? 'Uploading...' : 'Upload CSV'}
              </label>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-red-400 font-medium">{stats.criticalAlerts} critical</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-700 border border-white/5">
              <ArrowLeftRight className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-400">{stats.totalTransactions} total</span>
            </div>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Transaction
            </button>
          </div>
        )}
      </div>

      {/* Danger legend */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-navy-700/50 border border-white/5 text-xs text-gray-400 flex-wrap">
        <span className="font-medium text-gray-300">Row highlighting:</span>
        <div className="flex items-center gap-1.5"><span className="w-8 h-2 rounded bg-red-500/40 border-l-2 border-red-500 animate-pulse"></span>CRITICAL — pulsing red</div>
        <div className="flex items-center gap-1.5"><span className="w-8 h-2 rounded bg-orange-500/20 border-l-2 border-orange-500"></span>HIGH — orange</div>
        <div className="flex items-center gap-1.5"><span className="w-8 h-2 rounded bg-yellow-500/10 border-l-2 border-yellow-500"></span>MEDIUM — yellow</div>
        <div className="flex items-center gap-1.5"><span className="w-8 h-2 rounded bg-blue-500/10 border-l-2 border-blue-500"></span>LOW — blue</div>
        <div className="ml-auto text-gray-500">Hover row → View Trail</div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by ID or description..."
            value={localSearch}
            onChange={handleSearch}
            className="input-base w-full pl-9"
          />
        </div>

        {/* Flag level filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-gray-500" />
          {FLAG_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFlagFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all duration-200 ${
                flagFilter === f
                  ? (FLAG_COLORS[f] || 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30') + ' ring-1 ring-current'
                  : 'bg-transparent text-gray-500 border-white/10 hover:border-white/20 hover:text-gray-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <TransactionTable />

      {/* Trail modal */}
      <TransactionTrail />

      {/* Manual Entry modal */}
      {isModalOpen && <AddTransactionModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}
