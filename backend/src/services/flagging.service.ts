import { runWrite, runRead } from "../lib/neo4j/neo4j";

// ─── Severity helpers ────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  NONE: 0,
};

function getCount(res: any[]): number {
  if (!res || res.length === 0) return 0;
  const val = res[0].cnt;
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && 'low' in val) return val.low;
  return Number(val);
}

const LEVEL_DOWN: Record<string, string> = {
  CRITICAL: "HIGH",
  HIGH: "MEDIUM",
  MEDIUM: "LOW",
  LOW: "NONE", // LOW does not propagate further
};

// ─── Phase 0 — Reset transactions only ──────────────────────────────────────
// Companies, Persons, and BankAccounts keep their flags across runs.
// Only TRANSFERS_TO edges are cleared so rules can re-score from scratch.

export async function resetEntityFlags(): Promise<void> {
  // We reset BankAccount, Company, and Person nodes.
  // We do NOT reset TRANSFERS_TO (transactions) because those are the inputs from the Rule Engine.
  await runWrite(
    `MATCH (n)
     WHERE n:BankAccount OR n:Company OR n:Person
     SET n.flagLevel = 'NONE', n.flagReasons = []`
  );
}

// ─── Phase 2 — BankAccounts ← flagged transactions ──────────────────────────
// Sender account gets the full transaction flag level.
// Receiver account gets one level lower ("connected but not the source").

export async function flagAccountsFromTransactions(): Promise<void> {
  await runWrite(
    `MATCH (from:BankAccount)-[tr:TRANSFERS_TO]->(to:BankAccount)
     WHERE tr.flagLevel <> 'NONE'

     // ── Upgrade fromAccount (sender — full responsibility) ──
     SET from.flagLevel = CASE
       WHEN from.flagLevel = 'CRITICAL' OR tr.flagLevel = 'CRITICAL' THEN 'CRITICAL'
       WHEN from.flagLevel = 'HIGH'     OR tr.flagLevel = 'HIGH'     THEN 'HIGH'
       WHEN from.flagLevel = 'MEDIUM'   OR tr.flagLevel = 'MEDIUM'   THEN 'MEDIUM'
       ELSE 'LOW'
     END,
     from.flagReasons = [x IN
       CASE WHEN from.flagReasons IS NULL THEN [] ELSE from.flagReasons END +
       ['txn_flagged'] +
       CASE WHEN tr.flagReasons IS NULL THEN [] ELSE tr.flagReasons END
     WHERE x IS NOT NULL AND x <> '' | x]

     // ── Upgrade toAccount (receiver — one level lower) ──
     WITH from, to, tr
     SET to.flagLevel = CASE
       WHEN to.flagLevel = 'CRITICAL'                              THEN 'CRITICAL'
       WHEN tr.flagLevel = 'CRITICAL' AND to.flagLevel = 'HIGH'   THEN 'HIGH'
       WHEN tr.flagLevel = 'CRITICAL'                             THEN 'HIGH'
       WHEN tr.flagLevel = 'HIGH' AND to.flagLevel IN ['CRITICAL','HIGH'] THEN to.flagLevel
       WHEN tr.flagLevel = 'HIGH'                                 THEN 'MEDIUM'
       WHEN to.flagLevel = 'HIGH'                                 THEN 'HIGH'
       WHEN tr.flagLevel = 'MEDIUM' AND to.flagLevel IN ['CRITICAL','HIGH','MEDIUM'] THEN to.flagLevel
       WHEN tr.flagLevel = 'MEDIUM'                               THEN 'LOW'
       WHEN to.flagLevel = 'MEDIUM'                               THEN 'MEDIUM'
       ELSE to.flagLevel
     END,
     to.flagReasons = CASE
       WHEN tr.flagLevel <> 'NONE'
       THEN [x IN
         CASE WHEN to.flagReasons IS NULL THEN [] ELSE to.flagReasons END +
         ['connected_to_flagged_txn']
       WHERE x IS NOT NULL AND x <> '' | x]
       ELSE to.flagReasons
     END`
  );
}

// ─── Phase 3 — 3-hop transaction chain propagation ──────────────────────────
// For each flagged BankAccount, walk outgoing/incoming TRANSFERS_TO up to 3 hops
// and flag those *transactions* (not accounts) with decreasing severity.
// Severity mapping per hop:
//   CRITICAL origin: hop1 → MEDIUM, hop2 → LOW
//   HIGH origin:     hop1 → MEDIUM, hop2 → LOW
//   (MEDIUM origin:  hop1 → LOW)
//
// Transaction chain flags use reason format: hop{n}_of_{level}_account

