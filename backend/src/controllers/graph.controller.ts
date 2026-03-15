import type { Request, Response } from 'express';
import { runQuery } from '../lib/neo4j/neo4j.js';

/**
 * GET /api/graph
 * Returns nodes (Company, Person, BankAccount) and links (all relationship types).
 * Shape: { nodes: GraphNode[], links: GraphLink[] }
 * where GraphNode = { id, label, name, flagLevel, type, layer? }
 * and   GraphLink = { source, target, type, isCycle, properties }
 */
export const getFullGraph = async (_req: Request, res: Response): Promise<void> => {
  try {
    // ── Nodes ──────────────────────────────────────────────────────────────
    const [companyRecords, personRecords, accountRecords] = await Promise.all([
      runQuery<{ c: any }>(
        `MATCH (c:Company) RETURN c`
      ),
      runQuery<{ p: any }>(
        `MATCH (p:Person) RETURN p`
      ),
      runQuery<{ b: any }>(
        `MATCH (b:BankAccount) RETURN b`
      ),
    ]);

    const companyNodes = companyRecords.map(r => {
      const p = r.c?.properties ?? r.c ?? r;
      return {
        id:       p.id,
        label:    'Company',
        name:     p.name,
        flagLevel: p.flagLevel ?? 'NONE',
        type:     'company',
        layer:    p.layer ?? null,
      };
    });

    const personNodes = personRecords.map(r => {
      const p = r.p?.properties ?? r.p ?? r;
      return {
        id:       p.id,
        label:    'Person',
        name:     p.name,
        flagLevel: p.flagLevel ?? 'NONE',
        type:     'person',
      };
    });

    const accountNodes = accountRecords.map(r => {
      const p = r.b?.properties ?? r.b ?? r;
      return {
        id:        p.id,
        label:     'BankAccount',
        name:      p.accountNumber,
        flagLevel:  p.flagLevel ?? 'NONE',
        type:      'account',
        companyId: p.companyId,
      };
    });

    const nodes = [...companyNodes, ...personNodes, ...accountNodes];

    // ── Links ──────────────────────────────────────────────────────────────
    const [ownsLinks, subLinks, holdsLinks, txnLinks] = await Promise.all([
      runQuery<{ srcId: string; tgtId: string; pct: any }>(
        `MATCH (p:Person)-[o:OWNS]->(c:Company)
         RETURN p.id AS srcId, c.id AS tgtId, o.ownershipPct AS pct`
      ),
      runQuery<{ srcId: string; tgtId: string; pct: any }>(
        `MATCH (sub:Company)-[s:SUBSIDIARY_OF]->(parent:Company)
         RETURN sub.id AS srcId, parent.id AS tgtId, s.sharesPct AS pct`
      ),
      runQuery<{ srcId: string; tgtId: string }>(
        `MATCH (c:Company)-[:HOLDS_ACCOUNT]->(b:BankAccount)
         RETURN c.id AS srcId, b.id AS tgtId`
      ),
      runQuery<{ srcId: string; tgtId: string; amount: any; isSusp: any; flagReasons: any }>(
        `MATCH (from:BankAccount)-[t:TRANSFERS_TO]->(to:BankAccount)
         RETURN from.id AS srcId, to.id AS tgtId,
                t.amount AS amount, t.isSuspicious AS isSusp,
                t.flagReasons AS flagReasons`
      ),
    ]);

    const links = [
      ...ownsLinks.map(r => ({
        source: (r as any).srcId,
        target: (r as any).tgtId,
        type:   'OWNS',
        isCycle: false,
        properties: { ownershipPct: (r as any).pct },
      })),
      ...subLinks.map(r => ({
        source: (r as any).srcId,
        target: (r as any).tgtId,
        type:   'SUBSIDIARY_OF',
        isCycle: false,
        properties: { sharesPct: (r as any).pct },
      })),
      ...holdsLinks.map(r => ({
        source: (r as any).srcId,
        target: (r as any).tgtId,
        type:   'HOLDS_ACCOUNT',
        isCycle: false,
        properties: {},
      })),
      ...txnLinks.map(r => {
        const reasons: string[] = Array.isArray((r as any).flagReasons) ? (r as any).flagReasons : [];
        return {
          source: (r as any).srcId,
          target: (r as any).tgtId,
          type:   'TRANSFERS_TO',
          isCycle: reasons.includes('cycle_detected'),
          properties: {
            amount: (r as any).amount,
            isSuspicious: Boolean((r as any).isSusp),
          },
        };
      }),
    ];

    res.json({ nodes, links });
  } catch (err: any) {
    console.error('[graph] getFullGraph error:', err);
    res.status(500).json({ error: err.message });
  }
};
