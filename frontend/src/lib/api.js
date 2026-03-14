/**
 * AML Shield — API Layer (Seed Data Matched)
 * This connects to the real backend API or falls back to seed data if VITE_USE_MOCK_API !== 'false'.
 */

const DELAY = 600;
const delay = (ms = DELAY) => new Promise(res => setTimeout(res, ms));

// ─── Extract from CSVs ────────────────────────────────────────────────────────

// Companies
export const MOCK_COMPANIES = [
  { id: 'c001', name: 'Meridian Trading Ltd', jurisdiction: 'British Virgin Islands', registrationNumber: 'BVI-2019-00341', companyType: 'LLC', industry: 'Import/Export', isShell: true, flagLevel: 'CRITICAL', flagReasons: ['cycle_detected'], layer: 0 },
  { id: 'c002', name: 'Alpine Ventures GmbH', jurisdiction: 'Switzerland', registrationNumber: 'CHE-112.345.678', companyType: 'GmbH', industry: 'Financial Services', isShell: false, flagLevel: 'NONE', flagReasons: [], layer: null },
  { id: 'c003', name: 'Solaris Holdings Inc', jurisdiction: 'Delaware USA', registrationNumber: 'DE-5723901', companyType: 'Corporation', industry: 'Real Estate', isShell: true, flagLevel: 'NONE', flagReasons: [], layer: null },
  { id: 'c004', name: 'Pacific Rim Consultants Pte Ltd', jurisdiction: 'Singapore', registrationNumber: 'SG-201823456W', companyType: 'Pte Ltd', industry: 'Consulting', isShell: true, flagLevel: 'NONE', flagReasons: [], layer: null },
  { id: 'c005', name: 'Nexus Global Partners LLC', jurisdiction: 'Cayman Islands', registrationNumber: 'CI-2020-9921', companyType: 'LLC', industry: 'Investment', isShell: true, flagLevel: 'HIGH', flagReasons: ['connected_to_flagged'], layer: 1 },
  { id: 'c006', name: 'BlueStar Logistics AG', jurisdiction: 'Switzerland', registrationNumber: 'CHE-987.654.321', companyType: 'AG', industry: 'Logistics', isShell: false, flagLevel: 'CRITICAL', flagReasons: ['cycle_detected'], layer: 0 },
  { id: 'c007', name: 'Ironclad Resources Corp', jurisdiction: 'Delaware USA', registrationNumber: 'DE-4891023', companyType: 'Corporation', industry: 'Mining', isShell: true, flagLevel: 'NONE', flagReasons: [], layer: null },
  { id: 'c008', name: 'Harborview Capital Ltd', jurisdiction: 'British Virgin Islands', registrationNumber: 'BVI-2021-00887', companyType: 'LLC', industry: 'Finance', isShell: true, flagLevel: 'CRITICAL', flagReasons: ['cycle_detected'], layer: 0 },
  { id: 'c009', name: 'Quantum Pharma Solutions', jurisdiction: 'Singapore', registrationNumber: 'SG-202045678K', companyType: 'Pte Ltd', industry: 'Pharmaceuticals', isShell: false, flagLevel: 'NONE', flagReasons: [], layer: null },
  { id: 'c010', name: 'Eastern Star Import Export', jurisdiction: 'Hong Kong', registrationNumber: 'HK-3029847', companyType: 'Limited', industry: 'Trade', isShell: false, flagLevel: 'MEDIUM', flagReasons: ['distant_connection'], layer: 2 },
  { id: 'c011', name: 'Coral Bay Properties Ltd', jurisdiction: 'Cayman Islands', registrationNumber: 'CI-2017-6634', companyType: 'LLC', industry: 'Real Estate', isShell: true, flagLevel: 'NONE', flagReasons: [], layer: null },
  { id: 'c012', name: 'Amber Creek Finance', jurisdiction: 'British Virgin Islands', registrationNumber: 'BVI-2022-01201', companyType: 'LLC', industry: 'Finance', isShell: true, flagLevel: 'HIGH', flagReasons: ['high_volume'], layer: 1 },
  { id: 'c013', name: 'NorthStar Technology Inc', jurisdiction: 'Delaware USA', registrationNumber: 'DE-6234789', companyType: 'Corporation', industry: 'Technology', isShell: false, flagLevel: 'CRITICAL', flagReasons: ['cycle_detected'], layer: 0 },
  { id: 'c014', name: 'Crescent Moon Trading LLC', jurisdiction: 'Cayman Islands', registrationNumber: 'CI-2018-5511', companyType: 'LLC', industry: 'Trading', isShell: true, flagLevel: 'CRITICAL', flagReasons: ['cycle_detected'], layer: 0 },
  { id: 'c015', name: 'Triton Marine Services', jurisdiction: 'Singapore', registrationNumber: 'SG-201567890M', companyType: 'Pte Ltd', industry: 'Maritime', isShell: false, flagLevel: 'NONE', flagReasons: [], layer: null },
  { id: 'c016', name: 'Zenith Asset Management', jurisdiction: 'Switzerland', registrationNumber: 'CHE-456.789.012', companyType: 'AG', industry: 'Asset Management', isShell: false, flagLevel: 'CRITICAL', flagReasons: ['cash_flow_ratio', 'cycle_detected'], layer: 0 },
  { id: 'c017', name: 'Phantom Equity Partners', jurisdiction: 'British Virgin Islands', registrationNumber: 'BVI-2023-00456', companyType: 'LLC', industry: 'Private Equity', isShell: true, flagLevel: 'NONE', flagReasons: [], layer: null },
  { id: 'c018', name: 'Silverline Media Group', jurisdiction: 'Hong Kong', registrationNumber: 'HK-4156923', companyType: 'Limited', industry: 'Media', isShell: false, flagLevel: 'NONE', flagReasons: [], layer: null },
  { id: 'c019', name: 'Black Pebble Investments', jurisdiction: 'Cayman Islands', registrationNumber: 'CI-2021-8844', companyType: 'LLC', industry: 'Investment', isShell: true, flagLevel: 'CRITICAL', flagReasons: ['cycle_detected'], layer: 0 },
  { id: 'c020', name: 'Greenway Agri Holdings', jurisdiction: 'Singapore', registrationNumber: 'SG-201789012P', companyType: 'Pte Ltd', industry: 'Agriculture', isShell: false, flagLevel: 'NONE', flagReasons: [], layer: null },
];

