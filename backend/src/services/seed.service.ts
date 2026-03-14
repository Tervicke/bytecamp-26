/**
 * db/seed.ts
 *
 * Seeds Neo4j from the 6 CSV files in /seed.
 * Uses MERGE so the script is fully idempotent (safe to re-run).
 *
 * Run standalone:  bun run db/seed.ts
 * Or call seedAll() programmatically after applySchema().
 *
 * CSV → Neo4j mapping
 * ───────────────────────────────────────────────────────
 * companies.csv       → (:Company) nodes
 * persons.csv         → (:Person) nodes
 * bank_accounts.csv   → (:BankAccount) nodes + [:HOLDS_ACCOUNT] edges
 * ownership.csv       → [:OWNS] edges (Person → Company)
 * subsidiaries.csv    → [:SUBSIDIARY_OF] edges (Company → Company)
 * transactions.csv    → [:TRANSFERS_TO] edges only (BankAccount → BankAccount)
 */

import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { connectNeo4j, closeNeo4j, runWrite } from '../lib/neo4j.ts';
import { applySchema } from '../lib/neo4j/schema.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEED_DIR = join(import.meta.dir, '../../../seed');

function readCsv<T>(filename: string): T[] {
    const raw = readFileSync(join(SEED_DIR, filename), 'utf-8');
    return parse(raw, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: false, // keep everything as strings — we cast below
    }) as T[];
}

function toBool(val: string): boolean {
    return val?.toLowerCase() === 'true';
}

function toFloat(val: string): number {
    return parseFloat(val) || 0;
}

function toStringArray(val: string): string[] {
    if (!val || val.trim() === '') return [];
    return val.split(',').map((s) => s.trim()).filter(Boolean);
}

// ─── Node seeders ─────────────────────────────────────────────────────────────

async function seedCompanies(): Promise<void> {
    const rows = readCsv<{
        id: string; name: string; jurisdiction: string; registrationNumber: string;
        incorporatedDate: string; companyType: string; industry: string;
        address: string; isShell: string; flagLevel: string; flagReasons: string;
    }>('companies.csv');

    for (const r of rows) {
        await runWrite(
            `MERGE (c:Company {id: $id})
       SET c.name              = $name,
           c.jurisdiction      = $jurisdiction,
           c.registrationNumber = $registrationNumber,
           c.incorporatedDate  = $incorporatedDate,
           c.companyType       = $companyType,
           c.industry          = $industry,
           c.address           = $address,
           c.isShell           = $isShell,
           c.flagLevel         = $flagLevel,
           c.flagReasons       = $flagReasons`,
            {
                id: r.id,
                name: r.name,
                jurisdiction: r.jurisdiction,
                registrationNumber: r.registrationNumber,
                incorporatedDate: r.incorporatedDate,
                companyType: r.companyType,
                industry: r.industry,
                address: r.address,
                isShell: toBool(r.isShell),
                flagLevel: r.flagLevel || 'NONE',
                flagReasons: toStringArray(r.flagReasons),
            }
        );
    }
    console.log(`[Seed] ✓ Companies — ${rows.length} nodes`);
}

async function seedPersons(): Promise<void> {
    const rows = readCsv<{
        id: string; name: string; nationality: string; dob: string;
        passportNumber: string; email: string; phone: string;
        role: string; flagLevel: string; flagReasons: string;
    }>('persons.csv');

    for (const r of rows) {
        await runWrite(
            `MERGE (p:Person {id: $id})
       SET p.name           = $name,
           p.nationality    = $nationality,
           p.dob            = $dob,
           p.passportNumber = $passportNumber,
           p.email          = $email,
           p.phone          = $phone,
           p.role           = $role,
           p.flagLevel      = $flagLevel,
           p.flagReasons    = $flagReasons`,
            {
                id: r.id,
                name: r.name,
                nationality: r.nationality,
                dob: r.dob,
                passportNumber: r.passportNumber,
                email: r.email,
                phone: r.phone,
                role: r.role,
                flagLevel: r.flagLevel || 'NONE',
                flagReasons: toStringArray(r.flagReasons),
            }
        );
    }
    console.log(`[Seed] ✓ Persons — ${rows.length} nodes`);
}

async function seedBankAccounts(): Promise<void> {
    const rows = readCsv<{
        id: string; accountNumber: string; bankName: string; bankCountry: string;
        currency: string; balance: string; companyId: string; openedDate: string;
        accountType: string; swiftCode: string; flagLevel: string;
    }>('bank_accounts.csv');

    for (const r of rows) {
        // Upsert the BankAccount node
        await runWrite(
            `MERGE (b:BankAccount {id: $id})
       SET b.accountNumber = $accountNumber,
           b.bankName      = $bankName,
           b.bankCountry   = $bankCountry,
           b.currency      = $currency,
           b.balance       = $balance,
           b.companyId     = $companyId,
           b.openedDate    = $openedDate,
           b.accountType   = $accountType,
           b.swiftCode     = $swiftCode,
           b.flagLevel     = $flagLevel`,
            {
                id: r.id,
                accountNumber: r.accountNumber,
                bankName: r.bankName,
                bankCountry: r.bankCountry,
                currency: r.currency,
                balance: toFloat(r.balance),
                companyId: r.companyId,
                openedDate: r.openedDate,
                accountType: r.accountType,
                swiftCode: r.swiftCode,
                flagLevel: r.flagLevel || 'NONE',
            }
        );

        // Create HOLDS_ACCOUNT relationship: (Company)-[:HOLDS_ACCOUNT]->(BankAccount)
        await runWrite(
            `MATCH (c:Company {id: $companyId}), (b:BankAccount {id: $id})
       MERGE (c)-[:HOLDS_ACCOUNT {since: $openedDate, accountType: $accountType}]->(b)`,
            { companyId: r.companyId, id: r.id, openedDate: r.openedDate, accountType: r.accountType }
        );
    }
    console.log(`[Seed] ✓ BankAccounts — ${rows.length} nodes + HOLDS_ACCOUNT edges`);
}

