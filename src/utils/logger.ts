import pino from 'pino';
import { loadConfig } from '../config/index.js';

let _logger: pino.Logger | null = null;

export function getLogger(): pino.Logger {
  if (_logger) return _logger;

  const config = loadConfig();

  _logger = pino({
    name: 'hcs-sentinel',
    level: config.LOG_LEVEL,
    transport: {
      target: 'pino/file',
      options: { destination: 2 }, // stderr — keep stdout clean for command output
    },
  });

  return _logger;
}