// Persons 
export const MOCK_PERSONS = [
  { id: 'p001', name: 'Viktor Rennov', nationality: 'Russian', role: 'beneficial_owner', flagLevel: 'CRITICAL', flagReasons: ['owns_critical_company'] },
  { id: 'p002', name: 'Chen Wei', nationality: 'Chinese', role: 'director', flagLevel: 'NONE', flagReasons: [] },
  { id: 'p003', name: 'Elena Marchetti', nationality: 'Italian', role: 'nominee_director', flagLevel: 'NONE', flagReasons: [] },
  { id: 'p004', name: 'James Holloway', nationality: 'British', role: 'nominee_shareholder', flagLevel: 'HIGH', flagReasons: ['owns_flagged_company'] },
  { id: 'p005', name: 'Amir Khalid Al-Rashidi', nationality: 'UAE', role: 'beneficial_owner', flagLevel: 'CRITICAL', flagReasons: ['owns_critical_company'] },
  { id: 'p006', name: 'Sophia Vandermeer', nationality: 'Dutch', role: 'director', flagLevel: 'CRITICAL', flagReasons: ['director_critical_company'] },
  { id: 'p007', name: 'Marcus Chen', nationality: 'Singaporean', role: 'beneficial_owner', flagLevel: 'NONE', flagReasons: [] },
  { id: 'p008', name: 'Olga Petrov', nationality: 'Ukrainian', role: 'nominee_director', flagLevel: 'NONE', flagReasons: [] },
  { id: 'p009', name: 'Raymond Dubois', nationality: 'French', role: 'director', flagLevel: 'CRITICAL', flagReasons: ['owns_critical_company'] },
  { id: 'p010', name: 'Priya Sharma', nationality: 'Indian', role: 'shareholder', flagLevel: 'NONE', flagReasons: [] },
  { id: 'p011', name: 'Nikolai Stein', nationality: 'German', role: 'beneficial_owner', flagLevel: 'NONE', flagReasons: [] },
  { id: 'p012', name: 'Layla Hussain', nationality: 'Malaysian', role: 'director', flagLevel: 'NONE', flagReasons: [] },
  { id: 'p013', name: 'Thomas Archer', nationality: 'American', role: 'nominee_director', flagLevel: 'CRITICAL', flagReasons: ['owns_critical_company'] },
  { id: 'p014', name: 'Yuki Tanaka', nationality: 'Japanese', role: 'shareholder', flagLevel: 'NONE', flagReasons: [] },
  { id: 'p015', name: 'Carlos Mendez', nationality: 'Mexican', role: 'beneficial_owner', flagLevel: 'CRITICAL', flagReasons: ['owns_critical_company'] },
];

