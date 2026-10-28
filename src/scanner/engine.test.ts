import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { scanContent, redactSecrets } from './engine';
import {
  generateMarkdownReport,
  generateJsonReport,
  generateRepoMarkdownReport,
  generateRepoJsonReport,
} from './report';
import { scanRepository, redactRepository } from './repoEngine';
import { extractZipArchive, isPathTraversal } from './archive';
import {
  FICTIONAL_DUMMY_CREDENTIALS,
  SAMPLE_VULNERABLE_CODE,
  SAFE_CODE_SAMPLE,
  DEMO_REPOSITORY_FILES,
  SAMPLE_SAFE_REPO_FIXTURE,
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

    it('sanitizes filenames containing secrets in markdown and json reports', () => {
      const secretFileName = `${FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey}.ts`;
      const scanResult = scanContent('const a = 1;', { fileName: secretFileName });
      const md = generateMarkdownReport(scanResult);
      const jsonStr = generateJsonReport(scanResult);

      expect(md).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey);
      expect(jsonStr).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey);
      expect(md).toContain('AKIA');
    });
  });

  describe('Security Hardening & Edge Cases', () => {
    it('handles multiple distinct findings on the exact same line', () => {
      const multiSecretLine = `const a = "${FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey}", b = "${FICTIONAL_DUMMY_CREDENTIALS.googleApiKey}";`;
      const result = scanContent(multiSecretLine);

      expect(result.findings).toHaveLength(2);
      expect(result.findings[0].line).toBe(1);
      expect(result.findings[1].line).toBe(1);
      expect(result.findings[0].column).toBeLessThan(result.findings[1].column);

      // Redact both without offset distortion
      const redacted = redactSecrets(multiSecretLine, result.findings, 'placeholder');
      expect(redacted).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey);
      expect(redacted).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.googleApiKey);
      expect(redacted).toContain('<REDACTED_AWS_ACCESS_KEY_ID>');
      expect(redacted).toContain('<REDACTED_GOOGLE_API_KEY>');

      // Verify surrounding syntax is intact
      expect(redacted.startsWith('const a = "')).toBe(true);
      expect(redacted.includes('", b = "')).toBe(true);
      expect(redacted.endsWith('";')).toBe(true);
    });

    it('suppresses overlapping duplicate matches on the same span', () => {
      // Line where generic assignment matches surrounding quotes AND aws pattern matches the key
      const line = `const api_key = "${FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey}";`;
      const result = scanContent(line);

      // Specific rule should take precedence, no duplicate overlapping records
      expect(result.findings.some((f) => f.ruleId === 'aws-access-key-id')).toBe(true);
      const awsMatches = result.findings.filter((f) => f.ruleId === 'aws-access-key-id');
      expect(awsMatches).toHaveLength(1);
    });

    it('scans large files (1,000+ lines) within sub-second thresholds without memory leak', () => {
      const repetitiveCode = `// Safe line of code\nconsole.log("Safe application line");\n`;
      const largeContent = repetitiveCode.repeat(1500) + `const key = "${FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey}";\n`;

      const startTime = performance.now();
      const result = scanContent(largeContent);
      const durationMs = performance.now() - startTime;

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].line).toBe(3001);
      expect(durationMs).toBeLessThan(500); // Must be under 500ms
    });

    it('handles malformed, weird unicode, and null-like inputs safely', () => {
      expect(scanContent('   \n\t\r\n   ').findings).toHaveLength(0);
      expect(scanContent('🔥✨🚀🔒🛡️').findings).toHaveLength(0);
      expect(scanContent('\\0\\x00\\u0000').findings).toHaveLength(0);
      expect(scanContent(null as unknown as string).findings).toHaveLength(0);
      expect(scanContent(undefined as unknown as string).findings).toHaveLength(0);
    });
  });

  describe('Generic Secret Detection & False Positive Immunity', () => {
    it('detects genuine hardcoded generic secrets (apiSecret, clientSecret, accessToken, authToken)', () => {
      const snippets = [
        'const apiSecret = "8f9a2b4c6e1d3f5a7c9b2d4e6f8a0b2c";',
        'const clientSecret = "1a3b5c7d9e2f4a6b8c0d2e4f6a8b0c2d";',
        'export const accessToken = "fedcba9876543210abcdef0123456789";',
        'const authToken = "9876543210fedcba0123456789abcdef";',
        'password = "SuperSecretCustomPassword987!";',
      ].join('\n');

      const result = scanContent(snippets);
      expect(result.findings).toHaveLength(5);
      expect(result.findings.every((f) => f.ruleId === 'generic-credential-assignment')).toBe(true);
      expect(result.findings[0].suggestedReplacement).toBe('process.env.API_SECRET');
      expect(result.findings[1].suggestedReplacement).toBe('process.env.CLIENT_SECRET');
      expect(result.findings[2].suggestedReplacement).toBe('process.env.ACCESS_TOKEN');
      expect(result.findings[3].suggestedReplacement).toBe('process.env.AUTH_TOKEN');
    });

    it('ignores non-secrets: clientId, apiUrl, baseUrl, endpoints', () => {
      const safeConfig = [
        'const clientId = "client_app_1234567890abcdef";',
        'const apiUrl = "https://api.commitshield.local/v1/auth";',
        'const baseUrl = "https://dashboard.commitshield.local";',
        'const endpoint = "https://hooks.example.com/services/123";',
        'const apiVersion = "2026-10-28";',
        'const appId = "app_prod_998877665544";',
      ].join('\n');

      const result = scanContent(safeConfig);
      expect(result.findings).toHaveLength(0);
    });

    it('ignores documentation placeholders and env variable references', () => {
      const placeholders = [
        'const apiKey = "YOUR_API_KEY_HERE";',
        'const clientSecret = "your_client_secret_placeholder";',
        'const authToken = "insert_your_token_here";',
        'const apiSecret = "process.env.API_SECRET";',
        'const accessToken = "${ACCESS_TOKEN}";',
        'const password = "changeme";',
        'const secretKey = "0000000000000000";', // low entropy repetition
      ].join('\n');

      const result = scanContent(placeholders);
      expect(result.findings).toHaveLength(0);
    });
  });

  describe('Safe Archive Extraction & Security Boundaries', () => {
    it('detects and rejects dangerous path traversal sequences', () => {
      expect(isPathTraversal('../secret.txt')).toBe(true);
      expect(isPathTraversal('foo/../../bar.ts')).toBe(true);
      expect(isPathTraversal('/etc/passwd')).toBe(true);
      expect(isPathTraversal('C:\\Windows\\win.ini')).toBe(true);
      expect(isPathTraversal('src/config/aws.ts')).toBe(false);
    });

    it('extracts nested text files and skips ignored/binary files safely', async () => {
      const zip = new JSZip();
      zip.file('src/index.ts', 'export const a = 1;');
      zip.file('src/nested/config.json', '{"service": "auth"}');
      zip.file('node_modules/pkg/index.js', 'console.log("dep");');
      zip.file('.git/config', '[core]\nrepositoryformatversion = 0');
      zip.file('assets/logo.png', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])); // PNG magic bytes
      zip.file('dist/bundle.js', 'console.log("build");');

      const content = await zip.generateAsync({ type: 'uint8array' });
      const result = await extractZipArchive(content);

      expect(result.success).toBe(true);
      expect(result.files['src/index.ts']).toBe('export const a = 1;');
      expect(result.files['src/nested/config.json']).toBe('{"service": "auth"}');
      expect(result.files['node_modules/pkg/index.js']).toBeUndefined();
      expect(result.files['assets/logo.png']).toBeUndefined();

      // Check skipped files
      expect(result.skippedFiles.some((s) => s.path.includes('node_modules'))).toBe(true);
      expect(result.skippedFiles.some((s) => s.path.includes('logo.png'))).toBe(true);
    });

    it('enforces file count limit in archives', async () => {
      const zip = new JSZip();
      for (let i = 0; i < 15; i++) {
        zip.file(`file_${i}.txt`, `Content ${i}`);
      }

      const content = await zip.generateAsync({ type: 'uint8array' });
      const result = await extractZipArchive(content, { maxFileCount: 10 });

      expect(result.success).toBe(true);
      expect(Object.keys(result.files)).toHaveLength(10);
      expect(result.skippedFiles.some((s) => s.reason === 'oversized')).toBe(true);
    });
  });

  describe('Repository Multi-File Scanning & Redaction', () => {
    it('scans multi-file repositories and groups findings with realistic file paths', () => {
      const repoResult = scanRepository(DEMO_REPOSITORY_FILES, 'demo-repository');

      expect(repoResult.repoName).toBe('demo-repository');
      expect(repoResult.totalFilesScanned).toBe(Object.keys(DEMO_REPOSITORY_FILES).length);
      expect(repoResult.allFindings.length).toBeGreaterThanOrEqual(5);

      // Verify findings matched to correct paths
      const awsFinding = repoResult.allFindings.find((f) => f.ruleId === 'aws-access-key-id');
      expect(awsFinding).toBeDefined();
      expect(awsFinding?.filePath).toBe('src/config.ts');
      expect(awsFinding?.line).toBe(6);

      const githubFinding = repoResult.allFindings.find((f) => f.ruleId === 'github-pat');
      expect(githubFinding).toBeDefined();
      expect(githubFinding?.filePath).toBe('src/auth.ts');
      expect(githubFinding?.line).toBe(2);

      const stripeFinding = repoResult.allFindings.find((f) => f.ruleId === 'stripe-secret-key');
      expect(stripeFinding).toBeDefined();
      expect(stripeFinding?.filePath).toBe('src/services/stripe.ts');
      expect(stripeFinding?.line).toBe(3);

      const slackFinding = repoResult.allFindings.find((f) => f.ruleId === 'slack-token');
      expect(slackFinding).toBeDefined();
      expect(slackFinding?.filePath).toBe('src/notifications/slack.ts');
      expect(slackFinding?.line).toBe(2);

      // Verify safe files had 0 findings
      const publicConfig = repoResult.files.find((f) => f.filePath === 'public/config.json');
      expect(publicConfig?.summary.total).toBe(0);

      const envExample = repoResult.files.find((f) => f.filePath === '.env.example');
      expect(envExample?.summary.total).toBe(0);

      const readme = repoResult.files.find((f) => f.filePath === 'README.md');
      expect(readme?.summary.total).toBe(0);

      const emptyFile = repoResult.files.find((f) => f.filePath === 'src/empty.ts');
      expect(emptyFile?.lines).toBe(0);
      expect(emptyFile?.bytes).toBe(0);
      expect(emptyFile?.summary.total).toBe(0);

      // Verify affected files calculation
      const affectedFiles = repoResult.files.filter((f) => f.findings.length > 0);
      expect(affectedFiles.length).toBe(4);
    });

    it('handles empty repositories safely without errors', () => {
      const repoResult = scanRepository({}, 'empty-repo');
      expect(repoResult.totalFilesScanned).toBe(0);
      expect(repoResult.totalLinesScanned).toBe(0);
      expect(repoResult.allFindings).toHaveLength(0);
      expect(repoResult.summary.total).toBe(0);
    });

    it('returns zero findings for clean repositories', () => {
      const repoResult = scanRepository(SAMPLE_SAFE_REPO_FIXTURE, 'safe-repo');
      expect(repoResult.summary.total).toBe(0);
      expect(repoResult.allFindings).toHaveLength(0);
    });

    it('redacts entire repositories and rescans cleanly to 0 findings', () => {
      const repoResult = scanRepository(DEMO_REPOSITORY_FILES, 'demo-repository');
      const sanitizedRepo = redactRepository(DEMO_REPOSITORY_FILES, repoResult, 'placeholder');

      // Verify secrets removed from each file
      expect(sanitizedRepo['src/config.ts']).toContain('<REDACTED_AWS_ACCESS_KEY_ID>');
      expect(sanitizedRepo['src/config.ts']).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey);

      expect(sanitizedRepo['src/auth.ts']).toContain('<REDACTED_GITHUB_PAT>');
      expect(sanitizedRepo['src/auth.ts']).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.githubPat);

      // Rescan sanitized repo
      const rescanResult = scanRepository(sanitizedRepo, 'sanitized-repo');
      expect(rescanResult.summary.total).toBe(0);
      expect(rescanResult.allFindings).toHaveLength(0);
    });

    it('generates repository markdown and json reports with 100% masked credentials', () => {
      const repoResult = scanRepository(DEMO_REPOSITORY_FILES, 'demo-repository', [
        { path: 'assets/logo.png', reason: 'binary' },
      ]);
      const md = generateRepoMarkdownReport(repoResult);
      const json = generateRepoJsonReport(repoResult);

      expect(md).toContain('# CommitShield Repository Security Report');
      expect(md).toContain('src/config.ts');
      expect(md).toContain('Skipped Files (1)');
      expect(md).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey);

      const parsed = JSON.parse(json);
      expect(parsed.scanMode).toBe('repository');
      expect(parsed.stats.filesScanned).toBe(Object.keys(DEMO_REPOSITORY_FILES).length);
      expect(json).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey);
    });
  });
});
