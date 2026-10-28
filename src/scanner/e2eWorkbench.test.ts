import { describe, it, expect } from 'vitest';
import {
  scanRepository,
  redactRepository,
  prioritizeFindings,
  computeLineDiff,
  verifyRepoRemediation,
  generateRepoSarifReport,
  generateRepoMarkdownReport,
  generateRepoJsonReport,
  DEMO_REPOSITORY_FILES,
  FICTIONAL_DUMMY_CREDENTIALS,
} from './index';

describe('CommitShield Security Workbench E2E Demo Workflow', () => {
  it('executes full end-to-end investigation and remediation lifecycle', () => {
    // 1. Load demo repository & scan
    const initialRepo = scanRepository(DEMO_REPOSITORY_FILES, 'demo-repository');
    expect(initialRepo.totalFilesScanned).toBe(10);
    expect(initialRepo.allFindings.length).toBeGreaterThanOrEqual(5);

    // 2. Prioritize findings with explainable risk metrics
    const prioritized = prioritizeFindings(initialRepo.allFindings);
    expect(prioritized[0].priorityRank).toBe(1); // Urgent
    expect(prioritized[0].explanation).toBeDefined();
    expect(prioritized[0].evidenceDisclaimer).toContain('Pattern matching confirms exact syntactic structure');

    // 3. Review remediation diff
    const activeFile = 'src/config.ts';
    const sanitizedRepo = redactRepository(DEMO_REPOSITORY_FILES, initialRepo, 'env');
    const { summary: diffSummary } = computeLineDiff(
      DEMO_REPOSITORY_FILES[activeFile],
      sanitizedRepo[activeFile]
    );
    expect(diffSummary.linesRemoved).toBeGreaterThanOrEqual(1);
    expect(diffSummary.linesAdded).toBeGreaterThanOrEqual(1);

    // 4. Apply changes & rescan
    const rescanResult = scanRepository(sanitizedRepo, 'demo-repository');

    // 5. Verify differential (resolved vs remaining)
    const verification = verifyRepoRemediation(initialRepo, rescanResult);
    expect(verification.isFullyRemediated).toBe(true);
    expect(verification.totalResolved).toBe(initialRepo.allFindings.length);
    expect(verification.totalRemaining).toBe(0);
    expect(verification.statusMessage).toContain('Verified Clean');
    expect(verification.revocationDisclaimer).toContain('does NOT revoke or invalidate');

    // 6. Generate SARIF 2.1.0, Markdown, and JSON exports
    const sarif = generateRepoSarifReport(initialRepo);
    expect(sarif).toContain('"version": "2.1.0"');
    expect(sarif).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey);

    const md = generateRepoMarkdownReport(initialRepo);
    expect(md).toContain('# CommitShield Repository Security Report');
    expect(md).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey);

    const json = generateRepoJsonReport(initialRepo);
    expect(json).toContain('"tool": "CommitShield"');
    expect(json).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey);
  });
});
