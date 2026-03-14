import type { Request, Response } from "express";
import { parse } from "csv-parse/sync";
import type { Transaction } from "../types/transactions.js";
import { applyAllRulesToTransaction } from "../services/ruleEngine.service.js";

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

    res.status(200).json({
      message: "CSV file parsed and rules evaluated successfully",
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
