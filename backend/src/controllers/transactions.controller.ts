import type { Request, Response } from "express";
import { parse } from "csv-parse/sync";
import type { Transaction } from "../types/transactions.js";
import { applyAllRulesToTransaction } from "../services/ruleEngine.service.js";
import { runWrite, runRead } from "../lib/neo4j/neo4j.js";

export const uploadTransactionsCSV = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No CSV file uploaded." });
      return;
    }

    const fileBuffer = req.file.buffer;
    const records = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    // Parse CSV rows into Transaction objects
    const parsedTransactions: Transaction[] = records
      .filter((record: any) => record.id && record.id.trim() !== "") // skip blank rows
      .map((record: any) => ({
        id: record.id?.trim() || "",
        fromAccountId: record.fromAccountId || record["From Account Id"] || "",
        toAccountId: record.toAccountId || record["To Account Id"] || "",
        amount: parseFloat(record.amount || record.Amount || "0"),
        currency: record.currency || record.Currency || "USD",
        txnDate: new Date(
          record.txnDate || record["Txn Date"] || record.date || ""
        ),
        txnType: record.txnType || record["Txn Type"] || "",
        description: record.description || record.Description || "",
        referenceNumber:
          record.referenceNumber || record["Reference Number"] || "",
        isSuspicious: false,
        flagLevel: "NONE",
        flagReasons: [],
      }));

    if (parsedTransactions.length === 0) {
      res.status(400).json({ message: "No valid transactions found in CSV." });
      return;
    }

    // ─── Step 1: Wipe old transactions and insert new ones ─────────────
    // As requested, delete all existing transactions to avoid overriding issues,
    // providing a fresh slate for the new CSV upload.
    const wipeQuery = `
      MATCH ()-[r:TRANSFERS_TO]->()
      DELETE r
    `;
    await runWrite(wipeQuery, {});

    const insertQuery = `
      UNWIND $transactions AS r
      MERGE (from:BankAccount {id: r.fromAccountId})
      ON CREATE SET from.accountNumber = r.fromAccountName
      MERGE (to:BankAccount {id: r.toAccountId})
      ON CREATE SET to.accountNumber = r.toAccountName
      
      CREATE (from)-[tr:TRANSFERS_TO {id: r.id}]->(to)
      SET tr.amount          = r.amount,
          tr.currency        = r.currency,
          tr.txnDate         = r.txnDate,
          tr.txnType         = r.txnType,
          tr.description     = r.description,
          tr.referenceNumber = r.referenceNumber,
          tr.isSuspicious    = false,
          tr.flagLevel       = 'NONE',
          tr.flagReasons     = []
    `;

    const upsertPayload = parsedTransactions.map((t) => ({
      ...t,
      txnDate: t.txnDate instanceof Date ? t.txnDate.toISOString() : t.txnDate,
    }));

    await runWrite(insertQuery, { transactions: upsertPayload });

    // ─── Step 2: Run rule engine against the live graph ───────────────────
    // Now that transactions are in Neo4j, cycle detection can find real paths.
    const BATCH_SIZE = 5;
    const evaluated: Array<{ transaction: Transaction & { isSuspicious: boolean; flagLevel: string; flagReasons: string[]; severity?: number } }> = [];

    for (let i = 0; i < parsedTransactions.length; i += BATCH_SIZE) {
      const batch = parsedTransactions.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((txn) => applyAllRulesToTransaction(txn))
      );
      evaluated.push(...results);
    }

    const transactionsWithFlags = evaluated.map((r) => r.transaction);

    // ─── Step 3: Write detected flags back to Neo4j ───────────────────────
    const flagUpdateQuery = `
      UNWIND $transactions AS r
      MATCH ()-[tr:TRANSFERS_TO {id: r.id}]->()
      SET tr.isSuspicious = r.isSuspicious,
          tr.flagLevel    = r.flagLevel,
          tr.flagReasons  = r.flagReasons
    `;

    const flagPayload = transactionsWithFlags.map((t) => ({
      id: t.id,
      isSuspicious: t.isSuspicious,
      flagLevel: t.flagLevel,
      flagReasons: t.flagReasons,
    }));

    await runWrite(flagUpdateQuery, { transactions: flagPayload });

    res.status(200).json({
      message: "Transactions saved and analysed successfully",
      count: transactionsWithFlags.length,
      transactions: transactionsWithFlags,
    });
  } catch (error: any) {
    console.error("Error processing CSV:", error);
    res.status(500).json({
      message: "Failed to process CSV file",
      error: error.message,
    });
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const { search, flagLevel } = req.query;
    
    // Build Cypher query
    let cypher = `
      MATCH (from:BankAccount)-[tr:TRANSFERS_TO]->(to:BankAccount)
    `;
    
    // Add WHERE clauses depending on filters
    const conditions: string[] = [];
    const params: any = {};
    
    if (flagLevel && flagLevel !== 'ALL') {
      // Case-insensitive match — handles both 'Critical' and 'CRITICAL' in DB
      conditions.push(`toUpper(tr.flagLevel) = toUpper($flagLevel)`);
      params.flagLevel = flagLevel as string;
    }
    
    if (search) {
      conditions.push(`(toLower(tr.id) CONTAINS toLower($search) OR toLower(tr.description) CONTAINS toLower($search))`);
      params.search = search as string;
    }

    if (conditions.length > 0) {
      cypher += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    cypher += `
      RETURN 
        from.accountNumber AS fromAccountName,
        from.id AS fromAccountId,
        to.accountNumber AS toAccountName,
        to.id AS toAccountId,
        tr.id AS id,
        tr.amount AS amount,
        tr.currency AS currency,
        tr.txnDate AS txnDate,
        tr.txnType AS txnType,
        tr.description AS description,
        tr.referenceNumber AS referenceNumber,
        tr.isSuspicious AS isSuspicious,
        toUpper(tr.flagLevel) AS flagLevel,
        tr.flagReasons AS flagReasons
      ORDER BY tr.txnDate DESC
      LIMIT 200
    `;

    const records = await runRead(cypher, params);
    res.status(200).json(records);
  } catch (error: any) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      message: "Failed to fetch transactions",
      error: error.message,
    });
  }
};