export async function flagTransactionChains(): Promise<void> {
  // Hop 1 — transactions going out of or into flagged accounts
  await runWrite(
    `MATCH (flaggedAcc:BankAccount)
     WHERE flaggedAcc.flagLevel IN ['CRITICAL', 'HIGH', 'MEDIUM']
     MATCH (flaggedAcc)-[tr:TRANSFERS_TO]->(neighbor:BankAccount)
     WHERE tr.flagLevel = 'NONE'
     SET tr.flagLevel = CASE
       WHEN flaggedAcc.flagLevel IN ['CRITICAL', 'HIGH'] THEN 'MEDIUM'
       WHEN flaggedAcc.flagLevel = 'MEDIUM' THEN 'LOW'
       ELSE 'NONE'
     END,
     tr.flagReasons = CASE
       WHEN flaggedAcc.flagLevel IN ['CRITICAL', 'HIGH'] THEN ['hop1_of_' + toLower(flaggedAcc.flagLevel) + '_account']
       WHEN flaggedAcc.flagLevel = 'MEDIUM'             THEN ['hop1_of_medium_account']
       ELSE tr.flagReasons
     END`
  );

  // Also walk incoming direction for hop 1 (accounts sending to the flagged one)
  await runWrite(
    `MATCH (flaggedAcc:BankAccount)
     WHERE flaggedAcc.flagLevel IN ['CRITICAL', 'HIGH', 'MEDIUM']
     MATCH (neighbor:BankAccount)-[tr:TRANSFERS_TO]->(flaggedAcc)
     WHERE tr.flagLevel = 'NONE'
     SET tr.flagLevel = CASE
       WHEN flaggedAcc.flagLevel IN ['CRITICAL', 'HIGH'] THEN 'MEDIUM'
       WHEN flaggedAcc.flagLevel = 'MEDIUM' THEN 'LOW'
       ELSE 'NONE'
     END,
     tr.flagReasons = CASE
       WHEN flaggedAcc.flagLevel IN ['CRITICAL', 'HIGH'] THEN ['hop1_of_' + toLower(flaggedAcc.flagLevel) + '_account']
       WHEN flaggedAcc.flagLevel = 'MEDIUM'             THEN ['hop1_of_medium_account']
       ELSE tr.flagReasons
     END`
  );

  // Hop 2 — transactions connected to hop-1 neighbors (lower severity again)
  await runWrite(
    `MATCH (flaggedAcc:BankAccount)
     WHERE flaggedAcc.flagLevel IN ['CRITICAL', 'HIGH']
     MATCH (flaggedAcc)-[:TRANSFERS_TO]->(hop1:BankAccount)-[tr:TRANSFERS_TO]->(hop2:BankAccount)
     WHERE tr.flagLevel = 'NONE'
     SET tr.flagLevel = 'LOW',
         tr.flagReasons = ['hop2_of_' + toLower(flaggedAcc.flagLevel) + '_account']`
  );

  await runWrite(
    `MATCH (flaggedAcc:BankAccount)
     WHERE flaggedAcc.flagLevel IN ['CRITICAL', 'HIGH']
     MATCH (hop2:BankAccount)-[tr:TRANSFERS_TO]->(hop1:BankAccount)-[:TRANSFERS_TO]->(flaggedAcc)
     WHERE tr.flagLevel = 'NONE'
     SET tr.flagLevel = 'LOW',
         tr.flagReasons = ['hop2_of_' + toLower(flaggedAcc.flagLevel) + '_account']`
  );
}

// ─── Phase 4 — Companies ← BankAccounts (HOLDS_ACCOUNT) ─────────────────────
// A company that holds a flagged account is flagged at the same level.
// No attenuation — the company is the account holder.

export async function flagCompaniesFromAccounts(): Promise<void> {
  await runWrite(
    `MATCH (c:Company)-[:HOLDS_ACCOUNT]->(b:BankAccount)
     WHERE b.flagLevel <> 'NONE'
     SET c.flagLevel = CASE
       WHEN c.flagLevel = 'CRITICAL' OR b.flagLevel = 'CRITICAL' THEN 'CRITICAL'
       WHEN c.flagLevel = 'HIGH'     OR b.flagLevel = 'HIGH'     THEN 'HIGH'
       WHEN c.flagLevel = 'MEDIUM'   OR b.flagLevel = 'MEDIUM'   THEN 'MEDIUM'
       ELSE 'LOW'
     END,
     c.flagReasons = [x IN coalesce(c.flagReasons, []) + ['holds_flagged_account'] WHERE x IS NOT NULL AND x <> '' | x]`
  );
}

// ─── Phase 5 — Persons ← Companies (OWNS) ───────────────────────────────────
// All beneficial owners flagged at the same level as the company.
// No attenuation — all beneficiaries are equally responsible.

