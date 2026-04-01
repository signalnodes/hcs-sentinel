/**
 * Polls the npm registry for new versions of monitored packages.
 * Calls back when a new version is detected.
 */

import { MONITORED_PACKAGES } from '../config/packages.js';
import { loadConfig } from '../config/index.js';
import { getLogger } from '../utils/logger.js';
import { fetchLatestVersion } from './registry.js';
import { getPackageState, upsertPackageState } from '../db/repos/package-state.js';

export interface NewVersionEvent {
  packageName: string;
  newVersion: string;
  previousVersion: string | null;
}

type OnNewVersion = (event: NewVersionEvent) => Promise<void>;

/**
 * Start the polling loop. Checks all monitored packages immediately,
 * then repeats on the configured interval.
 *
 * @returns An object with a stop() method and a promise that resolves after
 *          the first poll round completes.
 */
export function startPoller(onNewVersion: OnNewVersion): {
  stop: () => void;
  firstRoundComplete: Promise<void>;
} {
  const config = loadConfig();
  const logger = getLogger();
  const intervalMs = config.POLL_INTERVAL_SECONDS * 1000;

  let stopped = false;
  // Track packages currently being analyzed to prevent overlapping cycles
  const inFlight = new Set<string>();

  async function pollOnce(): Promise<void> {
    for (const pkg of MONITORED_PACKAGES) {
      if (stopped) return;
      if (inFlight.has(pkg)) {
        logger.warn({ pkg }, 'analysis still in flight from previous cycle — skipping');
        continue;
      }

      try {
        const latest = await fetchLatestVersion(pkg);
        const state = getPackageState(pkg);
        const previous = state?.latestVersion ?? null;

        if (previous !== latest) {
          logger.info({ pkg, previous, latest }, 'new version detected');
          upsertPackageState(pkg, latest);

          inFlight.add(pkg);
          onNewVersion({ packageName: pkg, newVersion: latest, previousVersion: previous })
            .catch((err) => logger.error({ pkg, err }, 'analysis failed'))
            .finally(() => inFlight.delete(pkg));
        } else {
          logger.debug({ pkg, version: latest }, 'no change');
        }
      } catch (err) {
        logger.error({ pkg, err }, 'poll error — will retry next interval');
      }
    }
  }

  // Run immediately; capture the promise so callers can await first completion
  const firstRoundComplete = pollOnce();
  firstRoundComplete.catch((err) => logger.error({ err }, 'initial poll failed'));

  const timer = setInterval(() => {
    if (!stopped) {
      pollOnce().catch((err) => logger.error({ err }, 'poll interval failed'));
    }
  }, intervalMs);

  logger.info({ intervalMs, packages: MONITORED_PACKAGES.length }, 'poller started');

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
      logger.info('poller stopped');
    },
    firstRoundComplete,
  };
}
