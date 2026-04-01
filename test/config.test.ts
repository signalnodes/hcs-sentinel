import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, resetConfig } from '../src/config/index.js';

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetConfig();
  });

  it('loads defaults when no env vars are set', () => {
    delete process.env.HEDERA_ACCOUNT_ID;
    delete process.env.HEDERA_PRIVATE_KEY;
    delete process.env.HEDERA_NETWORK;
    delete process.env.HCS_TOPIC_ID;
    delete process.env.POLL_INTERVAL_SECONDS;
    delete process.env.DB_PATH;
    delete process.env.LOG_LEVEL;

    const config = loadConfig();
    expect(config.HEDERA_NETWORK).toBe('testnet');
    expect(config.POLL_INTERVAL_SECONDS).toBe(60);
    expect(config.DB_PATH).toBe('data/sentinel.db');
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.HEDERA_ACCOUNT_ID).toBeUndefined();
  });

  it('reads env overrides', () => {
    process.env.HEDERA_NETWORK = 'mainnet';
    process.env.POLL_INTERVAL_SECONDS = '30';
    process.env.DB_PATH = '/tmp/test.db';
    process.env.LOG_LEVEL = 'debug';

    const config = loadConfig();
    expect(config.HEDERA_NETWORK).toBe('mainnet');
    expect(config.POLL_INTERVAL_SECONDS).toBe(30);
    expect(config.DB_PATH).toBe('/tmp/test.db');
    expect(config.LOG_LEVEL).toBe('debug');
  });

  it('rejects invalid network', () => {
    process.env.HEDERA_NETWORK = 'devnet';
    expect(() => loadConfig()).toThrow();
  });

  it('rejects non-positive interval', () => {
    process.env.POLL_INTERVAL_SECONDS = '0';
    expect(() => loadConfig()).toThrow();
  });

  it('caches config on second call', () => {
    const a = loadConfig();
    const b = loadConfig();
    expect(a).toBe(b);
  });
});
