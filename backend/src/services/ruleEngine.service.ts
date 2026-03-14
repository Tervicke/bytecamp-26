import type { Transaction } from "../types/transactions";
import { runWrite } from "../lib/neo4j/neo4j";

// ─── Types ──────────────────────────────────────────────────────────────

export type TransactionRuleResult<TData = unknown> = {
  ruleName: string;
  triggered: boolean;
  severity: number; // severity as integer
  data?: TData;
};

export type TransactionRule<TData = unknown> = (
  txn: Transaction
) => Promise<TransactionRuleResult<TData>>;

export type ApplyRulesResult = {
  transaction: Transaction & {
    isSuspicious: boolean;
    flagLevel: string;
    flagReasons?: string[];
    severity?: number;
  };
  ruleResults: TransactionRuleResult[];
};

// ─── Rules List ─────────────────────────────────────────────────────────

const ALL_RULES: TransactionRule[] = [
  circularTransactionRule,
  sharedOwnershipRule,
];

// ─── Core Engine ────────────────────────────────────────────────────────

export const SeverityMap: Record<number, string> = {
  6: "CRITICAL",
  5: "HIGH",
  4: "MEDIUM",
  3: "LOW",
  0: "NONE",
};

export async function evaluateAllTransactionRules(
  txn: Transaction
): Promise<TransactionRuleResult[]> {
  const results: TransactionRuleResult[] = [];

  for (const rule of ALL_RULES) {
    try {
      const res = await rule(txn);
      results.push(res);
    } catch (err) {
      console.error(`Error running rule ${rule.name}:`, err);
      results.push({
        ruleName: rule.name,
        triggered: false,
        severity: 0,
      });
    }
  }

  return results;
}

export async function applyAllRulesToTransaction(
  txn: Transaction
): Promise<ApplyRulesResult> {
  const ruleResults = await evaluateAllTransactionRules(txn);

  let totalSeverity = 0;
  const triggeredRules: string[] = [];

  for (const r of ruleResults) {
    if (r.triggered) {
      triggeredRules.push(r.ruleName);
      totalSeverity += r.severity;
    }
  }

  const triggeredCount = triggeredRules.length;
  // Calculate average severity (rounding to nearest integer in SeverityMap range)
  const averageSeverity = triggeredCount > 0 ? Math.round(totalSeverity / triggeredCount) : 0;
  
  const isSuspicious = averageSeverity > 0;
  const flagLevel = SeverityMap[averageSeverity] ?? "None";

  return {
    transaction: {
      ...txn,
      isSuspicious,
      flagReasons: triggeredRules,
      severity: averageSeverity,
      flagLevel,
    },
    ruleResults,
  };
}

// ─── Circular Transaction Rule ─────────────────────────────────────────

type CircularTxnPathEdge = {
  id: string;
  amount: number;
  currency: string;
  txnDate: string | Date;
  txnType: string;
  referenceNumber: string;
  flagLevel: string;
};

export type CircularTransactionDetection = {
  transaction: Transaction;
  accountPath: string[];
  transactionPath: CircularTxnPathEdge[];
};

const calculateSeverityFromCount = (count: number): number => {
  if (count >= 2 && count <= 3) return 6;
  if (count === 4) return 5;
  if (count >= 5 && count <= 6) return 4;
  if (count >= 7 && count <= 8) return 3;
  return 0;
};

export async function detectCircularTransaction(
  txn: Transaction
): Promise<CircularTransactionDetection[]> {
  const query = `
      MATCH (from:BankAccount {id: $fromAccountId})
      MATCH (to:BankAccount {id: $toAccountId})
      // Use shortestPath because the smallest node count = highest severity
      MATCH path = shortestPath((to)-[:TRANSFERS_TO*1..7]->(from))
      RETURN
        $transaction AS transaction,
        [n IN nodes(path) | n.id] AS accountPath,
        [r IN relationships(path) | {
            id: r.id,
            amount: r.amount,
            currency: r.currency,
            txnDate: r.txnDate,
            txnType: r.txnType,
            referenceNumber: r.referenceNumber,
            flagLevel: r.flagLevel
        }] AS transactionPath
  `;

  return await runWrite<CircularTransactionDetection>(query, {
    fromAccountId: txn.fromAccountId,
    toAccountId: txn.toAccountId,
    transaction: txn,
  });
}

export async function circularTransactionRule(
  txn: Transaction
): Promise<TransactionRuleResult<CircularTransactionDetection[]>> {
  const detections = await detectCircularTransaction(txn);

  const severities = detections.map((d) =>
    calculateSeverityFromCount(d.accountPath.length)
  );
  const severity = severities.length > 0 ? Math.max(...severities) : 0;

  return {
    ruleName: "circularTransaction",
    triggered: detections.length > 0,
    severity,
    data: detections,
  };
}

