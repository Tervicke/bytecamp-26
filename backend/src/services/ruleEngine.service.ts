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
  6: "Critical",
  5: "High",
  4: "Medium",
  3: "Low",
  0: "None",
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

  let highestSeverity = 0;
  const triggeredRules: string[] = [];

  for (const r of ruleResults) {
    if (r.triggered) {
      triggeredRules.push(r.ruleName);
      if (r.severity > highestSeverity) {
        highestSeverity = r.severity;
      }
    }
  }

  const isSuspicious = highestSeverity > 0;

  const flagLevel = SeverityMap[highestSeverity] ?? "None";

  return {
    transaction: {
      ...txn,
      isSuspicious,
      flagReasons: isSuspicious ? triggeredRules : [],
      severity: isSuspicious ? highestSeverity : 0,
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

export async function detectCircularTransaction(
  txn: Transaction
): Promise<CircularTransactionDetection[]> {
  const query = `
      MATCH (from:BankAccount {id: $fromAccountId})
      MATCH (to:BankAccount {id: $toAccountId})
      MATCH path = (to)-[:TRANSFERS_TO*1..6]->(from)
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
      LIMIT 5
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

  return {
    ruleName: "circularTransaction",
    triggered: detections.length > 0,
    severity: 6, // highest for test
    data: detections,
  };
}

// ─── Shared Ownership Rule ─────────────────────────────────────────────

export type SharedOwnershipDetection = {
  sharedOwner: string;
};

export async function detectSharedOwnership(
  txn: Transaction
): Promise<SharedOwnershipDetection[]> {
  const query = `
      MATCH (p:Person)-[:OWNS]->(start:Company)
      MATCH (p)-[:OWNS]->(end:Company)
      WHERE start <> end
      MATCH (start)-[:HOLDS_ACCOUNT]->(accStart:BankAccount)
      MATCH (end)-[:HOLDS_ACCOUNT]->(accEnd:BankAccount)
      MATCH p1 = (accStart)-[:TRANSFERS_TO*0..3]->(from:BankAccount {id: $fromAccountId})
      MATCH (from)-[:TRANSFERS_TO {id: $txnId}]->(to:BankAccount {id: $toAccountId})
      MATCH p2 = (to)-[:TRANSFERS_TO*0..3]->(accEnd)
      WHERE length(p1) + length(p2) + 1 <= 4
      RETURN DISTINCT p.name AS sharedOwner
      LIMIT 10
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

  return {
    ruleName: "sharedOwnership",
    triggered: detections.length > 0,
    severity: 6, // highest for test
    data: detections,
  };
}