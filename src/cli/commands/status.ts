import type { Command } from 'commander';
import { MONITORED_PACKAGES } from '../../config/packages.js';
import { loadConfig } from '../../config/index.js';
import { getAllPackageStates } from '../../db/repos/package-state.js';
import { getLatestFindings } from '../../db/repos/findings.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show operational status: monitored packages, known versions, last checked')
    .action(() => {
      const config = loadConfig();
      const states = getAllPackageStates();
      const latestFindings = getLatestFindings();

      const stateByPkg = new Map(states.map(s => [s.packageName, s]));
      const findingByPkg = new Map(latestFindings.map(f => [f.packageName, f]));

      console.log(`\nhcs-sentinel status`);
      console.log(`  interval:  ${config.POLL_INTERVAL_SECONDS}s`);
      console.log(`  hcs topic: ${config.HCS_TOPIC_ID ?? 'not configured (local-only mode)'}`);
      console.log(`  db:        ${config.DB_PATH}`);
      console.log(`\nmonitored packages (${MONITORED_PACKAGES.length}):\n`);

      for (const pkg of MONITORED_PACKAGES) {
        const state = stateByPkg.get(pkg);
        const finding = findingByPkg.get(pkg);

        if (!state) {
          console.log(`  ${pkg}`);
          console.log(`    version:      not yet checked`);
        } else {
          const severity = finding ? ` [${finding.severity.toUpperCase()}]` : '';
          console.log(`  ${pkg}${severity}`);
          console.log(`    version:      ${state.latestVersion}`);
          console.log(`    last checked: ${state.lastChecked}`);
          if (finding) {
            const published = finding.publishedToHcs ? 'yes' : 'pending';
            console.log(`    signals:      ${finding.signals.length}  hcs: ${published}`);
          }
        }
      }
      console.log('');
    });
}
