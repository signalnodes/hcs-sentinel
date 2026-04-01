import { z } from 'zod';

const configSchema = z.object({
  // Hedera network credentials (required for HCS publishing)
  HEDERA_ACCOUNT_ID: z.string().optional(),
  HEDERA_PRIVATE_KEY: z.string().optional(),
  HEDERA_NETWORK: z.enum(['mainnet', 'testnet', 'previewnet']).default('testnet'),

  // HCS topic to publish alerts to
  HCS_TOPIC_ID: z.string().optional(),

  // Polling interval in seconds
  POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),

  // SQLite database path
  DB_PATH: z.string().default('data/sentinel.db'),

  // Log level
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Config = z.infer<typeof configSchema>;

let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config) return _config;

  _config = configSchema.parse({
    HEDERA_ACCOUNT_ID: process.env.HEDERA_ACCOUNT_ID,
    HEDERA_PRIVATE_KEY: process.env.HEDERA_PRIVATE_KEY,
    HEDERA_NETWORK: process.env.HEDERA_NETWORK,
    HCS_TOPIC_ID: process.env.HCS_TOPIC_ID,
    POLL_INTERVAL_SECONDS: process.env.POLL_INTERVAL_SECONDS,
    DB_PATH: process.env.DB_PATH,
    LOG_LEVEL: process.env.LOG_LEVEL,
  });

  return _config;
}

/** Reset cached config — useful for testing */
export function resetConfig(): void {
  _config = null;
}