export async function flagPersonsFromCompanies(): Promise<void> {
  await runWrite(
    `MATCH (p:Person)-[:OWNS]->(c:Company)
     WHERE c.flagLevel <> 'NONE'
     SET p.flagLevel = CASE
       WHEN p.flagLevel = 'CRITICAL' OR c.flagLevel = 'CRITICAL' THEN 'CRITICAL'
       WHEN p.flagLevel = 'HIGH'     OR c.flagLevel = 'HIGH'     THEN 'HIGH'
       WHEN p.flagLevel = 'MEDIUM'   OR c.flagLevel = 'MEDIUM'   THEN 'MEDIUM'
       ELSE 'LOW'
     END,
     p.flagReasons = [x IN coalesce(p.flagReasons, []) + ['owns_flagged_company'] WHERE x IS NOT NULL AND x <> '' | x]`
  );
}

// ─── Phase 6 — Subsidiaries ↔ Parent Companies (SUBSIDIARY_OF) ──────────────
// Parent → Subsidiary: one level lower
// Subsidiary → Parent: one level lower (crime bubbles up)

export async function flagSubsidiaries(): Promise<void> {
  // Parent → Subsidiary (downward)
  await runWrite(
    `MATCH (sub:Company)-[:SUBSIDIARY_OF]->(parent:Company)
     WHERE parent.flagLevel IN ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
     WITH sub, parent,
          CASE parent.flagLevel
            WHEN 'CRITICAL' THEN 'HIGH'
            WHEN 'HIGH'     THEN 'MEDIUM'
            WHEN 'MEDIUM'   THEN 'LOW'
            ELSE 'NONE'
          END AS propagatedLevel
     WHERE propagatedLevel <> 'NONE'
     SET sub.flagLevel = CASE
       WHEN sub.flagLevel = 'CRITICAL' THEN 'CRITICAL'
       WHEN propagatedLevel = 'CRITICAL' OR sub.flagLevel = 'HIGH' THEN
         CASE WHEN propagatedLevel = 'CRITICAL' THEN 'CRITICAL' ELSE 'HIGH' END
       WHEN propagatedLevel = 'HIGH' OR sub.flagLevel = 'MEDIUM' THEN
         CASE WHEN propagatedLevel = 'HIGH' THEN 'HIGH' ELSE 'MEDIUM' END
       WHEN propagatedLevel = 'MEDIUM' OR sub.flagLevel = 'LOW' THEN
         CASE WHEN propagatedLevel = 'MEDIUM' THEN 'MEDIUM' ELSE 'LOW' END
       ELSE propagatedLevel
     END,
     sub.flagReasons = [x IN coalesce(sub.flagReasons, []) + ['flagged_via_parent_company'] WHERE x IS NOT NULL AND x <> '' | x]`
  );

  // Subsidiary → Parent (upward — crime of subsidiary escalates parent concern)
  await runWrite(
    `MATCH (sub:Company)-[:SUBSIDIARY_OF]->(parent:Company)
     WHERE sub.flagLevel IN ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
     WITH sub, parent,
          CASE sub.flagLevel
            WHEN 'CRITICAL' THEN 'HIGH'
            WHEN 'HIGH'     THEN 'MEDIUM'
            WHEN 'MEDIUM'   THEN 'LOW'
            ELSE 'NONE'
          END AS propagatedLevel
     WHERE propagatedLevel <> 'NONE'
     SET parent.flagLevel = CASE
       WHEN parent.flagLevel = 'CRITICAL' THEN 'CRITICAL'
       WHEN propagatedLevel = 'CRITICAL' THEN 'CRITICAL'
       WHEN propagatedLevel = 'HIGH'  AND parent.flagLevel IN ['CRITICAL','HIGH'] THEN parent.flagLevel
       WHEN propagatedLevel = 'HIGH'  THEN 'HIGH'
       WHEN propagatedLevel = 'MEDIUM' AND parent.flagLevel IN ['CRITICAL','HIGH','MEDIUM'] THEN parent.flagLevel
       WHEN propagatedLevel = 'MEDIUM' THEN 'MEDIUM'
       WHEN propagatedLevel = 'LOW' AND parent.flagLevel <> 'NONE' THEN parent.flagLevel
       ELSE propagatedLevel
     END,
     parent.flagReasons = [x IN (coalesce(parent.flagReasons, []) + ['flagged_via_subsidiary_company']) WHERE x IS NOT NULL AND x <> '' | x]`
  );
}

// ─── Phase 6b — Re-run person flagging for newly flagged subsidiaries ────────

