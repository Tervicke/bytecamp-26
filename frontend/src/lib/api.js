/**
 * AML Shield — API Layer (Direct Backend Integration)
 * This connects to the real backend API.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Universal fetch wrapper for the real backend
 */
async function fetchApi(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.reload();
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText} (${response.status}) at ${endpoint}`);
  }
  return response.json();
}

/**
 * Normalizes a flag level string to uppercase (e.g., 'Critical' -> 'CRITICAL', 'None' -> 'NONE')
 * to match frontend constants.
 */
function normalizeFlagLevel(entity) {
  if (entity && entity.flagLevel) {
    entity.flagLevel = entity.flagLevel.toUpperCase();
  }
  return entity;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export const api = {
  async getDashboardStats() {
    return fetchApi('/dashboard/stats');
  },

  async getTransactions(filters = {}) {
    const params = new URLSearchParams();
    if (filters.flagLevel && filters.flagLevel !== 'ALL') params.append('flagLevel', filters.flagLevel);
    if (filters.search) params.append('search', filters.search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    
    // The backend provides transactions via /transactions
    const data = await fetchApi(`/transactions${qs}`);
    // Normalize flagLevels
    return Array.isArray(data) ? data.map(normalizeFlagLevel) : data;
  },

  async uploadTransactionsCSV(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('auth_token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Omit 'Content-Type' header so the browser sets the correct boundary for multipart/form-data.
    const response = await fetch(`${API_BASE_URL}/transactions/upload`, {
      method: 'POST',
      body: formData,
      headers
    });
    
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.reload();
    }

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.transactions) {
      data.transactions = data.transactions.map(normalizeFlagLevel);
    }
    
    return data;
  },

  async getTransactionTrail(txnId) {
    return fetchApi(`/transactions/${txnId}/trail`);
  },

  async getFullGraph() {
    const data = await fetchApi('/graph');
    if (data && data.nodes) {
      data.nodes = data.nodes.map(normalizeFlagLevel);
    }
    return data;
  },

  async getCompanies() { 
    const data = await fetchApi('/entities/companies'); // Example endpoint mapping
    return Array.isArray(data) ? data.map(normalizeFlagLevel) : data;
  },
  
  async getPersons() { 
    const data = await fetchApi('/entities/persons'); 
    return Array.isArray(data) ? data.map(normalizeFlagLevel) : data;
  },
  
  async getBankAccounts() { 
    const data = await fetchApi('/entities/accounts'); 
    return Array.isArray(data) ? data.map(normalizeFlagLevel) : data;
  },
  
  async getEntity(id) {
    const data = await fetchApi(`/entities/${id}`);
    return normalizeFlagLevel(data);
  },

  async createCompany(data) {
    return fetchApi('/entities/companies', { method: 'POST', body: JSON.stringify(data) });
  },

  async createBankAccount(data) {
    return fetchApi('/entities/accounts', { method: 'POST', body: JSON.stringify(data) });
  },

  async createPerson(data) {
    return fetchApi('/entities/persons', { method: 'POST', body: JSON.stringify(data) });
  },

  async getFlags() { 
    const data = await fetchApi('/flags'); 
    return Array.isArray(data) ? data.map(normalizeFlagLevel) : data;
  },
  
  async runAnalysis() {
    return fetchApi('/analysis/run', { method: 'POST' });
  },

  async getVolumeChart() { 
    return fetchApi('/dashboard/volume'); 
  },
  
  async overrideFlagLevel(entityId, flagLevel) {
    return fetchApi(`/flags/override`, {
      method: 'POST',
      body: JSON.stringify({ entityId, flagLevel })
    });
  }
};
