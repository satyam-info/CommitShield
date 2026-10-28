import { describe, it, expect, vi, afterEach } from 'vitest';
import JSZip from 'jszip';
import {
  parseGitHubUrl,
  fetchGitHubRepoMetadata,
  fetchGitHubBranches,
  downloadGitHubZipArchive,
  scanGitHubHistory,
} from './github';
import { extractZipArchive } from './archive';
import { scanContent } from './engine';
import { FICTIONAL_DUMMY_CREDENTIALS } from './fixtures';
import type { FileFinding } from './types';

describe('CommitShield GitHub Integration & Historical Scanning', () => {
  describe('GitHub URL Parser & Validator', () => {
    it('parses standard HTTPS GitHub repository URLs', () => {
      const parsed = parseGitHubUrl('https://github.com/satyam-info/CommitShield');
      expect(parsed.isValid).toBe(true);
      expect(parsed.owner).toBe('satyam-info');
      expect(parsed.repo).toBe('CommitShield');
      expect(parsed.branch).toBeUndefined();
    });

    it('parses URLs with .git extension and trailing slashes', () => {
      const parsed = parseGitHubUrl('https://github.com/facebook/react.git///');
      expect(parsed.isValid).toBe(true);
      expect(parsed.owner).toBe('facebook');
      expect(parsed.repo).toBe('react');
    });

    it('parses shorthand owner/repo notation', () => {
      const parsed = parseGitHubUrl('vercel/next.js');
      expect(parsed.isValid).toBe(true);
      expect(parsed.owner).toBe('vercel');
      expect(parsed.repo).toBe('next.js');
    });

    it('parses github.com/owner/repo without protocol', () => {
      const parsed = parseGitHubUrl('github.com/tailwindlabs/tailwindcss');
      expect(parsed.isValid).toBe(true);
      expect(parsed.owner).toBe('tailwindlabs');
      expect(parsed.repo).toBe('tailwindcss');
    });

    it('parses tree branch paths', () => {
      const parsed = parseGitHubUrl('https://github.com/owner/repo/tree/feature/v2-redesign');
      expect(parsed.isValid).toBe(true);
      expect(parsed.owner).toBe('owner');
      expect(parsed.repo).toBe('repo');
      expect(parsed.branch).toBe('feature/v2-redesign');
    });

    it('parses git SSH format', () => {
      const parsed = parseGitHubUrl('git@github.com:owner/my-repo.git');
      expect(parsed.isValid).toBe(true);
      expect(parsed.owner).toBe('owner');
      expect(parsed.repo).toBe('my-repo');
    });

    it('rejects non-GitHub domains with helpful feedback', () => {
      const parsed = parseGitHubUrl('https://gitlab.com/owner/repo');
      expect(parsed.isValid).toBe(false);
      expect(parsed.error).toContain('Only public repositories on github.com');
    });

    it('rejects insecure protocols', () => {
      const parsedHttp = parseGitHubUrl('http://github.com/owner/repo');
      expect(parsedHttp.isValid).toBe(false);
      expect(parsedHttp.error).toContain('Insecure http://');

      const parsedGit = parseGitHubUrl('git://github.com/owner/repo');
      expect(parsedGit.isValid).toBe(false);
      expect(parsedGit.error).toContain('Insecure git://');
    });

    it('rejects empty or malformed inputs', () => {
      expect(parseGitHubUrl('').isValid).toBe(false);
      expect(parseGitHubUrl('justastring').isValid).toBe(false);
    });
  });

  describe('GitHub Zipball Common Root Stripping', () => {
    it('automatically strips GitHub single root directory prefix from archive entries', async () => {
      const zip = new JSZip();
      // GitHub zipball structure: owner-repo-sha/path
      zip.file('satyam-info-CommitShield-5016684/src/config.ts', 'export const a = 1;');
      zip.file('satyam-info-CommitShield-5016684/README.md', '# Readme');

      const buffer = await zip.generateAsync({ type: 'uint8array' });
      const extracted = await extractZipArchive(buffer);

      expect(extracted.success).toBe(true);
      expect(extracted.files['src/config.ts']).toBe('export const a = 1;');
      expect(extracted.files['README.md']).toBe('# Readme');
      expect(extracted.files['satyam-info-CommitShield-5016684/src/config.ts']).toBeUndefined();
    });

    it('preserves paths when there is no single shared root directory', async () => {
      const zip = new JSZip();
      zip.file('src/index.ts', 'console.log(1);');
      zip.file('public/favicon.ico', 'icon');

      const buffer = await zip.generateAsync({ type: 'uint8array' });
      const extracted = await extractZipArchive(buffer);

      expect(extracted.success).toBe(true);
      expect(extracted.files['src/index.ts']).toBe('console.log(1);');
    });
  });

  describe('Historical Patch Detection & Lingering Secret Classification', () => {
    it('detects secrets inside patch additions and flags historical-only status', () => {
      const patch = `
@@ -10,4 +10,5 @@
-const port = 3000;
+const port = 3000;
+const awsKey = "${FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey}";
 `;
      const addedLines = patch
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1))
        .join('\n');

      const result = scanContent(addedLines, { fileName: 'src/config.ts' });
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].ruleId).toBe('aws-access-key-id');

      // If HEAD has NO findings on this file, it is historical-only
      const currentHeadFindings: FileFinding[] = [];
      const isStillInHead = currentHeadFindings.some(
        (hf) => hf.filePath === 'src/config.ts' && hf.ruleId === result.findings[0].ruleId
      );
      const isHistoricalOnly = !isStillInHead;
      expect(isHistoricalOnly).toBe(true);
    });
  });

  describe('GitHub REST API Mocked Interactivity', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('fetches public repository metadata successfully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'x-ratelimit-remaining': '55',
          'x-ratelimit-limit': '60',
        }),
        json: async () => ({
          name: 'CommitShield',
          owner: { login: 'satyam-info' },
          full_name: 'satyam-info/CommitShield',
          description: 'Zero-knowledge secret scanner',
          default_branch: 'main',
          stargazers_count: 42,
          forks_count: 5,
          private: false,
          size: 1024,
          html_url: 'https://github.com/satyam-info/CommitShield',
        }),
      } as unknown as Response);

      const result = await fetchGitHubRepoMetadata('satyam-info', 'CommitShield');
      expect(result.metadata.fullName).toBe('satyam-info/CommitShield');
      expect(result.metadata.stars).toBe(42);
      expect(result.metadata.defaultBranch).toBe('main');
      expect(result.rateLimitRemaining).toBe(55);
    });

    it('handles 404 repository not found with clear explanation', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
      } as unknown as Response);

      await expect(
        fetchGitHubRepoMetadata('nonexistent', 'private-or-missing')
      ).rejects.toThrow(/not found or is private/i);
    });

    it('handles 403 unauthenticated rate limit error gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({
          'x-ratelimit-remaining': '0',
          'x-ratelimit-limit': '60',
        }),
      } as unknown as Response);

      await expect(
        fetchGitHubRepoMetadata('owner', 'repo')
      ).rejects.toThrow(/rate limit exceeded/i);
    });

    it('falls back to default branches on error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));
      const branches = await fetchGitHubBranches('owner', 'repo');
      expect(branches).toEqual(['main', 'master']);
    });

    it('scans commit history and correlates lingering secrets against HEAD', async () => {
      // 1. First fetch for commits list
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({
            'x-ratelimit-remaining': '40',
            'x-ratelimit-limit': '60',
          }),
          json: async () => [
            {
              sha: 'abcdef1234567890abcdef1234567890abcdef12',
              commit: {
                message: 'fix: remove exposed AWS key from config',
                author: { name: 'Alice Developer', date: '2026-03-01T12:00:00Z' },
              },
              html_url: 'https://github.com/owner/repo/commit/abcdef1234567890',
            },
          ],
        } as unknown as Response)
        // 2. Second fetch for commit detail with patch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            files: [
              {
                filename: 'src/config.ts',
                patch: `@@ -1,3 +1,3 @@\n-const old = 1;\n+const awsKey = "${FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey}";`,
              },
            ],
          }),
        } as unknown as Response);

      // HEAD is currently CLEAN (secret was deleted from HEAD)
      const headFindings: FileFinding[] = [];

      const historyResult = await scanGitHubHistory('owner', 'repo', 'main', headFindings, 1);

      expect(historyResult.commitsScanned).toBe(1);
      expect(historyResult.commitsWithFindings).toBe(1);
      expect(historyResult.totalHistoricalFindings).toBe(1);
      expect(historyResult.historicalOnlyFindingsCount).toBe(1);

      const finding = historyResult.findings[0];
      expect(finding.commitSha).toBe('abcdef1234567890abcdef1234567890abcdef12');
      expect(finding.shortSha).toBe('abcdef1');
      expect(finding.author).toBe('Alice Developer');
      expect(finding.ruleId).toBe('aws-access-key-id');
      expect(finding.isHistoricalOnly).toBe(true);
      expect(finding.filePath).toBe('src/config.ts');
    });

    it('gracefully reports rate-limiting during commit history scan without throwing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({
          'x-ratelimit-remaining': '0',
          'x-ratelimit-limit': '60',
        }),
      } as unknown as Response);

      const historyResult = await scanGitHubHistory('owner', 'repo', 'main');
      expect(historyResult.isRateLimited).toBe(true);
      expect(historyResult.commitsScanned).toBe(0);
      expect(historyResult.findings).toHaveLength(0);
      expect(historyResult.error).toContain('rate limit');
    });

    it('prefers direct browser Git Trees + raw.githubusercontent.com as primary strategy', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            tree: [{ path: 'src/config.ts', type: 'blob', size: 50 }],
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => 'export const a = 1;',
        } as unknown as Response);

      const blob = await downloadGitHubZipArchive('owner', 'repo', 'main');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('falls back to secured Vercel serverless proxy when Git Trees is rate-limited', async () => {
      const dummyBlob = new Blob(['fake-zip-binary'], { type: 'application/zip' });
      vi.spyOn(globalThis, 'fetch')
        // 1. Git Trees returns 403 rate limit
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: new Headers(),
        } as unknown as Response)
        // 2. /api/github-archive returns zip blob
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/zip' }),
          blob: async () => dummyBlob,
        } as unknown as Response);

      const blob = await downloadGitHubZipArchive('owner', 'repo', 'main');
      expect(blob.size).toBe(dummyBlob.size);
    });

    it('handles 413 payload too large from serverless proxy when archive exceeds 25 MB', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: new Headers(),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 413,
          headers: new Headers({ 'content-type': 'application/json' }),
        } as unknown as Response);

      await expect(
        downloadGitHubZipArchive('large-org', 'giant-repo', 'main')
      ).rejects.toThrow(/25 MB size limit/i);
    });
  });
});
