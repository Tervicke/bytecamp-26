import type { Transaction } from "../types/transactions";
import { runRead, runWrite } from "../lib/neo4j/neo4j";

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
  rapidTransfersRule,
  cashFlowRatioRule,
];

// ─── Core Engine ────────────────────────────────────────────────────────

export const SeverityMap: Record<number, string> = {
  6: "CRITICAL",
  5: "HIGH",
  4: "MEDIUM",
  3: "LOW",
  0: "NONE",
};

// Uppercase flag level map for Neo4j storage
export const FlagLevelMap: Record<number, string> = {
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

  const triggeredRules = ruleResults.filter((r) => r.triggered);
  const triggeredNames = triggeredRules.map((r) => r.ruleName);

  // Use MAX severity across triggered rules (compound risk = worst case)
  const maxSeverity =
    triggeredRules.length > 0
      ? Math.max(...triggeredRules.map((r) => r.severity))
      : 0;

  const isSuspicious = maxSeverity > 0;
  const flagLevel = FlagLevelMap[maxSeverity] ?? "NONE";

  return {
    transaction: {
      ...txn,
      isSuspicious,
      flagReasons: triggeredNames,
      severity: maxSeverity,
      flagLevel,
    },
    ruleResults,
  };
}

// ─── Severity Helpers ────────────────────────────────────────────────────

const calculateSeverityFromCount = (count: number): number => {
  if (count >= 2 && count <= 3) return 6;
  if (count === 4) return 5;
  if (count >= 5 && count <= 6) return 4;
  if (count >= 7 && count <= 8) return 3;
  return 0;
};

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

// ─── Cash Flow Ratio Rule ────────────────────────────────────────────────
// Flags accounts where cash inflow > 70% or > 90% of total transaction volume
// in a rolling 30-day window around the transaction date.

export type CashFlowRatioDetection = {
  accountId: string;
  cashIn: number;
  totalTxns: number;
  ratio: number;
};

const calculateCashFlowSeverity = (ratio: number): number => {
  if (ratio >= 0.9) return 6; // CRITICAL
  if (ratio >= 0.7) return 5; // HIGH
  return 0;
};

export async function detectCashFlowRatio(
  txn: Transaction
): Promise<CashFlowRatioDetection[]> {
  // Check the fromAccount's rolling 30-day cash-in ratio
  const query = `
      MATCH (acc:BankAccount {id: $fromAccountId})
      
      OPTIONAL MATCH (acc)<-[tin:TRANSFERS_TO]-(src:BankAccount)
      WHERE tin.txnDate >= $windowStart AND tin.txnDate <= $txnDate
        AND tin.txnType = 'cash'
      
      OPTIONAL MATCH (acc)-[tout:TRANSFERS_TO]->(dst:BankAccount)
      WHERE tout.txnDate >= $windowStart AND tout.txnDate <= $txnDate
      
      WITH acc,
           count(DISTINCT tin) AS cashIn,
           count(DISTINCT tout) AS totalOut
      
      WITH acc, cashIn, totalOut,
           toFloat(cashIn) / CASE WHEN (cashIn + totalOut) = 0 THEN 1 ELSE (cashIn + totalOut) END AS ratio
      
      WHERE ratio >= 0.7
      
      RETURN acc.id AS accountId,
             cashIn,
             (cashIn + totalOut) AS totalTxns,
             ratio
  `;

  // Window: 30 days before the current transaction date
  const txnDate = txn.txnDate instanceof Date ? txn.txnDate : new Date(txn.txnDate);
  const windowStart = new Date(txnDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  return await runRead<CashFlowRatioDetection>(query, {
    fromAccountId: txn.fromAccountId,
    txnDate: txnDate.toISOString(),
    windowStart,
  });
}

export async function cashFlowRatioRule(
  txn: Transaction
): Promise<TransactionRuleResult<CashFlowRatioDetection[]>> {
  const detections = await detectCashFlowRatio(txn);

  const severities = detections.map((d) => calculateCashFlowSeverity(d.ratio));
  const severity = severities.length > 0 ? Math.max(...severities) : 0;

  return {
    ruleName: "cashFlowRatio",
    triggered: detections.length > 0,
    severity,
    data: detections,
  };
}