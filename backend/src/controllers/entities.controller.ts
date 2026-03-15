import type { Request, Response } from 'express';
import { runQuery, runWrite } from '../lib/neo4j/neo4j.js';
import crypto from 'crypto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapNode(record: Record<string, any>, alias: string) {
  const node = record[alias];
  return node?.properties ?? node ?? record;
}

// ─── Companies ───────────────────────────────────────────────────────────────

export const getCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const pageParam = req.query.page;
    const limitParam = req.query.limit;
    
    // Defensive parsing
    let page = parseInt(String(pageParam));
    if (isNaN(page) || page < 1) page = 1;
    
    let limit = parseInt(String(limitParam));
    if (isNaN(limit) || limit < 1) limit = 10;
    
    const skip = (page - 1) * limit;

    console.log(`[entities] getCompanies - input: page=${pageParam}, limit=${limitParam} | parsed: page=${page}, limit=${limit}, skip=${skip}`);

    const totalRecords = await runQuery<{ total: any }>(
      `MATCH (c:Company) RETURN count(c) AS total`
    );
    const total = Number(totalRecords[0]?.total.low ?? totalRecords[0]?.total ?? 0);

    const records = await runQuery<{ c: any }>(
      `MATCH (c:Company) 
       RETURN c 
       ORDER BY c.name 
       SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { skip, limit }
    );
    const companies = records.map(r => mapNode(r, 'c'));

    console.log(`[entities] getCompanies result - total: ${total}, count: ${companies.length}`);
    const response = {
      data: companies,
      total,
      page,
      limit
    };
    res.json(response);
  } catch (err: any) {
    console.error('[entities] getCompanies error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const createCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = data.id || `c_${crypto.randomUUID()}`;
    const records = await runWrite<{ c: any }>(
      `MERGE (c:Company {id: $id})
       SET c.name               = $name,
           c.jurisdiction       = $jurisdiction,
           c.registrationNumber = $registrationNumber,
           c.incorporatedDate   = $incorporatedDate,
           c.companyType        = $companyType,
           c.industry           = $industry,
           c.address            = $address,
           c.isShell            = $isShell,
           c.flagLevel          = $flagLevel,
           c.flagReasons        = $flagReasons
       RETURN c`,
      {
        id,
        name: data.name || '',
        jurisdiction: data.jurisdiction || '',
        registrationNumber: data.registrationNumber || '',
        incorporatedDate: data.incorporatedDate || '',
        companyType: data.companyType || '',
        industry: data.industry || '',
        address: data.address || '',
        isShell: Boolean(data.isShell),
        flagLevel: data.flagLevel || 'NONE',
        flagReasons: Array.isArray(data.flagReasons) ? data.flagReasons : [],
      }
    );
    res.status(201).json(mapNode(records[0]!, 'c'));
  } catch (err: any) {
    console.error('[entities] createCompany error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── Persons ─────────────────────────────────────────────────────────────────

export const getPersons = async (req: Request, res: Response): Promise<void> => {
  try {
    const pageParam = req.query.page;
    const limitParam = req.query.limit;
    let page = parseInt(String(pageParam));
    if (isNaN(page) || page < 1) page = 1;
    let limit = parseInt(String(limitParam));
    if (isNaN(limit) || limit < 1) limit = 10;
    const skip = (page - 1) * limit;

    console.log(`[entities] getPersons - input: page=${pageParam}, limit=${limitParam} | parsed: page=${page}, limit=${limit}, skip=${skip}`);

    const totalRecords = await runQuery<{ total: any }>(
      `MATCH (p:Person) RETURN count(p) AS total`
    );
    const total = Number(totalRecords[0]?.total.low ?? totalRecords[0]?.total ?? 0);

    const records = await runQuery<{ p: any }>(
      `MATCH (p:Person) 
       RETURN p 
       ORDER BY p.name 
       SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { skip, limit }
    );

    const persons = records.map(r => mapNode(r, 'p'));
    console.log(`[entities] getPersons - page: ${page}, limit: ${limit}, skip: ${skip}, total: ${total}, count: ${persons.length}`);
    const response = {
      data: persons,
      total,
      page,
      limit
    };
    console.log('[entities] getPersons response keys:', Object.keys(response));
    res.json(response);
  } catch (err: any) {
    console.error('[entities] getPersons error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const createPerson = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = data.id || `p_${crypto.randomUUID()}`;
    const records = await runWrite<{ p: any }>(
      `MERGE (p:Person {id: $id})
       SET p.name           = $name,
           p.nationality    = $nationality,
           p.dob            = $dob,
           p.passportNumber = $passportNumber,
           p.email          = $email,
           p.phone          = $phone,
           p.role           = $role,
           p.flagLevel      = $flagLevel,
           p.flagReasons    = $flagReasons
       RETURN p`,
      {
        id,
        name: data.name || '',
        nationality: data.nationality || '',
        dob: data.dob || '',
        passportNumber: data.passportNumber || '',
        email: data.email || '',
        phone: data.phone || '',
        role: data.role || '',
        flagLevel: data.flagLevel || 'NONE',
        flagReasons: Array.isArray(data.flagReasons) ? data.flagReasons : [],
      }
    );
    res.status(201).json(mapNode(records[0]!, 'p'));
  } catch (err: any) {
    console.error('[entities] createPerson error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── Bank Accounts ────────────────────────────────────────────────────────────

export const getBankAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const pageParam = req.query.page;
    const limitParam = req.query.limit;
    let page = parseInt(String(pageParam));
    if (isNaN(page) || page < 1) page = 1;
    let limit = parseInt(String(limitParam));
    if (isNaN(limit) || limit < 1) limit = 10;
    const skip = (page - 1) * limit;

    console.log(`[entities] getBankAccounts - input: page=${pageParam}, limit=${limitParam} | parsed: page=${page}, limit=${limit}, skip=${skip}`);

    const totalRecords = await runQuery<{ total: any }>(
      `MATCH (b:BankAccount) RETURN count(b) AS total`
    );
    const total = Number(totalRecords[0]?.total.low ?? totalRecords[0]?.total ?? 0);

    // Also compute 30-day transaction count and cash-flow ratio per account
    const records = await runQuery<{ b: any; txnCount: any; cashIn: any; cashOut: any }>(
      `MATCH (b:BankAccount)
       OPTIONAL MATCH (b)<-[tin:TRANSFERS_TO]-(src:BankAccount)
         WHERE tin.txnDate >= toString(date() - duration('P30D'))
           AND tin.txnType = 'cash'
       OPTIONAL MATCH (b)-[tout:TRANSFERS_TO]->(dst:BankAccount)
         WHERE tout.txnDate >= toString(date() - duration('P30D'))
       WITH b,
            count(DISTINCT tin) AS cashIn,
            count(DISTINCT tout) AS txnCount
       RETURN b, txnCount, cashIn,
              CASE WHEN txnCount + cashIn = 0 THEN 0.0
                   ELSE toFloat(cashIn) / toFloat(txnCount + cashIn)
              END AS cashFlowRatio
       ORDER BY b.accountNumber
       SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { skip, limit }
    );

    const accounts = records.map(r => {
      const props = mapNode(r, 'b');
      return {
        ...props,
        txnCount30d: Number((r as any).txnCount ?? 0),
        cashFlowRatio: Number((r as any).cashFlowRatio ?? 0),
      };
    });

    console.log(`[entities] getBankAccounts - page: ${page}, limit: ${limit}, skip: ${skip}, total: ${total}, count: ${accounts.length}`);
    const response = {
      data: accounts,
      total,
      page,
      limit
    };
    console.log('[entities] getBankAccounts response keys:', Object.keys(response));
    res.json(response);
  } catch (err: any) {
    console.error('[entities] getBankAccounts error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const createBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const id = data.id || `ba_${crypto.randomUUID()}`;
    const records = await runWrite<{ b: any }>(
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
           b.flagLevel     = $flagLevel
       WITH b
       MATCH (c:Company {id: $companyId})
       MERGE (c)-[:HOLDS_ACCOUNT]->(b)
       RETURN b`,
      {
        id,
        accountNumber: data.accountNumber || '',
        bankName: data.bankName || '',
        bankCountry: data.bankCountry || '',
        currency: data.currency || 'USD',
        balance: parseFloat(data.balance) || 0,
        companyId: data.companyId || '',
        openedDate: data.openedDate || '',
        accountType: data.accountType || '',
        swiftCode: data.swiftCode || '',
        flagLevel: data.flagLevel || 'NONE',
      }
    );
    res.status(201).json(mapNode(records[0]!, 'b'));
  } catch (err: any) {
    console.error('[entities] createBankAccount error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── Generic entity lookup ────────────────────────────────────────────────────

export const getEntity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // Try all three labels
    const records = await runQuery<{ n: any; label: string }>(
      `MATCH (n)
       WHERE (n:Company OR n:Person OR n:BankAccount) AND n.id = $id
       RETURN n, labels(n)[0] AS label
       LIMIT 1`,
      { id }
    );
    if (!records.length) {
      res.status(404).json({ error: 'Entity not found' });
      return;
    }
    const r = records[0]!;
    res.json({ ...mapNode(r, 'n'), _label: (r as any).label });
  } catch (err: any) {
    console.error('[entities] getEntity error:', err);
    res.status(500).json({ error: err.message });
  }
};