export const MOCK_BANK_ACCOUNTS = [
  { id: 'ba001', companyId: 'c001', accountNumber: 'BVI-88120-001', bankName: 'FirstBank BVI', currency: 'USD', balance: 2450000.00, flagLevel: 'CRITICAL', cashFlowRatio: 0.85, txnCount30d: 45 },
  { id: 'ba002', companyId: 'c002', accountNumber: 'CH-ZH-443210', bankName: 'Zurich Cantonal Bank', currency: 'CHF', balance: 5870000.00, flagLevel: 'NONE', cashFlowRatio: 0.1, txnCount30d: 5 },
  { id: 'ba003', companyId: 'c002', accountNumber: 'CH-ZH-443211', bankName: 'Zurich Cantonal Bank', currency: 'CHF', balance: 320000.00, flagLevel: 'NONE', cashFlowRatio: 0.0, txnCount30d: 2 },
  { id: 'ba004', companyId: 'c003', accountNumber: 'DE-WIL-991201', bankName: 'Bank of Delaware', currency: 'USD', balance: 980000.00, flagLevel: 'NONE', cashFlowRatio: 0.2, txnCount30d: 4 },
  { id: 'ba005', companyId: 'c004', accountNumber: 'SG-RAF-112233', bankName: 'DBS Bank', currency: 'SGD', balance: 1200000.00, flagLevel: 'NONE', cashFlowRatio: 0.15, txnCount30d: 8 },
  { id: 'ba006', companyId: 'c005', accountNumber: 'CI-GEO-554433', bankName: 'Cayman National', currency: 'USD', balance: 7500000.00, flagLevel: 'CRITICAL', cashFlowRatio: 0.0, txnCount30d: 12 },
  { id: 'ba007', companyId: 'c006', accountNumber: 'CH-BS-889900', bankName: 'UBS Basel', currency: 'CHF', balance: 3100000.00, flagLevel: 'NONE', cashFlowRatio: 0.05, txnCount30d: 3 },
  { id: 'ba008', companyId: 'c007', accountNumber: 'DE-DOV-338899', bankName: 'First State Bank', currency: 'USD', balance: 450000.00, flagLevel: 'CRITICAL', cashFlowRatio: 0.9, txnCount30d: 22 },
  { id: 'ba009', companyId: 'c008', accountNumber: 'BVI-88120-002', bankName: 'FirstBank BVI', currency: 'USD', balance: 870000.00, flagLevel: 'CRITICAL', cashFlowRatio: 0.95, txnCount30d: 38 },
  { id: 'ba010', companyId: 'c009', accountNumber: 'SG-ORC-556677', bankName: 'OCBC Bank', currency: 'SGD', balance: 9200000.00, flagLevel: 'NONE', cashFlowRatio: 0.1, txnCount30d: 6 },
  { id: 'ba011', companyId: 'c009', accountNumber: 'SG-ORC-556678', bankName: 'OCBC Bank', currency: 'SGD', balance: 150000.00, flagLevel: 'NONE', cashFlowRatio: 0.0, txnCount30d: 2 },
  { id: 'ba012', companyId: 'c010', accountNumber: 'HK-WAN-223344', bankName: 'HSBC Hong Kong', currency: 'HKD', balance: 4300000.00, flagLevel: 'MEDIUM', cashFlowRatio: 0.0, txnCount30d: 7 },
  { id: 'ba013', companyId: 'c011', accountNumber: 'CI-GEO-778899', bankName: 'Cayman National', currency: 'USD', balance: 1800000.00, flagLevel: 'CRITICAL', cashFlowRatio: 0.0, txnCount30d: 18 },
  { id: 'ba014', companyId: 'c012', accountNumber: 'BVI-88120-003', bankName: 'FirstBank BVI', currency: 'USD', balance: 3200000.00, flagLevel: 'CRITICAL', cashFlowRatio: 0.0, txnCount30d: 11 },
  { id: 'ba015', companyId: 'c013', accountNumber: 'DE-SF-665544', bankName: 'Silicon Valley Bank', currency: 'USD', balance: 6700000.00, flagLevel: 'NONE', cashFlowRatio: 0.0, txnCount30d: 3 },
  { id: 'ba016', companyId: 'c014', accountNumber: 'CI-GEO-990011', bankName: 'Cayman National', currency: 'USD', balance: 920000.00, flagLevel: 'CRITICAL', cashFlowRatio: 0.88, txnCount30d: 52 },
  { id: 'ba017', companyId: 'c015', accountNumber: 'SG-JUR-334455', bankName: 'Maybank Singapore', currency: 'SGD', balance: 2800000.00, flagLevel: 'NONE', cashFlowRatio: 0.2, txnCount30d: 9 },
  { id: 'ba018', companyId: 'c016', accountNumber: 'CH-GEN-112244', bankName: 'Julius Baer', currency: 'CHF', balance: 15000000.00, flagLevel: 'NONE', cashFlowRatio: 0.0, txnCount30d: 5 },
  { id: 'ba019', companyId: 'c017', accountNumber: 'BVI-88120-004', bankName: 'FirstBank BVI', currency: 'USD', balance: 550000.00, flagLevel: 'CRITICAL', cashFlowRatio: 0.0, txnCount30d: 14 },
  { id: 'ba020', companyId: 'c018', accountNumber: 'HK-CEN-445566', bankName: 'Standard Chartered', currency: 'HKD', balance: 2200000.00, flagLevel: 'NONE', cashFlowRatio: 0.1, txnCount30d: 7 },
  { id: 'ba021', companyId: 'c019', accountNumber: 'CI-GEO-223355', bankName: 'Cayman National', currency: 'USD', balance: 4900000.00, flagLevel: 'CRITICAL', cashFlowRatio: 0.91, txnCount30d: 41 },
];

