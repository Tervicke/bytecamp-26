import type { Transaction } from "../types/transactions";
import { runWrite } from "../lib/neo4j/neo4j";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TransactionRuleResult<TData = unknown> = {
  ruleName: string;
  triggered: boolean;
  data?: TData;
};

export type TransactionRule<TData = unknown> = (
  txn: Transaction
) => Promise<TransactionRuleResult<TData>>;

// ─── Core Rule Engine API ──────────────────────────────────────────────────────

const RULES_BY_TRANSACTION_TYPE: Record<string, TransactionRule[]> = {
  // Example: apply circular detection to transfers
  TRANSFER: [circularTransactionRule],
};

/**
 * Evaluate all rules configured for the given transaction's type.
 * Easily extendable by adding new entries to RULES_BY_TRANSACTION_TYPE
 * or introducing new rule functions.
 */
export async function evaluateTransactionRules(
  txn: Transaction
): Promise<TransactionRuleResult[]> {
  const rules = RULES_BY_TRANSACTION_TYPE[txn.txnType] ?? [];

  if (rules.length === 0) {
    return [];
  }

  const results = await Promise.all(rules.map((rule) => rule(txn)));
  return results;
}

/**
 * Evaluate all known rules for a transaction, ignoring txnType.
 * Any new rules you add should be included in ALL_RULES.
 */
const ALL_RULES: TransactionRule[] = [
  circularTransactionRule,
  // add future rules here
];

export async function evaluateAllTransactionRules(
  txn: Transaction
): Promise<TransactionRuleResult[]> {
  if (ALL_RULES.length === 0) {
    return [];
  }

  const results = await Promise.all(ALL_RULES.map((rule) => rule(txn)));
  return results;
}

// ─── Helpers: Apply rule results onto a Transaction ────────────────────────────

export type ApplyRulesResult = {
  transaction: Transaction;
  ruleResults: TransactionRuleResult[];
};

/**
 * Runs all known rules (ignores txnType) and returns an updated Transaction:
 * - isSuspicious: true if any rule triggered
 * - flagReasons: list of triggered rule names
 * - flagLevel: single global level, "High" when any rule triggers
 */
export async function applyAllRulesToTransaction(
  txn: Transaction
): Promise<ApplyRulesResult> {
  const ruleResults = await evaluateAllTransactionRules(txn);

  const triggered = ruleResults.filter((r) => r.triggered);
  if (triggered.length === 0) {
    return {
      transaction: {
        ...txn,
        isSuspicious: false,
      },
      ruleResults,
    };
  }

  const reasons = Array.from(
    new Set(triggered.map((r) => r.ruleName).filter(Boolean))
  );

  return {
    transaction: {
      ...txn,
      isSuspicious: true,
      flagLevel: "High",
      flagReasons: reasons,
    },
    ruleResults,
  };
}

// ─── Example Rule: Circular Transaction Detection ──────────────────────────────

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

/**
 * Low-level helper that runs the Neo4j query to detect circular
 * transfers between accounts for a given transaction.
 *
 * You can add additional rule functions in this file that call into
 * Neo4j in a similar fashion.
 */
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

  const records = await runWrite<CircularTransactionDetection>(query, {
    fromAccountId: txn.fromAccountId,
    toAccountId: txn.toAccountId,
    transaction: txn,
  });

  return records;
}

/**
 * High-level rule wrapper that plugs circular transaction detection
 * into the generic rule engine contract.
 */
export async function circularTransactionRule(
  txn: Transaction
): Promise<TransactionRuleResult<CircularTransactionDetection[]>> {
  const detections = await detectCircularTransaction(txn);

  return {
    ruleName: "circularTransaction",
    triggered: detections.length > 0,
    data: detections,
  };
}
