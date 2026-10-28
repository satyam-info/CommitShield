import JSZip from 'jszip';
import type {
  GitHubRepoMetadata,
  HistoricalCommitFinding,
  GitHistoryScanResult,
  FileFinding,
} from './types';
import { scanContent } from './engine';

export interface ParsedGitHubUrl {
  isValid: boolean;
  owner: string;
  repo: string;
  branch?: string;
  error?: string;
}

/**
 * Validates and parses GitHub repository URLs or shorthand owner/repo patterns.
 */
export function parseGitHubUrl(input: string): ParsedGitHubUrl {
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      owner: '',
      repo: '',
      error: 'Please enter a GitHub repository URL or owner/repo identifier.',
    };
  }

  const cleanInput = input.trim();

  // Pattern 1: git@github.com:owner/repo.git
  const sshMatch = cleanInput.match(/^git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/);
  if (sshMatch) {
    return validateOwnerRepo(sshMatch[1], sshMatch[2]);
  }

  // Pattern 2: https://github.com/owner/repo(/tree/branch)?
  // or github.com/owner/repo
  // or owner/repo
  let normalized = cleanInput;
  if (normalized.startsWith('git://')) {
    return {
      isValid: false,
      owner: '',
      repo: '',
      error: 'Insecure git:// protocol is not supported. Use https:// or owner/repo.',
    };
  }

  if (normalized.startsWith('http://')) {
    return {
      isValid: false,
      owner: '',
      repo: '',
      error: 'Insecure http:// protocol is not supported. Please use https://github.com/owner/repo.',
    };
  }

  // Remove leading protocol
  normalized = normalized.replace(/^https?:\/\//, '');

  // Reject non-github domains if a domain was specified
  if (normalized.includes('/') && (normalized.includes('.com') || normalized.includes('.org') || normalized.includes('.io'))) {
    if (!normalized.startsWith('github.com/')) {
      return {
        isValid: false,
        owner: '',
        repo: '',
        error: 'Only public repositories on github.com are currently supported.',
      };
    }
  }

  // Strip github.com/ prefix
  normalized = normalized.replace(/^github\.com\//, '');
  // Strip trailing slashes first
  normalized = normalized.replace(/\/+$/, '');
  // Strip trailing .git
  normalized = normalized.replace(/\.git$/, '');
  // Strip trailing slashes again if any existed before .git
  normalized = normalized.replace(/\/+$/, '');

  const parts = normalized.split('/');
  if (parts.length < 2) {
    return {
      isValid: false,
      owner: '',
      repo: '',
      error: 'Invalid format. Expected https://github.com/owner/repo or owner/repo.',
    };
  }

  const owner = parts[0];
  const repo = parts[1];
  let branch: string | undefined;

  // Support https://github.com/owner/repo/tree/branch-name
  if (parts.length >= 4 && parts[2] === 'tree') {
    branch = parts.slice(3).join('/');
  }

  return validateOwnerRepo(owner, repo, branch);
}

function validateOwnerRepo(owner: string, repo: string, branch?: string): ParsedGitHubUrl {
  const cleanOwner = owner.trim();
  const cleanRepo = repo.trim();

  // GitHub username: alphanumeric and single hyphens, max 39 chars
  const ownerRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
  // GitHub repo: alphanumeric, hyphens, underscores, dots, max 100 chars
  const repoRegex = /^[a-zA-Z0-9_.-]{1,100}$/;

  if (!ownerRegex.test(cleanOwner)) {
    return {
      isValid: false,
      owner: cleanOwner,
      repo: cleanRepo,
      error: `Invalid GitHub owner or organization name: "${cleanOwner}".`,
    };
  }

  if (!repoRegex.test(cleanRepo)) {
    return {
      isValid: false,
      owner: cleanOwner,
      repo: cleanRepo,
      error: `Invalid repository name: "${cleanRepo}".`,
    };
  }

  return {
    isValid: true,
    owner: cleanOwner,
    repo: cleanRepo,
    branch: branch?.trim() || undefined,
  };
}

/**
 * Fetches public repository metadata from GitHub REST API.
 */
export async function fetchGitHubRepoMetadata(
  owner: string,
  repo: string,
  signal?: AbortSignal
): Promise<{
  metadata: GitHubRepoMetadata;
  rateLimitRemaining: number;
  rateLimitLimit: number;
}> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
      signal,
    });
  } catch (err) {
    throw new Error(
      `Network connection failed while querying GitHub API (${err instanceof Error ? err.message : 'Unknown network error'}). You can upload a local .zip archive directly.`
    );
  }

  const rateRemaining = parseInt(res.headers.get('x-ratelimit-remaining') || '60', 10);
  const rateLimit = parseInt(res.headers.get('x-ratelimit-limit') || '60', 10);

  if (res.status === 404) {
    throw new Error(
      `Repository "${owner}/${repo}" was not found or is private. CommitShield operates zero-knowledge on public repositories without requesting your GitHub credentials.`
    );
  }

  if (res.status === 403 && rateRemaining === 0) {
    throw new Error(
      'GitHub unauthenticated API rate limit exceeded (60 requests/hour per IP). Please wait before retrying or upload a local .zip archive directly.'
    );
  }

  if (!res.ok) {
    throw new Error(`GitHub API returned status ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();

  if (data.private) {
    throw new Error(
      `Repository "${owner}/${repo}" is private. To preserve security and avoid token leaks, CommitShield only imports public repositories client-side.`
    );
  }

  const metadata: GitHubRepoMetadata = {
    owner: data.owner?.login || owner,
    repo: data.name || repo,
    fullName: data.full_name || `${owner}/${repo}`,
    description: data.description || undefined,
    defaultBranch: data.default_branch || 'main',
    stars: data.stargazers_count || 0,
    forks: data.forks_count || 0,
    isPrivate: Boolean(data.private),
    sizeKb: data.size || 0,
    htmlUrl: data.html_url || `https://github.com/${owner}/${repo}`,
  };

  return { metadata, rateLimitRemaining: rateRemaining, rateLimitLimit: rateLimit };
}

