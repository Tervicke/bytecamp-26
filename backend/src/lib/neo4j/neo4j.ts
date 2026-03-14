import { config as dotenvConfig } from 'dotenv';
import { join } from 'path';
import neo4j, { type Driver, type Session } from 'neo4j-driver';

// Force-load .env from server root, overriding any Windows system env vars
// (Windows USERNAME shadows our .env Username without override: true)
dotenvConfig({ path: join(import.meta.dir, '../../../.env'), override: true });

// Env vars — exact names from .env
const NEO4J_URI = process.env.connection_url!;
const NEO4J_USER = process.env.Username!;
const NEO4J_PASSWORD = process.env.Password!;

// Exported for use in REST calls that hit the Query API endpoint directly
export const NEO4J_QUERY_API_URL = process.env.connection_query_api_url!;

if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
    throw new Error(
        'Neo4j credentials missing. Ensure connection_url, Username, and Password are set in .env'
    );
}

// AuraDB database name = the subdomain of the connection URL (e.g. '025ab3be')
// It is NOT 'neo4j' — that name only exists on self-hosted instances.
const NEO4J_DB = NEO4J_URI.replace(/^neo4j\+s:\/\//, '').split('.')[0];

// ─── Singleton driver ────────────────────────────────────────────────────────

let _driver: Driver | null = null;

function getDriver(): Driver {
    if (!_driver) {
        _driver = neo4j.driver(
            NEO4J_URI,
            neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
            {
                maxConnectionPoolSize: 50,
                connectionAcquisitionTimeout: 10_000,
            }
        );
    }
    return _driver;
}

export const driver = getDriver();

// ─── Session helpers ─────────────────────────────────────────────────────────

/** Open a session against the default database. Always close after use. */
export function getSession(): Session {
    return driver.session({ database: NEO4J_DB });
}

/**
 * Run a single Cypher query and return all records.
 * Handles session lifecycle automatically.
 */
export async function runQuery<T = Record<string, unknown>>(
    cypher: string,
    params: Record<string, unknown> = {}
): Promise<T[]> {
    const session = getSession();
    try {
        const result = await session.run(cypher, params);
        return result.records.map((record) => record.toObject() as T);
    } finally {
        await session.close();
    }
}

/**
 * Run a write transaction (uses write-mode session).
 * Prefer this for CREATE / SET / DELETE operations.
 */
export async function runWrite<T = Record<string, unknown>>(
    cypher: string,
    params: Record<string, unknown> = {}
): Promise<T[]> {
    const session = driver.session({ database: NEO4J_DB, defaultAccessMode: neo4j.session.WRITE });
    try {
        const result = await session.executeWrite((tx) => tx.run(cypher, params));
        return result.records.map((record) => record.toObject() as T);
    } finally {
        await session.close();
    }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

/** Verify connectivity on startup. Call this once in server.ts / index.ts. */
export async function connectNeo4j(): Promise<void> {
    await driver.verifyConnectivity();
    console.log(`[Neo4j] Connected → ${NEO4J_URI}`);
}

/** Gracefully close the driver on process exit. */
export async function closeNeo4j(): Promise<void> {
    if (_driver) {
        await _driver.close();
        _driver = null;
        console.log('[Neo4j] Driver closed.');
    }
}
