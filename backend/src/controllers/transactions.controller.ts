import type { Request, Response } from "express";
import { parse } from "csv-parse/sync";
import type { Transaction } from "../types/transactions.js";
import { applyAllRulesToTransaction } from "../services/ruleEngine.service.js";
import { runWrite, runRead } from "../lib/neo4j.js";

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

    const evaluated = await Promise.all(
      parsedTransactions.map(async (txn) => applyAllRulesToTransaction(txn))
    );

    const transactionsWithFlags = evaluated.map((r) => r.transaction);

    // Persist to Neo4j
    const query = `
      UNWIND $transactions AS r
      MATCH (from:BankAccount {id: r.fromAccountId})
      MATCH (to:BankAccount {id: r.toAccountId})
      MERGE (from)-[tr:TRANSFERS_TO {id: r.id}]->(to)
      SET tr.amount          = r.amount,
          tr.currency        = r.currency,
          tr.txnDate         = r.txnDate,
          tr.txnType         = r.txnType,
          tr.description     = r.description,
          tr.referenceNumber = r.referenceNumber,
          tr.isSuspicious    = r.isSuspicious,
          tr.flagLevel       = r.flagLevel,
          tr.flagReasons     = r.flagReasons
    `;

    // Re-format txnDate to ISO string because Neo4j driver rejects raw JS Date objects sometimes,
    // and we want it to be compatible with how seeding handled it.
    const cypherPayload = transactionsWithFlags.map(t => ({
      ...t,
      txnDate: t.txnDate instanceof Date ? t.txnDate.toISOString() : t.txnDate,
    }));

    await runWrite(query, { transactions: cypherPayload });

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