/**
 * Lists available branches for a repository.
 */
export async function fetchGitHubBranches(
  owner: string,
  repo: string,
  signal?: AbortSignal
): Promise<string[]> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=30`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      signal,
    });

    if (!res.ok) return ['main', 'master'];
    const list = await res.json();
    if (Array.isArray(list)) {
      return list.map((b: { name: string }) => b.name).filter(Boolean);
    }
    return ['main', 'master'];
  } catch {
    return ['main', 'master'];
  }
}

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'pdf', 'zip', 'tar', 'gz',
  '7z', 'rar', 'exe', 'dll', 'so', 'dylib', 'bin', 'woff', 'woff2', 'ttf', 'eot',
  'mp3', 'mp4', 'mov', 'avi', 'wav', 'lock',
]);

/** Maximum archive file extraction limit: 1,000 files */
const MAX_IMPORT_FILES = 1000;

/** Maximum total text payload size: 25 MB */
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

/**
 * Downloads public repository text files directly in the browser via GitHub's
 * Git Trees API and raw.githubusercontent.com CDN (which natively provides
 * Access-Control-Allow-Origin: * without requiring any intermediate server proxy).
 */
export async function downloadViaGitTrees(
  owner: string,
  repo: string,
  ref: string,
  signal?: AbortSignal
): Promise<Blob | null> {
  const treeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  let treeRes: Response;
  try {
    treeRes = await fetch(treeUrl, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      signal,
    });
  } catch {
    return null;
  }

  if (treeRes.status === 404) {
    throw new Error(`Branch or tag "${ref}" not found in repository "${owner}/${repo}".`);
  }

  if (!treeRes.ok) {
    // 403 rate limit or other upstream error: fall back to serverless proxy
    return null;
  }

  const data = await treeRes.json();
  if (!data || !Array.isArray(data.tree) || data.truncated) {
    // Truncated tree (> 100k files) - fall back to archive download
    return null;
  }

  const textFiles = data.tree.filter((item: { path: string; type: string; size?: number }) => {
    if (item.type !== 'blob') return false;
    if (item.path.startsWith('.git/')) return false;
    if (item.size && item.size > 1024 * 1024) return false; // skip individual files > 1MB
    const ext = item.path.split('.').pop()?.toLowerCase();
    if (ext && BINARY_EXTENSIONS.has(ext)) return false;
    return true;
  });

  if (textFiles.length === 0 || textFiles.length > MAX_IMPORT_FILES) {
    return null;
  }

  const zip = new JSZip();
  let totalBytes = 0;
  const BATCH_SIZE = 10;

  for (let i = 0; i < textFiles.length; i += BATCH_SIZE) {
    if (signal?.aborted) throw new Error('Repository import was cancelled.');
    const batch = textFiles.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (item: { path: string }) => {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/${item.path}`;
          const rawRes = await fetch(rawUrl, { signal });
          if (rawRes.ok) {
            const text = await rawRes.text();
            totalBytes += text.length;
            if (totalBytes <= MAX_IMPORT_BYTES) {
              zip.file(item.path, text);
            }
          }
        } catch {
          // Ignore individual network hiccups on non-critical files
        }
      })
    );
  }

  if (Object.keys(zip.files).length === 0) {
    return null;
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

/**
 * Downloads the public repository source archive directly into browser memory.
 * Uses a resilient, production-ready multi-tier strategy:
 * 1. Primary: Direct browser-side Git Trees + raw.githubusercontent.com CDN
 *    (Zero-knowledge peer-to-peer download with native CORS Access-Control-Allow-Origin: *).
 * 2. Secondary: Secured Vercel Serverless Function & Vite proxy (/api/github-archive)
 *    (Streams full zip archive directly from codeload.github.com with strict SSRF and 25MB limits).
 * 3. Fallback: Direct GitHub REST API zipball (for non-browser / permissive environments).
 */
export async function downloadGitHubZipArchive(
  owner: string,
  repo: string,
  ref: string,
  signal?: AbortSignal
): Promise<Blob> {
  // Strategy 1 (Primary in Browser): Direct Git Trees + raw.githubusercontent.com
  // Completely token-free, serverless, and unaffected by codeload.github.com browser CORS
  try {
    const treeBlob = await downloadViaGitTrees(owner, repo, ref, signal);
    if (treeBlob && treeBlob.size > 0) {
      return treeBlob;
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      throw err;
    }
    // Fall through to Strategy 2
  }

  // Strategy 2 (Production Vercel & Dev Vite Serverless Proxy):
  // Handles rate-limited IPs or large archives via secured proxy
  try {
    const proxyUrl = `/api/github-archive?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&ref=${encodeURIComponent(ref)}`;
    const proxyRes = await fetch(proxyUrl, { signal });
    if (proxyRes.ok) {
      const contentType = proxyRes.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const blob = await proxyRes.blob();
        if (blob.size > 0) {
          return blob;
        }
      }
    } else if (proxyRes.status === 404) {
      throw new Error(`Branch or tag "${ref}" not found in repository "${owner}/${repo}".`);
    } else if (proxyRes.status === 413) {
      throw new Error('Repository archive exceeds the 25 MB size limit.');
    }
  } catch (err) {
    if (err instanceof Error && (err.message.includes('not found') || err.message.includes('25 MB size limit'))) {
      throw err;
    }
    // Local/Vercel proxy unreachable or running in static export - fall through to Strategy 3
  }

  // Strategy 3: Direct GitHub REST API zipball fetch (works in CLI / test / non-browser environments)
  const directUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball/${encodeURIComponent(ref)}`;
  try {
    const apiRes = await fetch(directUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
      signal,
    });

    if (apiRes.ok) {
      const blob = await apiRes.blob();
      if (blob.size > 0) {
        return blob;
      }
    } else if (apiRes.status === 404) {
      throw new Error(`Branch or tag "${ref}" not found in repository "${owner}/${repo}".`);
    } else if (apiRes.status === 403) {
      const rateRemaining = parseInt(apiRes.headers.get('x-ratelimit-remaining') || '0', 10);
      if (rateRemaining === 0) {
        throw new Error(
          'GitHub API rate limit reached (60 requests/hour). Please wait or upload a local .zip archive directly.'
        );
      }
    }
  } catch (err) {
    if (err instanceof Error && (err.message.includes('not found') || err.message.includes('rate limit'))) {
      throw err;
    }
    // Network / CORS error on codeload.github.com redirect
  }

  throw new Error(
    `Failed to download repository archive from GitHub. Due to browser CORS restrictions on GitHub archives, you can download the .zip directly from GitHub (https://github.com/${owner}/${repo}/archive/refs/heads/${ref}.zip) and drop it into CommitShield.`
  );
}