export let MOCK_TRANSACTIONS = [
  // Cycle 1: ba001 -> ba009 -> ba013 -> ba016 -> ba021 -> ba001
  { id: 't001', fromAccountId: 'ba001', toAccountId: 'ba009', amount: 500000.00, currency: 'USD', txnDate: '2025-06-01T10:00:00Z', txnType: 'wire', description: 'Consulting services payment - Q2 2025', isSuspicious: true, flagLevel: 'CRITICAL', flagReasons: ['cycle_detected'] },
  { id: 't002', fromAccountId: 'ba009', toAccountId: 'ba013', amount: 480000.00, currency: 'USD', txnDate: '2025-06-05T11:30:00Z', txnType: 'wire', description: 'Loan repayment per agreement dated 2025-01-01', isSuspicious: true, flagLevel: 'CRITICAL', flagReasons: ['cycle_detected'] },
  { id: 't003', fromAccountId: 'ba013', toAccountId: 'ba016', amount: 460000.00, currency: 'USD', txnDate: '2025-06-10T09:15:00Z', txnType: 'wire', description: 'Service invoice INV-CI-00441', isSuspicious: true, flagLevel: 'CRITICAL', flagReasons: ['cycle_detected'] },
  { id: 't004', fromAccountId: 'ba016', toAccountId: 'ba021', amount: 440000.00, currency: 'USD', txnDate: '2025-06-14T14:45:00Z', txnType: 'wire', description: 'Investment returns per prospectus', isSuspicious: true, flagLevel: 'CRITICAL', flagReasons: ['cycle_detected'] },
  { id: 't005', fromAccountId: 'ba021', toAccountId: 'ba001', amount: 420000.00, currency: 'USD', txnDate: '2025-06-18T16:20:00Z', txnType: 'wire', description: 'Management fee reimbursement', isSuspicious: true, flagLevel: 'CRITICAL', flagReasons: ['cycle_detected'] },
  
  // Cycle 2: ba006 -> ba013 -> ba021 -> ba030 -> ba016 -> ba006 (ba030 not in full seed, skip or map closely)
  { id: 't006', fromAccountId: 'ba006', toAccountId: 'ba013', amount: 300000.00, currency: 'USD', txnDate: '2025-07-01T09:00:00Z', txnType: 'wire', description: 'Real estate acquisition consulting', isSuspicious: true, flagLevel: 'CRITICAL', flagReasons: ['cycle_detected'] },
  { id: 't007', fromAccountId: 'ba013', toAccountId: 'ba021', amount: 285000.00, currency: 'USD', txnDate: '2025-07-04T10:00:00Z', txnType: 'wire', description: 'Portfolio rebalancing transfer', isSuspicious: true, flagLevel: 'CRITICAL', flagReasons: ['cycle_detected'] },
  { id: 't010', fromAccountId: 'ba016', toAccountId: 'ba006', amount: 240000.00, currency: 'USD', txnDate: '2025-07-14T11:00:00Z', txnType: 'wire', description: 'Investment return distribution', isSuspicious: true, flagLevel: 'CRITICAL', flagReasons: ['cycle_detected'] },

  // Cash stuffing pattern ba001 -> ba005
  { id: 't011', fromAccountId: 'ba001', toAccountId: 'ba005', amount: 150000.00, currency: 'USD', txnDate: '2025-05-10T12:00:00Z', txnType: 'cash', description: 'Trade settlement - commodity shipment #A-441', isSuspicious: true, flagLevel: 'HIGH', flagReasons: ['cash_flow_ratio'] },
  { id: 't012', fromAccountId: 'ba001', toAccountId: 'ba005', amount: 145000.00, currency: 'USD', txnDate: '2025-05-13T12:00:00Z', txnType: 'cash', description: 'Trade settlement - commodity shipment #A-442', isSuspicious: true, flagLevel: 'HIGH', flagReasons: ['cash_flow_ratio'] },
  { id: 't013', fromAccountId: 'ba001', toAccountId: 'ba005', amount: 138000.00, currency: 'USD', txnDate: '2025-05-16T12:00:00Z', txnType: 'cash', description: 'Trade settlement - commodity shipment #A-443', isSuspicious: true, flagLevel: 'HIGH', flagReasons: ['cash_flow_ratio'] },

  // Normal transactions
  { id: 't021', fromAccountId: 'ba003', toAccountId: 'ba005', amount: 50000.00, currency: 'CHF', txnDate: '2025-04-01T09:00:00Z', txnType: 'wire', description: 'Advisory retainer Q2', isSuspicious: false, flagLevel: 'NONE', flagReasons: [] },
  { id: 't023', fromAccountId: 'ba005', toAccountId: 'ba004', amount: 46000.00, currency: 'USD', txnDate: '2025-04-09T10:00:00Z', txnType: 'wire', description: 'Service fee reimbursement', isSuspicious: false, flagLevel: 'NONE', flagReasons: [] },
  { id: 't024', fromAccountId: 'ba004', toAccountId: 'ba003', amount: 45000.00, currency: 'CHF', txnDate: '2025-04-14T11:00:00Z', txnType: 'wire', description: 'Cross-border referral payment', isSuspicious: false, flagLevel: 'NONE', flagReasons: [] },
  
  // More cash intense
  { id: 't049', fromAccountId: 'ba001', toAccountId: 'ba009', amount: 9500.00, currency: 'USD', txnDate: '2025-10-01T14:00:00Z', txnType: 'cash', description: 'Petty cash operational advance', isSuspicious: true, flagLevel: 'CRITICAL', flagReasons: ['high_volume'] },
  { id: 't050', fromAccountId: 'ba001', toAccountId: 'ba009', amount: 9800.00, currency: 'USD', txnDate: '2025-10-03T14:00:00Z', txnType: 'cash', description: 'Petty cash operational advance', isSuspicious: true, flagLevel: 'CRITICAL', flagReasons: ['high_volume'] },
  { id: 't051', fromAccountId: 'ba001', toAccountId: 'ba009', amount: 9700.00, currency: 'USD', txnDate: '2025-10-06T14:00:00Z', txnType: 'cash', description: 'Petty cash operational advance', isSuspicious: true, flagLevel: 'CRITICAL', flagReasons: ['high_volume'] },
  { id: 't052', fromAccountId: 'ba001', toAccountId: 'ba009', amount: 9600.00, currency: 'USD', txnDate: '2025-10-08T14:00:00Z', txnType: 'cash', description: 'Petty cash operational advance', isSuspicious: true, flagLevel: 'CRITICAL', flagReasons: ['high_volume'] },

  // Large wires
  { id: 't043', fromAccountId: 'ba009', toAccountId: 'ba013', amount: 1000000.00, currency: 'USD', txnDate: '2025-11-10T12:00:00Z', txnType: 'wire', description: 'Joint venture capital injection', isSuspicious: true, flagLevel: 'HIGH', flagReasons: ['connected_to_flagged'] },
  { id: 't044', fromAccountId: 'ba013', toAccountId: 'ba006', amount: 950000.00, currency: 'USD', txnDate: '2025-11-13T12:00:00Z', txnType: 'wire', description: 'Infrastructure project payment', isSuspicious: true, flagLevel: 'HIGH', flagReasons: ['connected_to_flagged'] },
];

