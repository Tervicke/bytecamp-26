import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ArrowLeftRight, X } from 'lucide-react';

export default function AddTransactionModal({ onClose }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    currency: 'USD',
    txnDate: new Date().toISOString().slice(0, 16),
    txnType: 'wire',
    description: '',
    referenceNumber: '',
  });

  const mutation = useMutation({
    mutationFn: api.createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onClose();
    },
    onError: (err) => {
      setError(err.message);
      setLoading(false);
    }
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Convert datetime-local to ISO full format
    const payload = {
       ...formData,
       txnDate: new Date(formData.txnDate).toISOString()
    };
    
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-navy-800 rounded-xl border border-white/10 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-navy-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Manual Transaction Entry</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors">
             <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form id="txn-form" onSubmit={handleSubmit} className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">From Account ID *</label>
                  <input required type="text" name="fromAccountId" value={formData.fromAccountId} onChange={handleChange} placeholder="ba001" className="input-base w-full font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">To Account ID *</label>
                  <input required type="text" name="toAccountId" value={formData.toAccountId} onChange={handleChange} placeholder="ba005" className="input-base w-full font-mono" />
                </div>
             </div>

             <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1">Amount *</label>
                  <input required type="number" step="0.01" min="0" name="amount" value={formData.amount} onChange={handleChange} className="input-base w-full font-mono" />
                </div>
                <div className="col-span-1">
                   <label className="block text-xs font-medium text-gray-400 mb-1">Currency</label>
                   <select name="currency" value={formData.currency} onChange={handleChange} className="input-base w-full">
                     <option value="USD">USD</option>
                     <option value="EUR">EUR</option>
                     <option value="GBP">GBP</option>
                     <option value="CHF">CHF</option>
                     <option value="SGD">SGD</option>
                     <option value="HKD">HKD</option>
                   </select>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Transaction Type</label>
                  <select name="txnType" value={formData.txnType} onChange={handleChange} className="input-base w-full">
                     <option value="wire">Wire Transfer</option>
                     <option value="cash">Cash Deposit/Withdrawal</option>
                     <option value="crypto">Cryptocurrency</option>
                     <option value="internal">Internal Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Date & Time *</label>
                  <input required type="datetime-local" name="txnDate" value={formData.txnDate} onChange={handleChange} className="input-base w-full" />
                </div>
             </div>

             <div>
               <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
               <input type="text" name="description" value={formData.description} onChange={handleChange} className="input-base w-full" placeholder="Invoice payment INV-001" />
             </div>

             <div>
               <label className="block text-xs font-medium text-gray-400 mb-1">Reference Number</label>
               <input type="text" name="referenceNumber" value={formData.referenceNumber} onChange={handleChange} className="input-base w-full font-mono text-sm" placeholder="REF-XYZ-123" />
             </div>
          </form>
        </div>

        <div className="p-4 border-t border-white/10 bg-navy-900/50 flex justify-end gap-3">
           <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">
             Cancel
           </button>
           <button 
             type="submit" 
             form="txn-form"
             disabled={loading}
             className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
           >
             {loading ? 'Processing...' : 'Submit Transaction'}
           </button>
        </div>
      </div>
    </div>
  );
}
