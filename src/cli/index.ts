#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import { loadConfig } from '../config/index.js';
import { getDb, closeDb } from '../db/index.js';
import { closeHcsClient } from '../hcs/client.js';
import { getLogger } from '../utils/logger.js';
import { registerMonitorCommand } from './commands/monitor.js';
import { registerLatestCommand } from './commands/latest.js';
import { registerInspectCommand } from './commands/inspect.js';
import { registerScanPackageCommand } from './commands/scan-package.js';
import { registerHistoryCommand } from './commands/history.js';
import { registerStatusCommand } from './commands/status.js';

const program = new Command();

program
  .name('hcs-sentinel')
  .description('Monitor critical Hedera ecosystem npm packages and publish alerts to HCS')
  .version('0.1.0');

// Register all commands
registerMonitorCommand(program);
registerLatestCommand(program);
registerInspectCommand(program);
registerScanPackageCommand(program);
registerHistoryCommand(program);
registerStatusCommand(program);

// Bootstrap and run
async function main(): Promise<void> {
  try {
    loadConfig();
    getDb();
    await program.parseAsync(process.argv);
  } catch (err) {
    const logger = getLogger();
    logger.fatal({ err }, 'fatal error');
    process.exitCode = 1;
  } finally {
    closeHcsClient();
    closeDb();
  }
}

main();