export const MOCK_FLAG_EVENTS = [
  { id: 'fe1', entityId: 'c001', entityType: 'Company', entityName: 'Meridian Trading Ltd', flagLevel: 'CRITICAL', reason: 'Circular fund flow detected (Cycle 1: ba001 → ba009 → ba013 → ba016 → ba021 → ba001)', triggeredBy: 'cycle_detection', resolvedAt: null, createdAt: '2026-03-14T12:00:00Z' },
  { id: 'fe2', entityId: 'c008', entityType: 'Company', entityName: 'Harborview Capital Ltd', flagLevel: 'CRITICAL', reason: 'Circular fund flow detected', triggeredBy: 'cycle_detection', resolvedAt: null, createdAt: '2026-03-14T12:00:00Z' },
  { id: 'fe3', entityId: 'ba001', entityType: 'BankAccount', entityName: 'BVI-88120-001', flagLevel: 'CRITICAL', reason: 'Cash inflow ratio 85% exceeds 70% threshold + High Volume', triggeredBy: 'cash_flow_detection', resolvedAt: null, createdAt: '2026-03-14T12:00:00Z' },
  { id: 'fe4', entityId: 'p001', entityType: 'Person', entityName: 'Viktor Rennov', flagLevel: 'CRITICAL', reason: 'Beneficial owner of CRITICAL entity c001', triggeredBy: 'flag_propagation', resolvedAt: null, createdAt: '2026-03-14T12:01:00Z' },
  { id: 'fe5', entityId: 'c005', entityType: 'Company', entityName: 'Nexus Global Partners LLC', flagLevel: 'HIGH', reason: 'Layer-1 connection to CRITICAL entities', triggeredBy: 'flag_propagation', resolvedAt: null, createdAt: '2026-03-14T12:01:00Z' },
];