export async function flagPersonsFromSubsidiaries(): Promise<void> {
  // Subsidiaries that got flagged in Phase 6 may have owners not yet flagged
  await runWrite(
    `MATCH (p:Person)-[:OWNS]->(c:Company)
     WHERE c.flagLevel <> 'NONE'
       AND 'flagged_via_parent_company' IN coalesce(c.flagReasons, [])
       AND (p.flagLevel = 'NONE' OR
            CASE c.flagLevel
              WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1
            END >
            CASE p.flagLevel
              WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1
            END)
     SET p.flagLevel = CASE
       WHEN p.flagLevel = 'CRITICAL' OR c.flagLevel = 'CRITICAL' THEN 'CRITICAL'
       WHEN p.flagLevel = 'HIGH'     OR c.flagLevel = 'HIGH'     THEN 'HIGH'
       WHEN p.flagLevel = 'MEDIUM'   OR c.flagLevel = 'MEDIUM'   THEN 'MEDIUM'
       ELSE 'LOW'
     END,
     p.flagReasons = [x IN coalesce(p.flagReasons, []) + ['owns_flagged_company'] WHERE x IS NOT NULL AND x <> '' | x]`
  );
}

// ─── Phase 7 — FlagEvent upsert (daily overwrite) ───────────────────────────
// Overwrites the FlagEvent for each flagged entity.
// Manual overrides are never touched — they have triggeredBy = 'manual_override'.

export async function upsertFlagEvents(now: string): Promise<void> {
  await runWrite(
    `MATCH (n)
     WHERE (n:Company OR n:Person OR n:BankAccount) AND n.flagLevel <> 'NONE'
     MERGE (fe:FlagEvent {id: 'fe_sys_' + n.id})
     SET fe.entityId    = n.id,
         fe.entityType  = labels(n)[0],
         fe.entityName  = COALESCE(n.name, n.accountNumber),
         fe.flagLevel   = n.flagLevel,
         fe.reason      = CASE
           WHEN 'cycle_detected'           IN coalesce(n.flagReasons, []) THEN 'Circular fund flow detected'
           WHEN 'cashFlowRatio'            IN coalesce(n.flagReasons, []) THEN 'Suspicious cash flow ratio (>70%)'
           WHEN 'high_volume'              IN coalesce(n.flagReasons, []) THEN 'Unusually high transaction volume'
           WHEN 'holds_flagged_account'    IN coalesce(n.flagReasons, []) THEN 'Holds a flagged bank account'
           WHEN 'owns_flagged_company'     IN coalesce(n.flagReasons, []) THEN 'Beneficial owner of a flagged company'
           WHEN 'connected_to_flagged_txn' IN coalesce(n.flagReasons, []) THEN 'Connected to flagged transaction'
           WHEN 'flagged_via_parent_company'    IN coalesce(n.flagReasons, []) THEN 'Subsidiary of a flagged company'
           WHEN 'flagged_via_subsidiary_company' IN coalesce(n.flagReasons, []) THEN 'Parent of a flagged subsidiary'
           ELSE 'System analysis flag'
         END,
         fe.flagReasons  = coalesce(n.flagReasons, []),
         fe.triggeredBy  = 'system_analysis',
         fe.resolvedAt   = null,
         fe.createdAt    = $now`,
    { now }
  );
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export async function runFullPropagation(now: string): Promise<{
  cyclesFound: number;
  entitiesFlagged: number;
}> {
  // Phase 0: Reset entities
  await resetEntityFlags();

  // Phase 2: BankAccounts from flagged transactions
  await flagAccountsFromTransactions();

  // Phase 3: 3-hop chain propagation on transactions (marks edges, not accounts)
  await flagTransactionChains();

  // Phase 4: Companies from flagged accounts
  await flagCompaniesFromAccounts();

  // Phase 5: Persons from flagged companies (no attenuation)
  await flagPersonsFromCompanies();

  // Phase 6: Subsidiaries ↔ Parents
  await flagSubsidiaries();

  // Phase 6b: Persons from newly flagged subsidiaries
  await flagPersonsFromSubsidiaries();

  // Phase 7: Write FlagEvent audit records
  await upsertFlagEvents(now);

  // Collect summary stats
  const [cycleRes, entityRes] = await Promise.all([
    runRead<{ cnt: any }>(
      `MATCH (n)
       WHERE (n:Company OR n:Person OR n:BankAccount)
         AND ('circularTransaction' IN coalesce(n.flagReasons, []) OR 'cycle_detected' IN coalesce(n.flagReasons, []))
       RETURN count(n) AS cnt`
    ).then(r => r),
    runRead<{ cnt: any }>(
      `MATCH (n)
       WHERE (n:Company OR n:Person OR n:BankAccount) AND n.flagLevel <> 'NONE'
       RETURN count(n) AS cnt`
    ).then(r => r),
  ]);

  return {
    cyclesFound: getCount(cycleRes),
    entitiesFlagged: getCount(entityRes),
  };
}
