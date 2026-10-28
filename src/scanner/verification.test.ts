import { describe, it, expect } from 'vitest';
import { computeLineDiff } from './diff';
import { verifySnippetRemediation, verifyRepoRemediation, REVOCATION_NOTICE } from './verification';
import { scanContent } from './engine';
import { scanRepository, redactRepository } from './repoEngine';
import { DEMO_REPOSITORY_FILES, FICTIONAL_DUMMY_CREDENTIALS } from './fixtures';

describe('CommitShield Remediation Diff & Verification Engine', () => {
  describe('Code Diff Computation', () => {
    it('computes exact line diff for modified lines', () => {
      const original = `const a = 1;\nconst apiKey = "${FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey}";\nconst c = 3;`;
      const modified = `const a = 1;\nconst apiKey = "<REDACTED_AWS_ACCESS_KEY_ID>";\nconst c = 3;`;

      const { lines, summary } = computeLineDiff(original, modified);

      expect(summary.linesRemoved).toBe(1);
      expect(summary.linesAdded).toBe(1);
      expect(summary.linesUnchanged).toBe(2);

      const removed = lines.find((l) => l.type === 'removed');
      expect(removed?.content).toContain(FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey);
      expect(removed?.originalLineNumber).toBe(2);

      const added = lines.find((l) => l.type === 'added');
      expect(added?.content).toContain('<REDACTED_AWS_ACCESS_KEY_ID>');
      expect(added?.modifiedLineNumber).toBe(2);
    });

    it('handles identical code without false diff lines', () => {
      const code = `const a = 1;\nconst b = 2;`;
      const { lines, summary } = computeLineDiff(code, code);
      expect(summary.linesRemoved).toBe(0);
      expect(summary.linesAdded).toBe(0);
      expect(summary.linesUnchanged).toBe(2);
      expect(lines.every((l) => l.type === 'unchanged')).toBe(true);
    });
  });

  describe('Remediation Verification & Differential', () => {
    it('accurately verifies when all findings in a repository are remediated', () => {
      const baseline = scanRepository(DEMO_REPOSITORY_FILES, 'demo-repo');
      expect(baseline.allFindings.length).toBeGreaterThan(0);

      const sanitizedFiles = redactRepository(DEMO_REPOSITORY_FILES, baseline, 'placeholder');
      const rescan = scanRepository(sanitizedFiles, 'demo-repo');

      const verification = verifyRepoRemediation(baseline, rescan);

      expect(verification.isFullyRemediated).toBe(true);
      expect(verification.totalBaseline).toBe(baseline.allFindings.length);
      expect(verification.totalResolved).toBe(baseline.allFindings.length);
      expect(verification.totalRemaining).toBe(0);
      expect(verification.totalNew).toBe(0);
      expect(verification.resolutionPercentage).toBe(100);
      expect(verification.revocationDisclaimer).toBe(REVOCATION_NOTICE);
    });

    it('identifies remaining findings when remediation is only partial', () => {
      const code = `const aws = "${FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey}";\nconst pat = "${FICTIONAL_DUMMY_CREDENTIALS.githubPat}";`;
      const baseline = scanContent(code, { fileName: 'partial.ts' });
      expect(baseline.findings).toHaveLength(2);

      // Partially remediated (only AWS replaced)
      const partiallyRedacted = `const aws = "<REDACTED_AWS_ACCESS_KEY_ID>";\nconst pat = "${FICTIONAL_DUMMY_CREDENTIALS.githubPat}";`;
      const rescan = scanContent(partiallyRedacted, { fileName: 'partial.ts' });

      const verification = verifySnippetRemediation(baseline, rescan);

      expect(verification.isFullyRemediated).toBe(false);
      expect(verification.totalResolved).toBe(1);
      expect(verification.totalRemaining).toBe(1);
      expect(verification.resolutionPercentage).toBe(50);
      expect(verification.remainingFindings[0].ruleId).toBe('github-pat');
    });
  });
});