export const getTransactionTrail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Step 1: Fetch the target transaction and its endpoints
    const txnQuery = `
      MATCH (from:BankAccount)-[tr:TRANSFERS_TO {id: $id}]->(to:BankAccount)
      RETURN
        from.id AS fromAccountId,
        to.id AS toAccountId,
        tr.id AS txnId,
        tr.flagLevel AS flagLevel,
        tr.flagReasons AS flagReasons
    `;
    const txnRows = await runRead<any>(txnQuery, { id });

    if (txnRows.length === 0) {
      res.status(404).json({ message: "Transaction not found" });
      return;
    }

    const { fromAccountId, toAccountId } = txnRows[0];

    // Step 2: Find all cycles involving this transaction (from → ... → from, up to 8 hops)
    const cycleQuery = `
      MATCH (from:BankAccount {id: $fromAccountId})
      MATCH (to:BankAccount {id: $toAccountId})
      MATCH path = (to)-[:TRANSFERS_TO*1..7]->(from)
      WITH nodes(path) AS pathNodes, relationships(path) AS pathRels
      RETURN
        [n IN pathNodes | { id: n.id, label: n.accountNumber, type: 'BankAccount', flagLevel: n.flagLevel }] AS pathNodeData,
        [r IN pathRels  | {
          id: r.id,
          source: startNode(r).id,
          target: endNode(r).id,
          amount: r.amount,
          currency: r.currency,
          txnType: r.txnType,
          description: r.description,
          isSuspicious: r.isSuspicious,
          flagLevel: toUpper(coalesce(r.flagLevel, 'NONE')),
          flagReasons: r.flagReasons
        }] AS pathRelData
      LIMIT 5
    `;
    const cycleRows = await runRead<any>(cycleQuery, { fromAccountId, toAccountId });

    // Step 3: Also include the original transaction itself as an edge + its two nodes
    const originQuery = `
      MATCH (from:BankAccount {id: $fromAccountId})-[tr:TRANSFERS_TO {id: $id}]->(to:BankAccount {id: $toAccountId})
      RETURN
        from.id AS fromId, from.accountNumber AS fromLabel,
        to.id AS toId, to.accountNumber AS toLabel,
        tr.id AS trId, tr.amount AS amount, tr.currency AS currency,
        tr.txnType AS txnType, tr.description AS description,
        tr.isSuspicious AS isSuspicious,
        toUpper(coalesce(tr.flagLevel, 'NONE')) AS flagLevel,
        tr.flagReasons AS flagReasons
    `;
    const originRows = await runRead<any>(originQuery, { fromAccountId, toAccountId, id });

    // Build deduplicated node + link sets
    const nodeMap = new Map<string, any>();
    const linkMap = new Map<string, any>();

    // Add origin nodes
    if (originRows.length > 0) {
      const o = originRows[0];
      nodeMap.set(o.fromId, { id: o.fromId, label: o.fromLabel || o.fromId, type: 'BankAccount' });
      nodeMap.set(o.toId, { id: o.toId, label: o.toLabel || o.toId, type: 'BankAccount' });
      linkMap.set(o.trId, {
        id: o.trId,
        source: o.fromId,
        target: o.toId,
        amount: o.amount,
        currency: o.currency,
        txnType: o.txnType,
        description: o.description,
        isSuspicious: o.isSuspicious,
        flagLevel: o.flagLevel,
        flagReasons: o.flagReasons,
        isCyclePath: true,
      });
    }

    // Add cycle path nodes/edges
    for (const row of cycleRows) {
      for (const n of row.pathNodeData || []) {
        if (!nodeMap.has(n.id)) {
          nodeMap.set(n.id, { id: n.id, label: n.label || n.id, type: n.type || 'BankAccount' });
        }
      }
      for (const r of row.pathRelData || []) {
        if (!linkMap.has(r.id)) {
          linkMap.set(r.id, { ...r, isCyclePath: true });
        }
      }
    }

    // Step 4: Collect all related suspicious transactions from the cycle paths
    const allTxnIds = Array.from(linkMap.keys());
    const relatedTxnsQuery = allTxnIds.length > 0 ? `
      MATCH (from:BankAccount)-[tr:TRANSFERS_TO]->(to:BankAccount)
      WHERE tr.id IN $ids AND tr.isSuspicious = true AND tr.id <> $originId
      RETURN
        from.accountNumber AS fromAccountName,
        from.id AS fromAccountId,
        to.accountNumber AS toAccountName,
        to.id AS toAccountId,
        tr.id AS id, tr.amount AS amount, tr.currency AS currency,
        tr.txnDate AS txnDate, tr.txnType AS txnType,
        tr.description AS description,
        tr.isSuspicious AS isSuspicious,
        toUpper(coalesce(tr.flagLevel, 'NONE')) AS flagLevel,
        tr.flagReasons AS flagReasons
      LIMIT 20
    ` : null;

    let relatedTransactions: any[] = [];
    if (relatedTxnsQuery) {
      relatedTransactions = await runRead<any>(relatedTxnsQuery, { ids: allTxnIds, originId: id });
    }

    res.status(200).json({
      nodes: Array.from(nodeMap.values()),
      links: Array.from(linkMap.values()),
      relatedTransactions,
    });
  } catch (error: any) {
    console.error("Error fetching transaction trail:", error);
    res.status(500).json({
      message: "Failed to fetch transaction trail",
      error: error.message,
    });
  }
};