/**
 * Scans bounded recent Git commit history for historical exposures.
 * Bounded to maxCommits (default 10) to respect unauthenticated rate limits.
 */
export async function scanGitHubHistory(
  owner: string,
  repo: string,
  ref: string,
  currentHeadFindings: FileFinding[] = [],
  maxCommits = 10,
  signal?: AbortSignal
): Promise<GitHistoryScanResult> {
  const commitsUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${maxCommits}&sha=${encodeURIComponent(ref)}`;

  let res: Response;
  try {
    res = await fetch(commitsUrl, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      signal,
    });
  } catch (err) {
    return {
      commitsScanned: 0,
      commitsWithFindings: 0,
      totalHistoricalFindings: 0,
      historicalOnlyFindingsCount: 0,
      findings: [],
      isRateLimited: false,
      error: `Network error retrieving Git commits: ${err instanceof Error ? err.message : 'Unknown error'}.`,
    };
  }

  const rateRemaining = parseInt(res.headers.get('x-ratelimit-remaining') || '60', 10);
  const rateLimit = parseInt(res.headers.get('x-ratelimit-limit') || '60', 10);

  if (res.status === 403 && rateRemaining === 0) {
    return {
      commitsScanned: 0,
      commitsWithFindings: 0,
      totalHistoricalFindings: 0,
      historicalOnlyFindingsCount: 0,
      findings: [],
      isRateLimited: true,
      rateLimitRemaining: 0,
      rateLimitLimit: rateLimit,
      error: 'GitHub API rate limit reached. Historical commit scan skipped.',
    };
  }

  if (!res.ok) {
    return {
      commitsScanned: 0,
      commitsWithFindings: 0,
      totalHistoricalFindings: 0,
      historicalOnlyFindingsCount: 0,
      findings: [],
      isRateLimited: false,
      error: `Could not load commit history: ${res.status} ${res.statusText}`,
    };
  }

  const commitList = await res.json();
  if (!Array.isArray(commitList) || commitList.length === 0) {
    return {
      commitsScanned: 0,
      commitsWithFindings: 0,
      totalHistoricalFindings: 0,
      historicalOnlyFindingsCount: 0,
      findings: [],
      isRateLimited: false,
      rateLimitRemaining: rateRemaining,
      rateLimitLimit: rateLimit,
    };
  }

  const historicalFindings: HistoricalCommitFinding[] = [];
  const commitsWithIssues = new Set<string>();

  // Inspect each commit diff patch (limit up to maxCommits)
  for (const c of commitList.slice(0, maxCommits)) {
    const sha = c.sha;
    const shortSha = sha.slice(0, 7);
    const message = c.commit?.message?.split('\n')[0] || 'Commit';
    const author = c.commit?.author?.name || c.author?.login || 'Unknown';
    const timestamp = c.commit?.author?.date || '';
    const commitUrl = c.html_url || `https://github.com/${owner}/${repo}/commit/${sha}`;

    try {
      const detailRes = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${sha}`,
        {
          headers: { Accept: 'application/vnd.github.v3+json' },
          signal,
        }
      );

      if (!detailRes.ok) continue;
      const detail = await detailRes.json();
      const files = detail.files || [];

      for (const file of files) {
        if (!file.patch || typeof file.patch !== 'string') continue;

        // Extract added lines from the unified patch
        const patchLines = file.patch.split(/\r?\n/);
        const addedLines: string[] = [];

        for (const line of patchLines) {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            addedLines.push(line.slice(1));
          }
        }

        if (addedLines.length === 0) continue;

        const scanResult = scanContent(addedLines.join('\n'), { fileName: file.filename });

        for (const finding of scanResult.findings) {
          // Check if this finding is still active in HEAD
          const isStillInHead = currentHeadFindings.some(
            (hf) => hf.filePath === file.filename && hf.ruleId === finding.ruleId
          );

          const histId = `${sha}-${file.filename}-${finding.ruleId}-${finding.line}-${finding.column}`;

          // Avoid duplicate reports for same commit & rule in same file
          if (!historicalFindings.some((hf) => hf.id === histId)) {
            historicalFindings.push({
              id: histId,
              commitSha: sha,
              shortSha,
              commitMessage: message,
              author,
              timestamp,
              commitUrl,
              filePath: file.filename,
              ruleId: finding.ruleId,
              ruleName: finding.ruleName,
              severity: finding.severity,
              maskedEvidence: finding.maskedEvidence,
              suggestedReplacement: finding.suggestedReplacement,
              isHistoricalOnly: !isStillInHead,
            });
            commitsWithIssues.add(sha);
          }
        }
      }
    } catch {
      // Continue inspecting other commits if one detail fetch fails
      continue;
    }
  }

  const historicalOnlyCount = historicalFindings.filter((f) => f.isHistoricalOnly).length;

  return {
    commitsScanned: Math.min(commitList.length, maxCommits),
    commitsWithFindings: commitsWithIssues.size,
    totalHistoricalFindings: historicalFindings.length,
    historicalOnlyFindingsCount: historicalOnlyCount,
    findings: historicalFindings,
    rateLimitRemaining: rateRemaining,
    rateLimitLimit: rateLimit,
    isRateLimited: false,
  };
}
