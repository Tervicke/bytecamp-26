/**
 * Node labels  : Company | Person | BankAccount
 * Relationship types: OWNS | SUBSIDIARY_OF | HOLDS_ACCOUNT | TRANSFERS_TO
 */

import { runWrite } from './neo4j';

// ─── Constraint definitions ───────────────────────────────────────────────────

const CONSTRAINTS: string[] = [
    // Company —  id, name, jurisdiction, registrationNumber,
    //   incorporatedDate, companyType, industry, address, isShell, flagLevel, flagReasons
    `CREATE CONSTRAINT company_id_unique IF NOT EXISTS
   FOR (c:Company) REQUIRE c.id IS UNIQUE`,

    // Person — id, name, nationality, dob, passportNumber,
    //   email, phone, role, flagLevel, flagReasons
    `CREATE CONSTRAINT person_id_unique IF NOT EXISTS
   FOR (p:Person) REQUIRE p.id IS UNIQUE`,

    // BankAccount — id, accountNumber, bankName, bankCountry,
    //   currency, balance, companyId, openedDate, accountType, swiftCode, flagLevel
    `CREATE CONSTRAINT bank_account_id_unique IF NOT EXISTS
   FOR (b:BankAccount) REQUIRE b.id IS UNIQUE`,

    `CREATE CONSTRAINT bank_account_number_unique IF NOT EXISTS
   FOR (b:BankAccount) REQUIRE b.accountNumber IS UNIQUE`,

];

// ─── Index definitions ────────────────────────────────────────────────────────

const INDEXES: string[] = [
    // Company lookups
    `CREATE INDEX company_jurisdiction IF NOT EXISTS
   FOR (c:Company) ON (c.jurisdiction)`,

    `CREATE INDEX company_flag_level IF NOT EXISTS
   FOR (c:Company) ON (c.flagLevel)`,

    `CREATE INDEX company_is_shell IF NOT EXISTS
   FOR (c:Company) ON (c.isShell)`,

    // Person lookups
    `CREATE INDEX person_role IF NOT EXISTS
   FOR (p:Person) ON (p.role)`,

    `CREATE INDEX person_flag_level IF NOT EXISTS
   FOR (p:Person) ON (p.flagLevel)`,

    `CREATE INDEX person_nationality IF NOT EXISTS
   FOR (p:Person) ON (p.nationality)`,

    // BankAccount lookups
    `CREATE INDEX bank_account_flag_level IF NOT EXISTS
   FOR (b:BankAccount) ON (b.flagLevel)`,

    `CREATE INDEX bank_account_bank_country IF NOT EXISTS
   FOR (b:BankAccount) ON (b.bankCountry)`,

    `CREATE INDEX bank_account_currency IF NOT EXISTS
   FOR (b:BankAccount) ON (b.currency)`,

];

// ─── Public API ───────────────────────────────────────────────────────────────

export async function applySchema(): Promise<void> {
    console.log('[Schema] Applying Neo4j constraints and indexes...');

    for (const cypher of CONSTRAINTS) {
        await runWrite(cypher);
    }
    console.log(`[Schema] ✓ ${CONSTRAINTS.length} constraints applied`);

    for (const cypher of INDEXES) {
        await runWrite(cypher);
    }
    console.log(`[Schema] ✓ ${INDEXES.length} indexes applied`);

    console.log('[Schema] Schema ready.');
}
