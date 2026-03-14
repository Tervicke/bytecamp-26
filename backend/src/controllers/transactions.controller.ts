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

    const parsedTransactions: Transaction[] = records.map((record: any) => ({
      id: record.id || record.Id || "",
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
      isSuspicious:
        String(
          record.isSuspicious || record["Is Suspicious"] || ""
        ).toLowerCase() === "true",
      flagLevel: record.flagLevel || record["Flag Level"] || "Low",
      flagReasons: record.flagReasons
        ? String(record.flagReasons).split(",")
        : [],
    }));

    // Format dates for Neo4j
    const cypherPayload = parsedTransactions.map(t => ({
      ...t,
      txnDate: t.txnDate instanceof Date ? t.txnDate.toISOString() : t.txnDate,
      flagLevel: 'NONE',
      isSuspicious: false,
      flagReasons: [],
    }));

    // 1. Initial Insert: Save all transactions to Neo4j first so rule queries can see them
    const insertQuery = `
      UNWIND $transactions AS r
      MERGE (from:BankAccount {id: r.fromAccountId})
      MERGE (to:BankAccount {id: r.toAccountId})
      MERGE (from)-[tr:TRANSFERS_TO {id: r.id}]->(to)
      SET tr.amount          = r.amount,
          tr.currency        = r.currency,
          tr.txnDate         = r.txnDate,
          tr.txnType         = r.txnType,
          tr.description     = r.description,
          tr.referenceNumber = r.referenceNumber,
          tr.isSuspicious    = false,
          tr.flagLevel       = 'NONE',
          tr.flagReasons     = []
      RETURN count(*) AS inserted
    `;
    console.log("CYPHER PAYLOAD LENGTH:", cypherPayload.length);
    console.log("FIRST ELEMENT:", JSON.stringify(cypherPayload[0]));
    const insRes = await runWrite(insertQuery, { transactions: cypherPayload });
    console.log("INSERT RESULT:", insRes);

    // 2. Evaluate rules against the now-populated database
    // Process sequentially or in batches so that earlier transactions' flags don't affect this,
    // actually rules only read the graph structure, which is fully persisted now.
    const BATCH_SIZE = 10;
    const evaluated = [];
    for (let i = 0; i < parsedTransactions.length; i += BATCH_SIZE) {
      const batch = parsedTransactions.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((txn) => applyAllRulesToTransaction(txn))
      );
      evaluated.push(...results);
    }

    const transactionsWithFlags = evaluated.map((r) => r.transaction);
    const flaggedTransactions = transactionsWithFlags.filter(t => t.flagLevel !== 'NONE');
    console.log("FLAGGED TRANSACTIONS COUNT:", flaggedTransactions.length);

    // 3. Update flags for transactions that triggered rules
    if (flaggedTransactions.length > 0) {
      const updateQuery = `
        UNWIND $transactions AS r
        MATCH ()-[tr:TRANSFERS_TO {id: r.id}]->()
        SET tr.isSuspicious = r.isSuspicious,
            tr.flagLevel    = r.flagLevel,
            tr.flagReasons  = r.flagReasons
        RETURN count(tr) AS updated
      `;
      const updatePayload = flaggedTransactions.map(t => ({
        ...t,
        txnDate: t.txnDate instanceof Date ? t.txnDate.toISOString() : t.txnDate,
      }));
      await runWrite(updateQuery, { transactions: updatePayload });
    }

    res.status(200).json({
      message: "CSV file parsed, rules evaluated, and transactions saved successfully",
      count: transactionsWithFlags.length,
      transactions: transactionsWithFlags,
    });
  } catch (error: any) {
    console.error("Error parsing CSV:", error);
    res.status(500).json({
      message: "Failed to parse CSV file",
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
      conditions.push(`tr.flagLevel = $flagLevel`);
      params.flagLevel = flagLevel;
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
        tr.flagLevel AS flagLevel,
        tr.flagReasons AS flagReasons
      ORDER BY tr.txnDate DESC
      LIMIT 100
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
