import type { Command } from 'commander';
import { getLogger } from '../../utils/logger.js';
import { fetchPackageMetadata, getVersionManifest } from '../../npm/registry.js';
import { analyzeRelease } from '../../core/analyzer.js';
import { insertFinding, findingExistsForVersion } from '../../db/repos/findings.js';
import { getPackageState, upsertPackageState } from '../../db/repos/package-state.js';
import { publishAlert } from '../../hcs/publisher.js';

export function registerScanPackageCommand(program: Command): void {
  program
    .command('scan-package <packageName>')
    .description('Run a one-shot analysis of an npm package version')
    .option('--no-publish', 'Skip HCS publishing')
    .option('-v, --pkg-version <version>', 'Scan a specific version (default: latest)')
    .action(async (packageName: string, opts: { publish: boolean; pkgVersion?: string }) => {
      const logger = getLogger();

      let meta;
      try {
        logger.info({ packageName }, 'fetching package metadata');
        meta = await fetchPackageMetadata(packageName);
      } catch (err) {
        console.error(`Error: could not fetch package "${packageName}" from npm registry.`);
        console.error(`  Is the package name correct?`);
        logger.debug({ err }, 'registry fetch failed');
        process.exitCode = 1;
        return;
      }

      const targetVersion = opts.pkgVersion ?? meta['dist-tags']?.['latest'];
      if (!targetVersion) {
        console.error(`Error: no version resolved for ${packageName}`);
        process.exitCode = 1;
        return;
      }

      const newManifest = getVersionManifest(meta, targetVersion);
      if (!newManifest) {
        console.error(`Error: version ${targetVersion} not found for ${packageName}`);
        process.exitCode = 1;
        return;
      }

      // Skip re-analysis if this exact version was already scanned
      if (findingExistsForVersion(packageName, targetVersion)) {
        console.log(`Already scanned: ${packageName}@${targetVersion} — use \`inspect\` to view the existing finding.`);
        return;
      }

      const state = getPackageState(packageName);
      const previousVersion = state?.latestVersion ?? null;
      const prevManifest = previousVersion ? (getVersionManifest(meta, previousVersion) ?? null) : null;

      logger.info({ packageName, targetVersion, previousVersion }, 'analyzing');
      const finding = await analyzeRelease(newManifest, prevManifest);
      insertFinding(finding);
      upsertPackageState(packageName, targetVersion);

      console.log(JSON.stringify(finding, null, 2));

      if (opts.publish) {
        await publishAlert(finding);
      }
    });
}
