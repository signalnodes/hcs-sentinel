import type { Command } from 'commander';
import { getFinding } from '../../db/repos/findings.js';

export function registerInspectCommand(program: Command): void {
  program
    .command('inspect <findingId>')
    .description('Show full details of a specific finding')
    .action((findingId: string) => {
      const finding = getFinding(findingId);

      if (!finding) {
        console.error(`Finding not found: ${findingId}`);
        process.exitCode = 1;
        return;
      }

      // Print as formatted JSON — clean and machine-readable
      console.log(JSON.stringify(finding, null, 2));
    });
}
