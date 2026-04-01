import type { Command } from 'commander';
import { getLogger } from '../../utils/logger.js';
import { startPoller } from '../../npm/poller.js';
import { fetchPackageMetadata, getVersionManifest } from '../../npm/registry.js';
import { analyzeRelease } from '../../core/analyzer.js';
import { insertFinding } from '../../db/repos/findings.js';
import { publishAlert } from '../../hcs/publisher.js';
import { colorSeverity } from '../../utils/format.js';

export function registerMonitorCommand(program: Command): void {
  program
    .command('monitor')
    .description('Start polling monitored packages for new releases')
    .action(async () => {
      const logger = getLogger();
      const { loadConfig } = await import('../../config/index.js');
      const { MONITORED_PACKAGES } = await import('../../config/packages.js');
      const config = loadConfig();

      console.log(`\nhcs-sentinel monitor`);
      console.log(`  packages:  ${MONITORED_PACKAGES.length} (${MONITORED_PACKAGES.join(', ')})`);
      console.log(`  interval:  ${config.POLL_INTERVAL_SECONDS}s`);
      console.log(`  hcs topic: ${config.HCS_TOPIC_ID ?? 'not configured (local-only mode)'}`);
      console.log(`  press Ctrl+C to stop\n`);
      logger.info('starting monitor loop');

      const { stop, firstRoundComplete } = startPoller(async ({ packageName, newVersion, previousVersion }) => {
        logger.info({ packageName, newVersion, previousVersion }, 'analyzing new release');

        try {
          const meta = await fetchPackageMetadata(packageName);
          const newManifest = getVersionManifest(meta, newVersion);
          if (!newManifest) throw new Error(`manifest not found for ${packageName}@${newVersion}`);

          const prevManifest = previousVersion ? (getVersionManifest(meta, previousVersion) ?? null) : null;

          const finding = await analyzeRelease(newManifest, prevManifest);
          insertFinding(finding);
          logger.info({ findingId: finding.id, severity: finding.severity }, 'finding stored');

          // Human-readable summary to stdout
          const highCount = finding.signals.filter(s => s.severity === 'high').length;
          const warnCount = finding.signals.filter(s => s.severity === 'warning').length;
          console.log(
            `[${colorSeverity(finding.severity)}] ${finding.packageName}@${finding.version}` +
            ` — ${finding.signals.length} signal(s)` +
            (highCount ? ` (${highCount} high)` : '') +
            (warnCount ? ` (${warnCount} warning)` : '') +
            `  id: ${finding.id}`
          );

          await publishAlert(finding);
        } catch (err) {
          logger.error({ packageName, newVersion, err }, 'analysis failed');
        }
      });

      // Let the user know when the first check of all packages is done
      firstRoundComplete.then(() => {
        console.log(`initial poll complete — watching for new releases every ${config.POLL_INTERVAL_SECONDS}s`);
      }).catch(() => { /* already logged */ });

      // Wait until killed
      await new Promise<void>((resolve) => {
        process.once('SIGINT', () => { stop(); resolve(); });
        process.once('SIGTERM', () => { stop(); resolve(); });
      });
    });
}
