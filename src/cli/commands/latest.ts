import type { Command } from 'commander';
import { getLatestFindings } from '../../db/repos/findings.js';
import { printFinding } from '../../utils/format.js';

export function registerLatestCommand(program: Command): void {
  program
    .command('latest')
    .description('Show the latest finding for each monitored package')
    .option('--json', 'Output as JSON array')
    .option('--full', 'Show all signals (default: top 3)')
    .action((opts: { json?: boolean; full?: boolean }) => {
      const findings = getLatestFindings();

      if (findings.length === 0) {
        console.log(opts.json ? '[]' : 'No findings yet. Run `monitor` or `scan-package` first.');
        return;
      }

      if (opts.json) {
        console.log(JSON.stringify(findings, null, 2));
        return;
      }

      for (const f of findings) {
        printFinding(f, opts.full);
      }

      const high = findings.filter(f => f.severity === 'high').length;
      const warn = findings.filter(f => f.severity === 'warning').length;
      const info = findings.filter(f => f.severity === 'info').length;
      console.log(`\n${findings.length} package(s): ${high} high, ${warn} warning, ${info} info\n`);
    });
}
