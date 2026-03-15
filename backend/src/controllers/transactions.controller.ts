import type { Request, Response } from "express";
import { parse } from "csv-parse/sync";
import type { Transaction } from "../types/transactions.js";
import { applyAllRulesToTransaction } from "../services/ruleEngine.service.js";
import { runWrite, runRead } from "../lib/neo4j/neo4j.js";
import neo4j from "neo4j-driver";

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
    const { search, flagLevel, page = "1", limit = "20" } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const limitInt = parseInt(limit as string);

    // Build WHERE clauses depending on filters
    const conditions: string[] = [];
    const params: any = {
      skip: neo4j.int(skip),
      limit: neo4j.int(limitInt)
    };

    if (flagLevel && flagLevel !== 'ALL') {
      conditions.push(`toUpper(tr.flagLevel) = toUpper($flagLevel)`);
      params.flagLevel = flagLevel as string;
    }

    if (search) {
      conditions.push(`(toLower(tr.id) CONTAINS toLower($search) OR toLower(tr.description) CONTAINS toLower($search))`);
      params.search = search as string;
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    // Query for total count
    const countCypher = `
      MATCH (from:BankAccount)-[tr:TRANSFERS_TO]->(to:BankAccount)
      ${whereClause}
      RETURN count(tr) AS total
    `;

    const countRecords = await runRead(countCypher, params);
    let totalCount = countRecords[0]?.total || 0;
    if (neo4j.isInt(totalCount)) {
      totalCount = totalCount.toNumber();
    }

    // Query for paginated transactions
    const cypher = `
      MATCH (from:BankAccount)-[tr:TRANSFERS_TO]->(to:BankAccount)
      ${whereClause}
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
      SKIP $skip
      LIMIT $limit
    `;

    const records = await runRead(cypher, params);
    res.status(200).json({
      transactions: records,
      totalCount: Number(totalCount)
    });
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