export const MOCK_ANALYSIS_RUNS = [
  { id: 'run1', startedAt: new Date(Date.now() - 3600000).toISOString(), completedAt: new Date(Date.now() - 3550000).toISOString(), cyclesFound: 2, entitiesFlagged: 16, status: 'completed' },
];

// Graph Nodes & Edges based on Seed Ownership
const graphNodes = [
  ...MOCK_COMPANIES.map(c => ({ id: c.id, label: 'Company', name: c.name, flagLevel: c.flagLevel, type: 'company', layer: c.layer })),
  ...MOCK_PERSONS.map(p => ({ id: p.id, label: 'Person', name: p.name, flagLevel: p.flagLevel, type: 'person' })),
  ...MOCK_BANK_ACCOUNTS.map(b => ({ id: b.id, label: 'BankAccount', name: b.accountNumber, flagLevel: b.flagLevel, type: 'account', companyId: b.companyId })),
];

const graphLinks = [
  // Ownerships from ownership.csv
  { source: 'p001', target: 'c001', type: 'OWNS', properties: { ownershipPct: 100 } },
  { source: 'p001', target: 'c008', type: 'OWNS', properties: { ownershipPct: 75 } },
  { source: 'p001', target: 'c012', type: 'OWNS', properties: { ownershipPct: 100 } },
  { source: 'p002', target: 'c004', type: 'OWNS', properties: { ownershipPct: 60 } },
  { source: 'p003', target: 'c003', type: 'CONTROLS', properties: { role: 'nominee_shareholder' } },
  { source: 'p004', target: 'c005', type: 'CONTROLS', properties: { role: 'nominee_shareholder' } },
  { source: 'p006', target: 'c006', type: 'CONTROLS', properties: { role: 'shareholder' } },
  { source: 'p009', target: 'c016', type: 'OWNS', properties: { ownershipPct: 100 } },
  { source: 'p015', target: 'c020', type: 'OWNS', properties: { ownershipPct: 85 } },

  // Subsidiaries from subsidiaries.csv
  { source: 'c002', target: 'c001', type: 'SUBSIDIARY_OF', properties: { sharesPct: 100 } },
  { source: 'c001', target: 'c008', type: 'SUBSIDIARY_OF', properties: { sharesPct: 100 } },
  { source: 'c005', target: 'c014', type: 'SUBSIDIARY_OF', properties: { sharesPct: 60 } },
  
  // Bank accounts
  ...MOCK_BANK_ACCOUNTS.map(b => ({ source: b.companyId, target: b.id, type: 'HOLDS_ACCOUNT', properties: {} })),

  // Transactions
  ...MOCK_TRANSACTIONS.map(t => ({ 
    source: t.fromAccountId, 
    target: t.toAccountId, 
    type: 'TRANSFERS_TO', 
    isCycle: t.flagReasons.includes('cycle_detected'),
    properties: { amount: t.amount, isSuspicious: t.isSuspicious } 
  })),
];

