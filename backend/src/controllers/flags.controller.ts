import type { Request, Response } from 'express';
import { runQuery, runWrite } from '../lib/neo4j/neo4j.js';
import { runFullPropagation } from '../services/flagging.service.js';
import crypto from 'crypto';

// ─── Flag Events ─────────────────────────────────────────────────────────────

/**
 * GET /api/flags
 * Returns all FlagEvent nodes in the DB.
 * FlagEvents are created by the analysis pipeline or manual override.
 */
/**
 * GET /api/flags
 * Returns flagged entities with optional type filtering and pagination.
 * Support query params: type (Company|Person|BankAccount|ALL), page, limit.
 * Returns { flags, total, flaggedByType }
 */
export const getFlags = async (req: Request, res: Response): Promise<void> => {
  try {
    const type = (req.query.type as string) || 'ALL';
    const pageParam = req.query.page;
    const limitParam = req.query.limit;

    // Defensive parsing
    let page = parseInt(String(pageParam));
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(String(limitParam));
    if (isNaN(limit) || limit < 1) limit = 10;

    const skip = (page - 1) * limit;

    // 1. Get counts for ALL flagged entities (for breakdown/tabs)
    // ... (rest of the count logic remains same)
    const typeRecords = await runQuery<{ labels: string[]; count: any }>(
      `MATCH (n)
       WHERE (n:Company OR n:Person OR n:BankAccount) 
         AND (COALESCE(n.flagLevel, 'NONE') <> 'NONE' OR EXISTS { MATCH (fe:FlagEvent {entityId: n.id, resolvedAt: null}) })
       RETURN labels(n) as labels, count(n) as count`
    );

    const flaggedByType = { Company: 0, Person: 0, BankAccount: 0 };
    typeRecords.forEach(r => {
      const cnt = Number(r.count.low ?? r.count);
      if (r.labels.includes('Company')) flaggedByType.Company += cnt;
      if (r.labels.includes('Person')) flaggedByType.Person += cnt;
      if (r.labels.includes('BankAccount')) flaggedByType.BankAccount += cnt;
    });

    // 2. Build the main query for flagged entities
    let labelFilter = '';
    if (type !== 'ALL') {
      labelFilter = `AND n:${type}`;
    }

    const mainQuery = `
      MATCH (n)
      WHERE (n:Company OR n:Person OR n:BankAccount) 
        AND (COALESCE(n.flagLevel, 'NONE') <> 'NONE' OR EXISTS { MATCH (fe:FlagEvent {entityId: n.id, resolvedAt: null}) })
        ${labelFilter}
      OPTIONAL MATCH (fe:FlagEvent {entityId: n.id, resolvedAt: null})
      WITH n, fe ORDER BY fe.createdAt DESC
      WITH n, head(collect(fe)) AS lastEvent
      RETURN 
        n.id AS entityId,
        labels(n) AS labels,
        COALESCE(n.name, n.accountNumber, n.id) AS entityName,
        n.flagLevel AS flagLevel,
        n.flagReasons AS reasons,
        lastEvent
      ORDER BY 
        CASE n.flagLevel 
          WHEN 'CRITICAL' THEN 1 
          WHEN 'HIGH' THEN 2 
          WHEN 'MEDIUM' THEN 3 
          WHEN 'LOW' THEN 4 
          ELSE 5 
        END ASC,
        entityId ASC
      SKIP toInteger($skip) LIMIT toInteger($limit)
    `;

    const totalQuery = `
      MATCH (n)
      WHERE (n:Company OR n:Person OR n:BankAccount) 
        AND (COALESCE(n.flagLevel, 'NONE') <> 'NONE' OR EXISTS { MATCH (fe:FlagEvent {entityId: n.id, resolvedAt: null}) })
        ${labelFilter}
      RETURN count(n) AS total
    `;

    const [records, totalRes] = await Promise.all([
      runQuery(mainQuery, { skip, limit }),
      runQuery(totalQuery)
    ]);

    const total = Number((totalRes[0] as any)?.total ?? 0);

    const flags = records.map((r: any) => {
      let entityType = 'Unknown';
      if (r.labels.includes('Company')) entityType = 'Company';
      else if (r.labels.includes('Person')) entityType = 'Person';
      else if (r.labels.includes('BankAccount')) entityType = 'BankAccount';

      const event = r.lastEvent?.properties ?? r.lastEvent;

      return {
        id: event?.id || `sys_fe_${r.entityId}`,
        entityId: r.entityId,
        entityType,
        entityName: r.entityName,
        flagLevel: r.flagLevel,
        reason: event?.reason || (r.reasons || []).join(', ') || 'System detected flag',
        triggeredBy: event?.triggeredBy || 'system_analysis',
        resolvedAt: null,
        createdAt: event?.createdAt || new Date().toISOString(),
      };
    });

    res.json({
      flags,
      total,
      flaggedByType,
      page,
      limit
    });
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
       RETURN COALESCE(n.name, n.accountNumber) AS entityName, labels(n)[0] AS entityType`,
      { entityId, flagLevel }
    );

    if (!updateResult.length) {
      res.status(404).json({ error: `Entity with id '${entityId}' not found` });
      return;
    }

    const { entityName, entityType } = updateResult[0] as any;
    const now = new Date().toISOString();
    const feId = `fe_${crypto.randomUUID()}`;

    // Create a FlagEvent node to record the override (ensure accountNumber fallback for BankAccount)
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
        entityName: entityName || entityId, // Fallback if still empty
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
    const txnStatsQuery = `MATCH ()-[t:TRANSFERS_TO]->()
         RETURN
           count(t) AS total,
           count(CASE WHEN COALESCE(t.flagLevel, 'NONE') <> 'NONE' THEN 1 END) AS flagged,
           count(CASE WHEN t.flagLevel = 'CRITICAL' THEN 1 END) AS critical`;

    const entityStatsQuery = `MATCH (n)
         WHERE (n:Company OR n:Person OR n:BankAccount) 
           AND (COALESCE(n.flagLevel, 'NONE') <> 'NONE' OR EXISTS { MATCH (fe:FlagEvent {entityId: n.id, resolvedAt: null}) })
         RETURN count(n) AS entitiesFlagged`;

    const activeCyclesQuery = `MATCH (n)
         WHERE (n:Company OR n:Person OR n:BankAccount)
           AND 'cycle_detected' IN n.flagReasons
         RETURN count(n) AS activeCycles`;

    const topFlaggedQuery = `MATCH (n)
         WHERE (n:Company OR n:Person OR n:BankAccount)
           AND COALESCE(n.flagLevel, 'NONE') <> 'NONE'
         RETURN 
           n.id AS id,
           COALESCE(n.name, n.accountNumber, n.id) AS name,
           labels(n)[0] AS type,
           n.flagLevel AS flagLevel
         ORDER BY 
           CASE n.flagLevel 
             WHEN 'CRITICAL' THEN 1 
             WHEN 'HIGH' THEN 2 
             WHEN 'MEDIUM' THEN 3 
             WHEN 'LOW' THEN 4 
             ELSE 5 
           END ASC
         LIMIT 5`;

    const [txnStats, entityStats, cycleStats, runStats, topFlagged] = await Promise.all([
      runQuery(txnStatsQuery),
      runQuery(entityStatsQuery),
      runQuery(activeCyclesQuery),
      runQuery(`MATCH (fe:FlagEvent) WHERE fe.triggeredBy <> 'manual_override' RETURN count(fe) AS analysisRuns, max(fe.createdAt) AS lastAnalysis`),
      runQuery(topFlaggedQuery)
    ]);

    console.log("DASHBOARD STATS RAW:", { txnStats, entityStats, cycleStats, runStats, topFlagged });

    const ts = txnStats[0] as any ?? {};
    const es = entityStats[0] as any ?? {};
    const cs = cycleStats[0] as any ?? {};
    const rs = runStats[0] as any ?? {};

    // Get a per-label count for entities
    const typeRecords = await runQuery<{ labels: string[]; count: any }>(
      `MATCH (n)
       WHERE (n:Company OR n:Person OR n:BankAccount) 
         AND (COALESCE(n.flagLevel, 'NONE') <> 'NONE' OR EXISTS { MATCH (fe:FlagEvent {entityId: n.id, resolvedAt: null}) })
       RETURN labels(n) as labels, count(n) as count`
    );

    const flaggedByType = {
      Company: 0,
      Person: 0,
      BankAccount: 0,
    };

    typeRecords.forEach(r => {
      const count = Number(r.count.low ?? r.count);
      if (r.labels.includes('Company')) flaggedByType.Company += count;
      if (r.labels.includes('Person')) flaggedByType.Person += count;
      if (r.labels.includes('BankAccount')) flaggedByType.BankAccount += count;
    });

    // Risk distribution
    const riskRecords = await runQuery<{ flagLevel: string; count: any }>(
      `MATCH (n)
       WHERE (n:Company OR n:Person OR n:BankAccount)
         AND COALESCE(n.flagLevel, 'NONE') <> 'NONE'
       RETURN n.flagLevel AS flagLevel, count(n) AS count`
    );
    const riskDistribution = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    riskRecords.forEach(r => {
      const level = (r as any).flagLevel;
      const count = Number((r as any).count.low ?? (r as any).count);
      if (level in riskDistribution) {
        (riskDistribution as any)[level] = count;
      }
    });

    res.json({
      totalTransactions: Number(ts.total ?? 0),
      flaggedTransactions: Number(ts.flagged ?? 0),
      criticalAlerts: Number(ts.critical ?? 0),
      activeCycles: Number(cs.activeCycles ?? 0),
      entitiesFlagged: Number(es.entitiesFlagged ?? 0),
      flaggedByType,
      riskDistribution,
      topFlaggedEntities: topFlagged.map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        flagLevel: r.flagLevel
      })),
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
 * Runs the full flag propagation pipeline:
 *  Phase 0: Reset TRANSFERS_TO edge flags only (entities keep their flags)
 *  Phase 2: Flag BankAccounts from their flagged transactions
 *  Phase 3: 3-hop transaction chain propagation from flagged accounts
 *  Phase 4: Flag Companies from flagged BankAccounts (HOLDS_ACCOUNT)
 *  Phase 5: Flag Persons from flagged Companies (OWNS — no attenuation)
 *  Phase 6: Propagate flags between subsidiaries and parents (±1 level)
 *  Phase 6b: Flag persons owning newly-flagged subsidiary companies
 *  Phase 7: Upsert FlagEvent audit nodes (daily overwrite)
 *
 * Note: The rule engine (circularTransaction, sharedOwnership, rapidTransfers,
 * cashFlowRatio) runs per-transaction at upload time and writes flagLevel onto
 * the TRANSFERS_TO edges. This pipeline reads those edges and propagates flags
 * to entities.
 */
export const runAnalysis = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date().toISOString();

    const { cyclesFound, entitiesFlagged } = await runFullPropagation(now);

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

/**
 * GET /api/flags/search?q=...
 * Searches for any entity (Company, Person, BankAccount) by name, id, or account number.
 * Used for manual overrides of non-flagged entities.
 */
export const searchEntities = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, type } = req.query;
    if (!q || typeof q !== 'string' || q.length < 2) {
      res.json([]);
      return;
    }

    let typeFilter = '';
    if (type && type !== 'ALL') {
      typeFilter = `AND n:${type}`;
    }

    const query = `
      MATCH (n)
      WHERE (n:Company OR n:Person OR n:BankAccount)
        ${typeFilter}
        AND (
          n.id CONTAINS $q OR 
          toLower(n.name) CONTAINS toLower($q) OR 
          n.accountNumber CONTAINS $q
        )
      RETURN 
        n.id AS id,
        labels(n) AS labels,
        COALESCE(n.name, n.accountNumber, n.id) AS name,
        n.flagLevel AS flagLevel
      LIMIT 10
    `;

    const records = await runQuery<{ id: string; labels: string[]; name: string; flagLevel: string }>(
      query,
      { q }
    );

    const formatted = records.map(r => {
      let type = 'Unknown';
      if (r.labels.includes('Company')) type = 'Company';
      else if (r.labels.includes('Person')) type = 'Person';
      else if (r.labels.includes('BankAccount')) type = 'BankAccount';

      return {
        entityId: r.id,
        entityType: type,
        entityName: r.name,
        flagLevel: r.flagLevel,
      };
    });

    res.json(formatted);
  } catch (err: any) {
    console.error('[flags] searchEntities error:', err);
    res.status(500).json({ error: err.message });
  }
};
