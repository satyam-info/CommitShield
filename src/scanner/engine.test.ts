import { describe, it, expect } from 'vitest';
import { scanContent, redactSecrets } from './engine';
import { generateMarkdownReport, generateJsonReport } from './report';
import {
  FICTIONAL_DUMMY_CREDENTIALS,
  SAMPLE_VULNERABLE_CODE,
  SAFE_CODE_SAMPLE,
} from './fixtures';
import { maskSecretValue } from './masker';

describe('CommitShield Core Secret Scanner', () => {
  describe('Positive Pattern Matches', () => {
    it('detects AWS Access Key ID', () => {
      const code = `const awsKey = "${FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey}";`;
      const result = scanContent(code);

      expect(result.findings).toHaveLength(1);
      const finding = result.findings[0];
      expect(finding.ruleId).toBe('aws-access-key-id');
      expect(finding.severity).toBe('critical');
      expect(finding.line).toBe(1);
      expect(finding.column).toBe(17);
    });

    it('detects GitHub Personal Access Token', () => {
      const code = `export const GITHUB = "${FICTIONAL_DUMMY_CREDENTIALS.githubPat}";`;
      const result = scanContent(code);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].ruleId).toBe('github-pat');
      expect(result.findings[0].severity).toBe('critical');
    });

    it('detects Google API Key', () => {
      const code = `const key = "${FICTIONAL_DUMMY_CREDENTIALS.googleApiKey}";`;
      const result = scanContent(code);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].ruleId).toBe('google-api-key');
      expect(result.findings[0].severity).toBe('high');
    });

    it('detects Slack Token', () => {
      const code = `const token = "${FICTIONAL_DUMMY_CREDENTIALS.slackToken}";`;
      const result = scanContent(code);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].ruleId).toBe('slack-token');
      expect(result.findings[0].severity).toBe('high');
    });

    it('detects Stripe Secret Key', () => {
      const code = `const stripeKey = "${FICTIONAL_DUMMY_CREDENTIALS.stripeKey}";`;
      const result = scanContent(code);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].ruleId).toBe('stripe-secret-key');
      expect(result.findings[0].severity).toBe('critical');
    });

    it('detects Private Key Header', () => {
      const code = `${FICTIONAL_DUMMY_CREDENTIALS.privateKeyHeader}\nMIIEowIBAAKCAQEA...`;
      const result = scanContent(code);

      expect(result.findings.some((f) => f.ruleId === 'private-key-header')).toBe(true);
      expect(result.findings[0].severity).toBe('critical');
    });

    it('detects JSON Web Token (JWT)', () => {
      const code = `const jwt = "${FICTIONAL_DUMMY_CREDENTIALS.jwtToken}";`;
      const result = scanContent(code);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].ruleId).toBe('jwt-token');
      expect(result.findings[0].severity).toBe('medium');
    });

    it('detects generic secret assignment', () => {
      const code = `const client_secret = "VeryLongRandomSecretKey123456";`;
      const result = scanContent(code);

      expect(result.findings.length).toBeGreaterThanOrEqual(1);
      expect(result.findings[0].ruleId).toBe('generic-credential-assignment');
    });
  });

  describe('Negative Matches (Safe Code)', () => {
    it('returns zero findings on clean production code', () => {
      const result = scanContent(SAFE_CODE_SAMPLE);
      expect(result.findings).toHaveLength(0);
      expect(result.summary.total).toBe(0);
      expect(result.summary.critical).toBe(0);
      expect(result.summary.high).toBe(0);
    });

    it('does not flag standard UUIDs or public URLs', () => {
      const safeSnippets = [
        'const id = "a5e84841-11d7-4632-a7d5-ec5961e9f1a2";',
        'const url = "https://hooks.slack.com/services/T00/B00/XXXX";',
        'const maxRetries = 10;',
        'const greeting = "Hello, world!";',
      ].join('\n');

      const result = scanContent(safeSnippets);
      expect(result.findings).toHaveLength(0);
    });

    it('handles empty input gracefully', () => {
      const result = scanContent('');
      expect(result.findings).toHaveLength(0);
      expect(result.scannedLines).toBe(0);
    });
  });

  describe('Line Number and Column Accuracy', () => {
    it('accurately identifies line numbers in multi-line code', () => {
      const code = `// Line 1: comment
// Line 2: comment
const aws = "${FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey}"; // Line 3
// Line 4: comment
const gcp = "${FICTIONAL_DUMMY_CREDENTIALS.googleApiKey}"; // Line 5
`;
      const result = scanContent(code);
      expect(result.findings).toHaveLength(2);

      const [f1, f2] = result.findings;
      expect(f1.line).toBe(3);
      expect(f1.ruleId).toBe('aws-access-key-id');

      expect(f2.line).toBe(5);
      expect(f2.ruleId).toBe('google-api-key');
    });
  });

  describe('Safe Masking Requirements', () => {
    it('never exposes raw secret in maskedEvidence', () => {
      const rawSecret = FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey;
      const code = `const key = "${rawSecret}";`;
      const result = scanContent(code);

      expect(result.findings).toHaveLength(1);
      const finding = result.findings[0];

      // CRITICAL SECURITY ASSERTION: Raw secret must NOT be in evidence
      expect(finding.maskedEvidence).not.toContain(rawSecret);
      expect(finding.maskedEvidence).toContain('AKIA');
      expect(finding.maskedEvidence).toContain('***');
    });

    it('masks short and long secrets safely', () => {
      expect(maskSecretValue('12345')).toBe('*****');
      const maskedLong = maskSecretValue('AKIAIOSFODNN7EXAMPLE');
      expect(maskedLong).not.toBe('AKIAIOSFODNN7EXAMPLE');
      expect(maskedLong.startsWith('AKIA')).toBe(true);
      expect(maskedLong.includes('******')).toBe(true);
    });
  });

  describe('Redaction and Rescan Verification', () => {
    it('redacts detected secrets and rescans to 0 findings', () => {
      const scanResult = scanContent(SAMPLE_VULNERABLE_CODE);
      expect(scanResult.findings.length).toBeGreaterThan(0);

      // Redact with placeholder
      const redacted = redactSecrets(SAMPLE_VULNERABLE_CODE, scanResult.findings, 'placeholder');

      // Verify dummy secrets are removed
      expect(redacted).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey);
      expect(redacted).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.githubPat);
      expect(redacted).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.googleApiKey);
      expect(redacted).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.stripeKey);
      expect(redacted).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.slackToken);

      // Rescan must yield 0 findings
      const rescanResult = scanContent(redacted);
      expect(rescanResult.findings).toHaveLength(0);
      expect(rescanResult.summary.total).toBe(0);
    });
  });

  describe('Security Report Generation', () => {
    it('generates markdown report with zero exposed raw secrets', () => {
      const scanResult = scanContent(SAMPLE_VULNERABLE_CODE, { fileName: 'config.ts' });
      const md = generateMarkdownReport(scanResult);

      expect(md).toContain('# CommitShield Security Scan Report');
      expect(md).toContain('config.ts');
      expect(md).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey);
      expect(md).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.slackToken);
      expect(md).toContain('L6:C');
    });

    it('generates json report without exposing unmasked secrets', () => {
      const scanResult = scanContent(SAMPLE_VULNERABLE_CODE);
      const jsonStr = generateJsonReport(scanResult);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.tool).toBe('CommitShield');
      expect(parsed.findings.length).toBeGreaterThan(0);
      expect(jsonStr).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey);
      expect(jsonStr).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.slackToken);
    });
  });
});