// ─── Shared Ownership Rule ─────────────────────────────────────────────

export type SharedOwnershipDetection = {
  sharedOwner: string;
  companyCount: number;
};

export async function detectSharedOwnership(
  txn: Transaction
): Promise<SharedOwnershipDetection[]> {
  const query = `
      MATCH (from:BankAccount {id: $fromAccountId})
      MATCH (to:BankAccount {id: $toAccountId})
      
      // Find companies involved in the transaction chain
      MATCH (start:Company)-[:HOLDS_ACCOUNT]->(accStart:BankAccount)
      MATCH p1 = shortestPath((accStart)-[:TRANSFERS_TO*0..6]->(from))
      
      MATCH (end:Company)-[:HOLDS_ACCOUNT]->(accEnd:BankAccount)
      MATCH p2 = shortestPath((to)-[:TRANSFERS_TO*0..6]->(accEnd))
      
      // Check for shared ownership
      MATCH (p:Person)-[:OWNS]->(start)
      MATCH (p)-[:OWNS]->(end)
      WHERE start <> end
      
      WITH p, (length(p1) + length(p2) + 2) AS count
      WHERE count <= 8
      
      RETURN DISTINCT p.name AS sharedOwner, count AS companyCount
      ORDER BY count ASC
      LIMIT 5
  `;

  return await runWrite<SharedOwnershipDetection>(query, {
    fromAccountId: txn.fromAccountId,
    toAccountId: txn.toAccountId,
    txnId: txn.id,
  });
}

export async function sharedOwnershipRule(
  txn: Transaction
): Promise<TransactionRuleResult<SharedOwnershipDetection[]>> {
  const detections = await detectSharedOwnership(txn);

  const severities = detections.map((d) =>
    calculateSeverityFromCount(d.companyCount)
  );
  const severity = severities.length > 0 ? Math.max(...severities) : 0;

  return {
    ruleName: "sharedOwnership",
    triggered: detections.length > 0,
    severity,
    data: detections,
  };
}

// ─── Rapid Transfers Rule ────────────────────────────────────────────────

export type RapidTransferDetection = {
  transaction: Transaction;
  windowStart: string;
  recipientCount: number;
  transactionsInWindow: {
    id: string;
    amount: number;
    currency: string;
    txnDate: string | Date;
    txnType: string;
    referenceNumber: string;
    flagLevel: string;
  }[];
};

// Simple severity calculation based on number of recipients in window
const calculateRapidTransferSeverity = (recipientCount: number): number => {
  if (recipientCount >= 10) return 6;
  if (recipientCount >= 7) return 5;
  if (recipientCount >= 5) return 4;
  if (recipientCount >= 3) return 3;
  return 0;
};

export async function detectRapidTransfers(
  txn: Transaction
): Promise<RapidTransferDetection[]> {
  const query = `
      MATCH (from:BankAccount {id: $fromAccountId})-[t:TRANSFERS_TO]->(to:BankAccount)
      WHERE t.txnDate >= $txnDate - duration({minutes: 20})
        AND t.txnDate <= $txnDate + duration({minutes: 20})
      WITH from, t
      ORDER BY t.txnDate
      MATCH (from)-[t2:TRANSFERS_TO]->(to2:BankAccount)
      WHERE t2.txnDate >= t.txnDate
        AND t2.txnDate < t.txnDate + duration({minutes:20})
      WITH from, t.txnDate AS windowStart,
           collect(DISTINCT to2.id) AS uniqueRecipients,
           collect({
             id: t2.id,
             amount: t2.amount,
             currency: t2.currency,
             txnDate: t2.txnDate,
             txnType: t2.txnType,
             referenceNumber: t2.referenceNumber,
             flagLevel: t2.flagLevel
           }) AS transactionsInWindow
      WHERE size(uniqueRecipients) >= 3
      RETURN $transaction AS transaction,
             windowStart,
             size(uniqueRecipients) AS recipientCount,
             transactionsInWindow
  `;
  
  return await runWrite<RapidTransferDetection>(query, {
    fromAccountId: txn.fromAccountId,
    txnDate: txn.txnDate,
    transaction: txn,
  });
}

export async function rapidTransfersRule(
  txn: Transaction
): Promise<TransactionRuleResult<RapidTransferDetection[]>> {
  const detections = await detectRapidTransfers(txn);

  const severities = detections.map((d) =>
    calculateRapidTransferSeverity(d.recipientCount)
  );
  const severity = severities.length > 0 ? Math.max(...severities) : 0;

  return {
    ruleName: "rapidTransfers",
    triggered: detections.length > 0,
    severity,
    data: detections,
  };
}