// ─── Relationship seeders ─────────────────────────────────────────────────────

async function seedOwnership(): Promise<void> {
    const rows = readCsv<{
        personId: string; companyId: string; ownershipPct: string;
        effectiveDate: string; ownershipType: string; notes: string;
    }>('ownership.csv');

    for (const r of rows) {
        await runWrite(
            `MATCH (p:Person {id: $personId}), (c:Company {id: $companyId})
       MERGE (p)-[o:OWNS {personId: $personId, companyId: $companyId}]->(c)
       SET o.ownershipPct   = $ownershipPct,
           o.effectiveDate  = $effectiveDate,
           o.ownershipType  = $ownershipType,
           o.notes          = $notes`,
            {
                personId: r.personId,
                companyId: r.companyId,
                ownershipPct: toFloat(r.ownershipPct),
                effectiveDate: r.effectiveDate,
                ownershipType: r.ownershipType,
                notes: r.notes,
            }
        );
    }
    console.log(`[Seed] ✓ Ownership — ${rows.length} OWNS edges`);
}

async function seedSubsidiaries(): Promise<void> {
    const rows = readCsv<{
        parentCompanyId: string; subsidiaryCompanyId: string; sharesPct: string;
        effectiveDate: string; relationshipType: string; notes: string;
    }>('subsidiaries.csv');

    for (const r of rows) {
        // Only create edge when both nodes exist (c026 doesn't exist — skip gracefully)
        await runWrite(
            `MATCH (parent:Company {id: $parentId}), (sub:Company {id: $subId})
       MERGE (sub)-[s:SUBSIDIARY_OF {parentId: $parentId, subId: $subId}]->(parent)
       SET s.sharesPct        = $sharesPct,
           s.effectiveDate    = $effectiveDate,
           s.relationshipType = $relationshipType,
           s.notes            = $notes`,
            {
                parentId: r.parentCompanyId,
                subId: r.subsidiaryCompanyId,
                sharesPct: toFloat(r.sharesPct),
                effectiveDate: r.effectiveDate,
                relationshipType: r.relationshipType,
                notes: r.notes,
            }
        );
    }
    console.log(`[Seed] ✓ Subsidiaries — ${rows.length} SUBSIDIARY_OF edges`);
}

async function seedTransactions(): Promise<void> {
    const rows = readCsv<{
        id: string; fromAccountId: string; toAccountId: string; amount: string;
        currency: string; txnDate: string; txnType: string; description: string;
        referenceNumber: string; isSuspicious: string; flagLevel: string; flagReasons: string;
    }>('transactions.csv');

    for (const r of rows) {
        // Transactions are edges only — all fields live on the TRANSFERS_TO relationship
        await runWrite(
            `MATCH (from:BankAccount {id: $fromId}), (to:BankAccount {id: $toId})
       MERGE (from)-[tr:TRANSFERS_TO {id: $id}]->(to)
       SET tr.amount          = $amount,
           tr.currency        = $currency,
           tr.txnDate         = $txnDate,
           tr.txnType         = $txnType,
           tr.description     = $description,
           tr.referenceNumber = $referenceNumber,
           tr.isSuspicious    = $isSuspicious,
           tr.flagLevel       = $flagLevel,
           tr.flagReasons     = $flagReasons`,
            {
                fromId: r.fromAccountId,
                toId: r.toAccountId,
                id: r.id,
                amount: toFloat(r.amount),
                currency: r.currency,
                txnDate: r.txnDate,
                txnType: r.txnType,
                description: r.description,
                referenceNumber: r.referenceNumber,
                isSuspicious: toBool(r.isSuspicious),
                flagLevel: r.flagLevel || 'NONE',
                flagReasons: toStringArray(r.flagReasons),
            }
        );
    }
    console.log(`[Seed] ✓ Transactions — ${rows.length} TRANSFERS_TO edges (no Transaction nodes)`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function seedAll(): Promise<void> {
    console.log('[Seed] Starting full seed...');

    // Order matters: nodes first, then relationships that reference them
    await seedCompanies();
    await seedPersons();
    await seedBankAccounts();   // also creates HOLDS_ACCOUNT
    await seedOwnership();      // OWNS (Person → Company)
    await seedSubsidiaries();   // SUBSIDIARY_OF (Company → Company)
    await seedTransactions();   // TRANSFERS_TO edges only (no Transaction nodes)

    console.log('[Seed] ✅ All data seeded successfully.');
}

// ─── Standalone runner ────────────────────────────────────────────────────────

// Run with: bun run server/db/seed.ts
if (import.meta.main) {
    await connectNeo4j();
    await applySchema();
    await seedAll();
    await closeNeo4j();
    process.exit(0);
}