export const MOCK_GRAPH_DATA = { nodes: graphNodes, links: graphLinks };

export const MOCK_TRAILS = {
  't001': {
    transactionId: 't001',
    nodes: graphNodes.filter(n => ['ba001','ba009','ba013','ba016','ba021','c001','c008','c011','c014','c019'].includes(n.id)),
    links: graphLinks.filter(l => 
      ['ba001','ba009','ba013','ba016','ba021'].includes(l.source) && ['ba001','ba009','ba013','ba016','ba021'].includes(l.target) ||
      l.type === 'HOLDS_ACCOUNT' && ['ba001','ba009','ba013','ba016','ba021'].includes(l.target)
    ),
    relatedTransactions: ['t002', 't003', 't004', 't005', 't049', 't050'],
  }
};

// Volume chart data
export const MOCK_VOLUME_CHART = Array.from({ length: 14 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (13 - i));
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    total: Math.floor(Math.random() * 15 + 5),
    suspicious: Math.floor(Math.random() * 6 + 1),
    amount: Math.floor(Math.random() * 8000000 + 1000000),
  };
});

// ─── Real Backend Integration Layer ───────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
// By default, if the env variable isn't explicitly 'false', we use the mock data.
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';

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

// ─── API Functions ────────────────────────────────────────────────────────────

