import type { Command } from 'commander';
import { getFindingsForPackage } from '../../db/repos/findings.js';
import { printFinding } from '../../utils/format.js';

export function registerHistoryCommand(program: Command): void {
  program
    .command('history <packageName>')
    .description('Show all findings for a specific package, newest first')
    .option('--json', 'Output as JSON array')
    .option('--full', 'Show all signals (default: top 3)')
    .action((packageName: string, opts: { json?: boolean; full?: boolean }) => {
      const findings = getFindingsForPackage(packageName);

      if (findings.length === 0) {
        console.log(opts.json ? '[]' : `No findings for ${packageName}. Run \`scan-package ${packageName}\` first.`);
        return;
      }

      if (opts.json) {
        console.log(JSON.stringify(findings, null, 2));
        return;
      }

      for (const f of findings) {
        printFinding(f, opts.full);
      }
      console.log(`\n${findings.length} finding(s) for ${packageName}\n`);
    });
}
