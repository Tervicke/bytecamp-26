import type { Request, Response } from 'express';
import { runQuery, runWrite } from '../lib/neo4j/neo4j.js';
import crypto from 'crypto';

// ─── Flag Events ─────────────────────────────────────────────────────────────

/**
 * GET /api/flags
 * Returns all FlagEvent nodes in the DB.
 * FlagEvents are created by the analysis pipeline or manual override.
 */
export const getFlags = async (_req: Request, res: Response): Promise<void> => {
  try {
    const records = await runQuery<{ fe: any }>(
      `MATCH (fe:FlagEvent)
       RETURN fe
       ORDER BY fe.createdAt DESC`
    );

    const realFlags = records.map(r => {
      const p = r.fe?.properties ?? r.fe ?? r;
      return {
        id:         p.id,
        entityId:   p.entityId,
        entityType: p.entityType,   
        entityName: p.entityName,
        flagLevel:  p.flagLevel,
        reason:     p.reason,
        triggeredBy: p.triggeredBy,
        resolvedAt: p.resolvedAt ?? null,
        createdAt:  p.createdAt,
      };
    });

    const flaggedRecords = await runQuery<any>(
      `MATCH (n)
       WHERE (n:Company OR n:Person OR n:BankAccount) AND n.flagLevel <> 'NONE'
       RETURN 
         n.id AS id,
         labels(n)[0] AS entityType,
         COALESCE(n.name, n.accountNumber) AS entityName,
         n.flagLevel AS flagLevel,
         n.flagReasons AS reasons`
    );

    const activeEntityFlags = flaggedRecords.map((r: any) => ({
      id: `sys_fe_${r.id}`,
      entityId: r.id,
      entityType: r.entityType,
      entityName: r.entityName,
      flagLevel: r.flagLevel,
      reason: (r.reasons || []).join(', ') || 'System detected flag',
      triggeredBy: 'system_analysis',
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    }));

    const realEntityIds = new Set(realFlags.map(f => f.entityId));
    const combined = [
      ...realFlags,
      ...activeEntityFlags.filter(f => !realEntityIds.has(f.entityId))
    ];

    res.json(combined);
  } catch (err: any) {
    console.error('[flags] getFlags error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/flags/override
 * Body: { entityId: string, flagLevel: string }
 * Overwrites the flagLevel on the matched entity node (Company | Person | BankAccount)
 * and upserts a FlagEvent node to record the manual override.
 */
export const overrideFlagLevel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { entityId, flagLevel } = req.body;

    if (!entityId || !flagLevel) {
      res.status(400).json({ error: 'entityId and flagLevel are required' });
      return;
    }

    const VALID_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];
    if (!VALID_LEVELS.includes(flagLevel)) {
      res.status(400).json({ error: `flagLevel must be one of: ${VALID_LEVELS.join(', ')}` });
      return;
    }

    // Update the entity's flagLevel (works across all three label types)
    const updateResult = await runWrite<{ entityName: string; entityType: string }>(
      `MATCH (n)
       WHERE (n:Company OR n:Person OR n:BankAccount) AND n.id = $entityId
       SET n.flagLevel = $flagLevel,
           n.flagReasons = CASE WHEN $flagLevel = 'NONE' THEN [] ELSE n.flagReasons END
       RETURN n.name AS entityName, labels(n)[0] AS entityType`,
      { entityId, flagLevel }
    );

    if (!updateResult.length) {
      res.status(404).json({ error: `Entity with id '${entityId}' not found` });
      return;
    }

    const { entityName, entityType } = updateResult[0] as any;
    const now = new Date().toISOString();
    const feId = `fe_${crypto.randomUUID()}`;

    // Create a FlagEvent node to record the override
    await runWrite(
      `MERGE (fe:FlagEvent {id: $id})
       SET fe.entityId    = $entityId,
           fe.entityType  = $entityType,
           fe.entityName  = $entityName,
           fe.flagLevel   = $flagLevel,
           fe.reason      = $reason,
           fe.triggeredBy = 'manual_override',
           fe.resolvedAt  = null,
           fe.createdAt   = $createdAt`,
      {
        id: feId,
        entityId,
        entityType,
        entityName,
        flagLevel,
        reason: `Manual admin override to ${flagLevel}`,
        createdAt: now,
      }
    );

    res.json({
      success: true,
      entityId,
      entityName,
      entityType,
      newFlagLevel: flagLevel,
      eventId: feId,
    });
  } catch (err: any) {
    console.error('[flags] overrideFlagLevel error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

/**
 * GET /api/dashboard/stats
 * Aggregates key metrics from the graph.
 */
export const getDashboardStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [txnStats, entityStats, cycleStats, runStats] = await Promise.all([
      // Transaction counts
      runQuery<{ total: any; flagged: any; critical: any }>(
        `MATCH ()-[t:TRANSFERS_TO]->()
         RETURN
           count(t) AS total,
           count(CASE WHEN t.flagLevel <> 'NONE' THEN 1 END) AS flagged,
           count(CASE WHEN t.flagLevel = 'CRITICAL' THEN 1 END) AS critical`
      ),
      // Entities flagged (Company + Person + BankAccount with flagLevel != NONE)
      runQuery<{ entitiesFlagged: any }>(
        `MATCH (n)
         WHERE (n:Company OR n:Person OR n:BankAccount) AND n.flagLevel <> 'NONE'
         RETURN count(n) AS entitiesFlagged`
      ),
      // Active cycles — count entities whose flagReasons include 'cycle_detected'
      runQuery<{ activeCycles: any }>(
        `MATCH (n)
         WHERE (n:Company OR n:Person OR n:BankAccount)
           AND 'cycle_detected' IN n.flagReasons
         RETURN count(n) AS activeCycles`
      ),
      // Analysis run count (FlagEvent nodes created by non-manual triggers)
      runQuery<{ analysisRuns: any; lastAnalysis: any }>(
        `MATCH (fe:FlagEvent)
         WHERE fe.triggeredBy <> 'manual_override'
         RETURN count(fe) AS analysisRuns,
                max(fe.createdAt) AS lastAnalysis`
      ),
    ]);

    const ts = txnStats[0] as any ?? {};
    const es = entityStats[0] as any ?? {};
    const cs = cycleStats[0] as any ?? {};
    const rs = runStats[0] as any ?? {};

    res.json({
      totalTransactions: Number(ts.total ?? 0),
      flaggedTransactions: Number(ts.flagged ?? 0),
      criticalAlerts: Number(ts.critical ?? 0),
      activeCycles: Number(cs.activeCycles ?? 0),
      entitiesFlagged: Number(es.entitiesFlagged ?? 0),
      analysisRuns: Number(rs.analysisRuns ?? 0),
      lastAnalysis: rs.lastAnalysis ?? null,
    });
  } catch (err: any) {
    console.error('[flags] getDashboardStats error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/dashboard/volume
 * Returns transaction counts grouped by day (all available data, most recent 30 days).
 */
export const getVolumeChart = async (_req: Request, res: Response): Promise<void> => {
  try {
    const records = await runQuery<{ date: string; total: any; suspicious: any; amount: any }>(
      `MATCH ()-[t:TRANSFERS_TO]->()
       WHERE t.txnDate IS NOT NULL
       WITH substring(t.txnDate, 0, 10) AS date,
            count(t) AS total,
            count(CASE WHEN t.isSuspicious = true THEN 1 END) AS suspicious,
            sum(t.amount) AS amount
       RETURN date, total, suspicious, amount
       ORDER BY date DESC
       LIMIT 30`
    );

    const chart = records
      .map(r => ({
        date: (r as any).date,
        total: Number((r as any).total ?? 0),
        suspicious: Number((r as any).suspicious ?? 0),
        amount: Number((r as any).amount ?? 0),
      }))
      .reverse(); // chronological order for charts

    res.json(chart);
  } catch (err: any) {
    console.error('[flags] getVolumeChart error:', err);
    res.status(500).json({ error: err.message });
  }
};


/**
 * POST /api/analysis/run
 * Real analysis pipeline:
 * 1. Detect TRANSFERS_TO cycles (circular fund flows)
 * 2. Detect high cash-flow-ratio accounts (txnCount vs total volume)
 * 3. Flag companies connected to flagged entities (propagation up to 1 hop)
 * 4. Write flagLevel / flagReasons back to affected nodes
 * 5. Persist FlagEvent nodes for audit trail
 */
export const runAnalysis = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date().toISOString();
    let cyclesFound = 0;
    let entitiesFlagged = 0;

    // ── Step 1: Reset all system-generated flags; keep any manually-overridden flags ──
    // First collect entities that have a manual override FlagEvent
    const manuallyOverridden = await runQuery<{ eid: string }>(
      `MATCH (fe:FlagEvent {triggeredBy: 'manual_override'}) RETURN fe.entityId AS eid`
    );
    const manualIds = manuallyOverridden.map((r: any) => r.eid).filter(Boolean);

    // Reset flagLevel for all entities NOT in the manual override list
    if (manualIds.length > 0) {
      await runWrite(
        `MATCH (n) WHERE (n:Company OR n:Person OR n:BankAccount) AND NOT n.id IN $manualIds
         SET n.flagLevel = 'NONE', n.flagReasons = []`,
        { manualIds }
      );
    } else {
      await runWrite(
        `MATCH (n) WHERE n:Company OR n:Person OR n:BankAccount
         SET n.flagLevel = 'NONE', n.flagReasons = []`
      );
    }

    // ── Step 2: Cycle detection — find accounts that appear in circular TRANSFERS_TO paths ──
    const cycleAccounts = await runWrite<{ id: string; accountNumber: string }>(
      `MATCH path = (a:BankAccount)-[:TRANSFERS_TO*2..10]->(a)
       WITH DISTINCT nodes(path) AS cycleNodes
       UNWIND cycleNodes AS acc
       SET acc.flagLevel = 'CRITICAL',
           acc.flagReasons = CASE
             WHEN 'cycle_detected' IN coalesce(acc.flagReasons, []) THEN acc.flagReasons
             ELSE coalesce(acc.flagReasons, []) + ['cycle_detected']
           END
       RETURN acc.id AS id, acc.accountNumber AS accountNumber`
    );
    cyclesFound = cycleAccounts.length;

    // Create FlagEvent nodes for cycle-detected accounts
    for (const acct of cycleAccounts) {
      const { id } = acct as any;
      if (!id) continue;
      await runWrite(
        `MERGE (fe:FlagEvent {id: $feId})
         SET fe.entityId    = $entityId,
             fe.entityType  = 'BankAccount',
             fe.entityName  = $entityName,
             fe.flagLevel   = 'CRITICAL',
             fe.reason      = 'Circular fund flow detected',
             fe.triggeredBy = 'cycle_detection',
             fe.resolvedAt  = null,
             fe.createdAt   = $createdAt`,
        {
          feId: `fe_cyc_${id}`,
          entityId: id,
          entityName: (acct as any).accountNumber ?? id,
          createdAt: now,
        }
      );
    }

    // ── Step 3: Flag BankAccounts + connected Companies with cycles ──
    await runWrite(
      `MATCH (c:Company)-[:HOLDS_ACCOUNT]->(b:BankAccount)
       WHERE 'cycle_detected' IN coalesce(b.flagReasons, [])
       SET c.flagLevel = 'CRITICAL',
           c.flagReasons = CASE
             WHEN 'cycle_detected' IN coalesce(c.flagReasons, []) THEN c.flagReasons
             ELSE coalesce(c.flagReasons, []) + ['cycle_detected']
           END`
    );

    // ── Step 4: High-volume / high cash-flow ratio detection ──
    // Flag accounts with > 20 transactions in total (a simple proxy for suspicious volume)
    await runWrite(
      `MATCH (b:BankAccount)
       WHERE b.flagLevel = 'NONE'
       WITH b, 
            size([(b)-[:TRANSFERS_TO]->() | 1]) + size([()-[:TRANSFERS_TO]->(b) | 1]) AS txnCount
       WHERE txnCount >= 20
       SET b.flagLevel = 'HIGH',
           b.flagReasons = coalesce(b.flagReasons, []) + ['high_volume']`
    );

    // ── Step 5: Flag propagation — Persons who own CRITICAL companies ──
    await runWrite(
      `MATCH (p:Person)-[:OWNS|CONTROLS]->(c:Company)
       WHERE c.flagLevel IN ['CRITICAL', 'HIGH'] AND p.flagLevel = 'NONE'
       WITH p, collect(c.flagLevel) AS companyLevels
       SET p.flagLevel = CASE WHEN 'CRITICAL' IN companyLevels THEN 'CRITICAL' ELSE 'HIGH' END,
           p.flagReasons = coalesce(p.flagReasons, []) + ['connected_to_flagged']`
    );

    // ── Step 6: Layer-1 connections — unflagged companies connected to flagged ones ──
    await runWrite(
      `MATCH (a:Company)-[:HOLDS_ACCOUNT]->()-[:TRANSFERS_TO]->()-[:HOLDS_ACCOUNT|SUBSIDIARY_OF]-(b:Company)
       WHERE b.flagLevel IN ['CRITICAL', 'HIGH'] AND a.flagLevel = 'NONE'
       SET a.flagLevel = 'MEDIUM',
           a.flagReasons = coalesce(a.flagReasons, []) + ['connected_to_flagged']`
    );

    // ── Step 7: Count total flagged entities ──
    const flaggedResult = await runQuery<{ cnt: any }>(
      `MATCH (n) WHERE (n:Company OR n:Person OR n:BankAccount) AND n.flagLevel <> 'NONE'
       RETURN count(n) AS cnt`
    );
    entitiesFlagged = Number((flaggedResult[0] as any)?.cnt ?? 0);

    // ── Step 8: Create FlagEvent nodes for Company/Person flags ──
    await runWrite(
      `MATCH (n) WHERE (n:Company OR n:Person) AND n.flagLevel <> 'NONE'
       MERGE (fe:FlagEvent {id: 'fe_sys_' + n.id})
       SET fe.entityId    = n.id,
           fe.entityType  = labels(n)[0],
           fe.entityName  = n.name,
           fe.flagLevel   = n.flagLevel,
           fe.reason      = CASE
             WHEN 'cycle_detected' IN coalesce(n.flagReasons, []) THEN 'Circular fund flow detected'
             WHEN 'high_volume' IN coalesce(n.flagReasons, []) THEN 'Unusually high transaction volume'
             WHEN 'connected_to_flagged' IN coalesce(n.flagReasons, []) THEN 'Connected to flagged entities'
             ELSE 'System analysis flag'
           END,
           fe.triggeredBy = 'system_analysis',
           fe.resolvedAt  = null,
           fe.createdAt   = $createdAt`,
      { createdAt: now }
    );

    res.json({
      id: `run_${crypto.randomUUID()}`,
      startedAt: now,
      completedAt: new Date().toISOString(),
      cyclesFound,
      entitiesFlagged,
      status: 'completed',
    });
  } catch (err: any) {
    console.error('[flags] runAnalysis error:', err);
    res.status(500).json({ error: err.message });
  }
};