export const api = {
  async getDashboardStats() {
    if (USE_MOCK) {
      await delay();
      return {
        totalTransactions: MOCK_TRANSACTIONS.length,
        flaggedTransactions: MOCK_TRANSACTIONS.filter(t => t.flagLevel !== 'NONE').length,
        criticalAlerts: MOCK_TRANSACTIONS.filter(t => t.flagLevel === 'CRITICAL').length,
        activeCycles: 2,
        entitiesFlagged: 16,
        analysisRuns: MOCK_ANALYSIS_RUNS.length,
        lastAnalysis: MOCK_ANALYSIS_RUNS[0].completedAt,
      };
    }
    return fetchApi('/dashboard/stats');
  },

  async getTransactions(filters = {}) {
    if (USE_MOCK) {
      await delay();
      let txns = [...MOCK_TRANSACTIONS];
      if (filters.flagLevel && filters.flagLevel !== 'ALL') {
        txns = txns.filter(t => t.flagLevel === filters.flagLevel);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        txns = txns.filter(t => t.id.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
      }
      return txns.map(t => ({
        ...t,
        fromAccountName: MOCK_BANK_ACCOUNTS.find(b => b.id === t.fromAccountId)?.accountNumber || t.fromAccountId,
        toAccountName: MOCK_BANK_ACCOUNTS.find(b => b.id === t.toAccountId)?.accountNumber || t.toAccountId,
      }));
    }
    
    // Real API filter formatting
    const params = new URLSearchParams();
    if (filters.flagLevel && filters.flagLevel !== 'ALL') params.append('flagLevel', filters.flagLevel);
    if (filters.search) params.append('search', filters.search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return fetchApi(`/transactions${qs}`);
  },

  async uploadTransactionsCSV(file) {
    if (USE_MOCK) {
      await delay(1500);
      try {
        const text = await file.text();
        const rows = text.split('\n').slice(1).filter(r => r.trim()); // simple CSV parsing
        const newTxns = rows.map((r, i) => {
           const cols = r.split(',');
           return {
              id: cols[0] || `new_t_${Date.now()}_${i}`,
              fromAccountId: cols[1] || 'ba001',
              toAccountId: cols[2] || 'ba002',
              amount: parseFloat(cols[3]) || 1000,
              currency: 'USD',
              txnDate: new Date().toISOString(),
              txnType: 'wire',
              description: cols[7] || 'Uploaded transaction',
              isSuspicious: false,
              flagLevel: 'NONE',
              flagReasons: []
           };
        });
        MOCK_TRANSACTIONS = [...newTxns, ...MOCK_TRANSACTIONS];
        return { message: "Mock upload successful", count: newTxns.length, transactions: newTxns };
      } catch (e) {
        return { message: "Mock upload failed", count: 0, transactions: [] };
      }
    }
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('auth_token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // We can't use our standard fetchApi wrapper here because we need to omit the 'Content-Type' header 
    // so the browser sets the correct boundary for multipart/form-data.
    const response = await fetch(`${API_BASE_URL}/transactions/upload`, {
      method: 'POST',
      body: formData,
      headers
    });
    
    console.log(response);
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.reload();
    }

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    return response.json();
  },

  async getTransactionTrail(txnId) {
    if (USE_MOCK) {
      await delay();
      const trail = MOCK_TRAILS[txnId];
      if (!trail) {
        const txn = MOCK_TRANSACTIONS.find(t => t.id === txnId);
        if (!txn) return null;
        const from = MOCK_BANK_ACCOUNTS.find(b => b.id === txn.fromAccountId);
        const to = MOCK_BANK_ACCOUNTS.find(b => b.id === txn.toAccountId);
        return {
          transactionId: txnId,
          nodes: [
            { id: txn.fromAccountId, label: 'BankAccount', name: from?.accountNumber, flagLevel: from?.flagLevel, type: 'account' },
            { id: txn.toAccountId, label: 'BankAccount', name: to?.accountNumber, flagLevel: to?.flagLevel, type: 'account' },
          ],
          links: [{ source: txn.fromAccountId, target: txn.toAccountId, type: 'TRANSFERS_TO', isCycle: false, amount: txn.amount }],
          relatedTransactions: [],
        };
      }
      return trail;
    }
    return fetchApi(`/transactions/${txnId}/trail`);
  },

  async getFullGraph() {
    if (USE_MOCK) {
       await delay(800);
       return MOCK_GRAPH_DATA;
    }
    return fetchApi('/graph');
  },

  async getCompanies() { 
    if (USE_MOCK) { await delay(); return MOCK_COMPANIES; }
    return fetchApi('/entities/companies'); // Example endpoint mapping
  },
  
  async getPersons() { 
    if (USE_MOCK) { await delay(); return MOCK_PERSONS; }
    return fetchApi('/entities/persons'); 
  },
  
  async getBankAccounts() { 
    if (USE_MOCK) { await delay(); return MOCK_BANK_ACCOUNTS; }
    return fetchApi('/entities/accounts'); 
  },
  
  async getEntity(id) {
    if (USE_MOCK) {
      await delay(400);
      return MOCK_COMPANIES.find(c => c.id === id) || MOCK_PERSONS.find(p => p.id === id) || MOCK_BANK_ACCOUNTS.find(b => b.id === id) || null;
    }
    return fetchApi(`/entities/${id}`);
  },

  async getFlags() { 
    if (USE_MOCK) { await delay(); return MOCK_FLAG_EVENTS; }
    return fetchApi('/flags'); 
  },
  
  async runAnalysis() {
    if (USE_MOCK) {
      await delay(2000);
      return { id: 'run_new', startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), cyclesFound: 2, entitiesFlagged: 16, status: 'completed' };
    }
    return fetchApi('/analysis/run', { method: 'POST' });
  },

  async getVolumeChart() { 
    if (USE_MOCK) { await delay(400); return MOCK_VOLUME_CHART; }
    return fetchApi('/dashboard/volume'); 
  },
  
  async overrideFlagLevel(entityId, flagLevel) {
    if (USE_MOCK) {
      await delay();
      return { success: true, entityId, newFlagLevel: flagLevel };
    }
    return fetchApi(`/flags/override`, {
      method: 'POST',
      body: JSON.stringify({ entityId, flagLevel })
    });
  }
};
