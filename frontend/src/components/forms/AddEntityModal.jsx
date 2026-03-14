import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Building2, User, CreditCard, X } from 'lucide-react';

export default function AddEntityModal({ type, onClose }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    jurisdiction: '',
    registrationNumber: '',
    incorporatedDate: '',
    companyType: '',
    industry: '',
    address: '',
    isShell: false,

    // Person specific
    nationality: '',
    dob: '',
    passportNumber: '',
    email: '',
    phone: '',
    role: '',

    // Bank Account specific
    accountNumber: '',
    bankName: '',
    bankCountry: '',
    currency: 'USD',
    balance: '',
    companyId: '',
    accountType: '',
    swiftCode: '',

    flagLevel: 'NONE',
  });

  const mutationQueryFn = type === 'companies'
    ? api.createCompany
    : type === 'persons'
      ? api.createPerson
      : api.createBankAccount;

  const queryKey = type === 'companies' ? ['companies'] : type === 'persons' ? ['persons'] : ['accounts'];

  const mutation = useMutation({
    mutationFn: mutationQueryFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      onClose();
    },
    onError: (err) => {
      setError(err.message);
      setLoading(false);
    }
  });

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    mutation.mutate(formData);
  };

  const TypeIcon = type === 'companies' ? Building2 : type === 'persons' ? User : CreditCard;
  const title = type === 'companies' ? 'Add Company' : type === 'persons' ? 'Add Person' : 'Add Bank Account';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-navy-800 rounded-xl border border-white/10 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-navy-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <TypeIcon className="w-4 h-4 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
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

          <form id="entity-form" onSubmit={handleSubmit} className="space-y-4">

            {(type === 'companies' || type === 'persons') && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Name *</label>
                <input required type="text" name="name" value={formData.name} onChange={handleChange} className="input-base w-full" />
              </div>
            )}

            {type === 'companies' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Jurisdiction</label>
                    <input type="text" name="jurisdiction" value={formData.jurisdiction} onChange={handleChange} className="input-base w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Registration #</label>
                    <input type="text" name="registrationNumber" value={formData.registrationNumber} onChange={handleChange} className="input-base w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Company Type (e.g. LLC)</label>
                    <input type="text" name="companyType" value={formData.companyType} onChange={handleChange} className="input-base w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Industry</label>
                    <input type="text" name="industry" value={formData.industry} onChange={handleChange} className="input-base w-full" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-300 mt-2 cursor-pointer">
                  <input type="checkbox" name="isShell" checked={formData.isShell} onChange={handleChange} className="rounded border-white/10 bg-navy-900 text-indigo-500" />
                  Mark as Shell Company
                </label>
              </>
            )}

            {type === 'persons' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Nationality</label>
                    <input type="text" name="nationality" value={formData.nationality} onChange={handleChange} className="input-base w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Role</label>
                    <select name="role" value={formData.role} onChange={handleChange} className="input-base w-full">
                      <option value="">Select Role</option>
                      <option value="director">Director</option>
                      <option value="beneficial_owner">Beneficial Owner</option>
                      <option value="nominee_director">Nominee Director</option>
                      <option value="shareholder">Shareholder</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} className="input-base w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Passport Number</label>
                    <input type="text" name="passportNumber" value={formData.passportNumber} onChange={handleChange} className="input-base w-full" />
                  </div>
                </div>
              </>
            )}

            {type === 'accounts' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Account Number *</label>
                    <input required type="text" name="accountNumber" value={formData.accountNumber} onChange={handleChange} className="input-base w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Bank Name</label>
                    <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} className="input-base w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Currency</label>
                    <select name="currency" value={formData.currency} onChange={handleChange} className="input-base w-full">
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CHF">CHF</option>
                      <option value="SGD">SGD</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Initial Balance</label>
                    <input type="number" step="0.01" name="balance" value={formData.balance} onChange={handleChange} className="input-base w-full font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Link to Company ID</label>
                  <input type="text" name="companyId" value={formData.companyId} onChange={handleChange} placeholder="e.g. c001" className="input-base w-full font-mono text-sm" />
                </div>
              </>
            )}

          </form>
        </div>

        <div className="p-4 border-t border-white/10 bg-navy-900/50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            form="entity-form"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : title}
          </button>
        </div>
      </div>
    </div>
  );
}
