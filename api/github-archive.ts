import type { IncomingMessage, ServerResponse } from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

/** Maximum archive download size: 25 MB (matches CommitShield archive limit) */
export const MAX_ARCHIVE_SIZE_BYTES = 25 * 1024 * 1024;

/** Maximum allowed request duration: 10 seconds */
export const ARCHIVE_DOWNLOAD_TIMEOUT_MS = 10_000;

export interface ArchiveParams {
  owner: string;
  repo: string;
  ref: string;
}

/**
 * Validates and sanitizes GitHub owner, repository, and ref parameters.
 * Enforces strict character sets to prevent command injection, SSRF, and path traversal.
 */
export function validateArchiveParams(
  ownerParam: unknown,
  repoParam: unknown,
  refParam: unknown
): { isValid: true; params: ArchiveParams } | { isValid: false; error: string } {
  if (typeof ownerParam !== 'string' || typeof repoParam !== 'string') {
    return { isValid: false, error: 'Missing required "owner" or "repo" parameter.' };
  }

  const owner = ownerParam.trim();
  const repo = repoParam.trim();
  const ref = typeof refParam === 'string' && refParam.trim() ? refParam.trim() : 'main';

  // GitHub username / org validation: alphanumeric, single hyphens, max 39 chars
  const ownerRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
  if (!ownerRegex.test(owner)) {
    return { isValid: false, error: `Invalid GitHub owner or organization name: "${owner}".` };
  }

  // GitHub repo name validation: alphanumeric, hyphens, underscores, dots, max 100 chars
  const repoRegex = /^[a-zA-Z0-9_.-]{1,100}$/;
  if (!repoRegex.test(repo) || repo === '.' || repo === '..') {
    return { isValid: false, error: `Invalid GitHub repository name: "${repo}".` };
  }

  // Ref validation: safe branch/tag/commit format, no path traversal ("..")
  const refRegex = /^[a-zA-Z0-9_./-]{1,100}$/;
  if (!refRegex.test(ref) || ref.includes('..') || ref.startsWith('/') || ref.endsWith('/')) {
    return { isValid: false, error: `Invalid git ref: "${ref}". Path traversal is not permitted.` };
  }

  return { isValid: true, params: { owner, repo, ref } };
}

/**
 * Checks whether a redirect destination is a trusted GitHub host.
 * Strictly blocks private IP ranges, loopback, and arbitrary remote hosts (SSRF prevention).
 */
export function isAllowedGitHubHost(hostname: string): boolean {
  const clean = hostname.toLowerCase();
  if (clean === 'codeload.github.com' || clean === 'github.com') {
    return true;
  }
  if (clean.endsWith('.github.com') || clean.endsWith('.githubusercontent.com')) {
    return true;
  }
  return false;
}

/**
 * Streams a public GitHub archive from codeload.github.com with strict SSRF,
 * redirect validation, byte-size caps, and timeout enforcement.
 */
export function streamGitHubArchive(
  owner: string,
  repo: string,
  ref: string,
  res: ServerResponse,
  maxRedirects = 3
): void {
  const targetUrl = `https://codeload.github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zip/${encodeURIComponent(ref)}`;
  pipeSafeRemoteUrl(targetUrl, res, maxRedirects);
}

function pipeSafeRemoteUrl(
  targetUrl: string,
  res: ServerResponse,
  maxRedirectsRemaining: number
): void {
  if (maxRedirectsRemaining < 0) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Too many upstream redirects.' }));
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Malformed upstream URL.' }));
    return;
  }

  // SSRF check: only HTTPS and trusted GitHub hostnames allowed
  if (parsed.protocol !== 'https:' || !isAllowedGitHubHost(parsed.hostname)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Untrusted upstream destination blocked.' }));
    return;
  }

  const client = https;
  let receivedBytes = 0;
  let isDone = false;

  const timer = setTimeout(() => {
    if (!isDone) {
      isDone = true;
      req.destroy();
      if (!res.headersSent) {
        res.statusCode = 504;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Gateway timeout fetching GitHub archive (10s limit exceeded).' }));
      }
    }
  }, ARCHIVE_DOWNLOAD_TIMEOUT_MS);

  const req = client.get(
    targetUrl,
    {
      headers: {
        'User-Agent': 'CommitShield-Production-Scanner/1.0',
        Accept: 'application/zip, application/octet-stream, */*',
      },
    },
    (remoteRes) => {
      // Follow safe 3xx redirects
      if (
        remoteRes.statusCode &&
        remoteRes.statusCode >= 300 &&
        remoteRes.statusCode < 400 &&
        remoteRes.headers.location
      ) {
        clearTimeout(timer);
        const nextUrl = new URL(remoteRes.headers.location, targetUrl).toString();
        pipeSafeRemoteUrl(nextUrl, res, maxRedirectsRemaining - 1);
        return;
      }

      if (remoteRes.statusCode === 404) {
        clearTimeout(timer);
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Repository or ref not found on GitHub.' }));
        return;
      }

      if (!remoteRes.statusCode || remoteRes.statusCode < 200 || remoteRes.statusCode >= 300) {
        clearTimeout(timer);
        res.statusCode = remoteRes.statusCode || 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: `Upstream returned status ${remoteRes.statusCode}.` }));
        return;
      }

      // Check Content-Length upfront if provided
      const reportedLen = parseInt(remoteRes.headers['content-length'] || '0', 10);
      if (reportedLen > MAX_ARCHIVE_SIZE_BYTES) {
        clearTimeout(timer);
        req.destroy();
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: `Repository archive exceeds maximum allowed size (25 MB limit). Reported size: ${(reportedLen / (1024 * 1024)).toFixed(1)} MB.`,
          })
        );
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${parsed.pathname.split('/').filter(Boolean).slice(0, 2).join('-')}.zip"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=300',
      });

      remoteRes.on('data', (chunk: Buffer) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_ARCHIVE_SIZE_BYTES) {
          clearTimeout(timer);
          req.destroy();
          if (!res.writableEnded) {
            res.destroy();
          }
        }
      });

      remoteRes.on('end', () => {
        clearTimeout(timer);
        isDone = true;
      });

      remoteRes.pipe(res);
    }
  );

  req.on('error', (err) => {
    clearTimeout(timer);
    if (!isDone && !res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `Upstream connection error: ${err.message}` }));
    }
  });
}

/**
 * Extracts owner, repo, ref from either query parameters or path.
 * Supports:
 * - Query: /api/github-archive?owner=foo&repo=bar&ref=main
 * - Path:  /api/github-archive/foo/bar/zip/main
 */
export function extractParamsFromRequest(
  req: IncomingMessage & { query?: Record<string, string | string[]> }
): { owner?: string; repo?: string; ref?: string } {
  // Query parameters (Vercel Serverless automatically parses req.query)
  if (req.query) {
    const owner = Array.isArray(req.query.owner) ? req.query.owner[0] : req.query.owner;
    const repo = Array.isArray(req.query.repo) ? req.query.repo[0] : req.query.repo;
    const ref = Array.isArray(req.query.ref) ? req.query.ref[0] : req.query.ref;
    if (owner && repo) {
      return { owner, repo, ref };
    }
  }

  // Fallback to URL path parsing
  const url = req.url || '';
  const parsed = new URL(url, 'http://localhost');
  const queryOwner = parsed.searchParams.get('owner');
  const queryRepo = parsed.searchParams.get('repo');
  const queryRef = parsed.searchParams.get('ref');

  if (queryOwner && queryRepo) {
    return { owner: queryOwner, repo: queryRepo, ref: queryRef || undefined };
  }

  // Pattern: /api/github-archive/:owner/:repo/zip/:ref
  const cleanPath = parsed.pathname.replace(/^\/api\/github-archive\/?/, '');
  const segments = cleanPath.split('/').filter(Boolean);
  if (segments.length >= 2) {
    const owner = segments[0];
    const repo = segments[1];
    let ref = 'main';
    if (segments.length >= 4 && segments[2] === 'zip') {
      ref = segments.slice(3).join('/');
    } else if (segments.length === 3) {
      ref = segments[2];
    }
    return { owner, repo, ref };
  }

  return {};
}

/**
 * Vercel Serverless Function entrypoint.
 */
export default async function handler(
  req: IncomingMessage & { query?: Record<string, string | string[]> },
  res: ServerResponse
): Promise<void> {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Allow', 'GET, OPTIONS');
    res.end(JSON.stringify({ error: 'Method Not Allowed. Use GET or OPTIONS.' }));
    return;
  }

  const { owner, repo, ref } = extractParamsFromRequest(req);
  const validation = validateArchiveParams(owner, repo, ref);

  if (!validation.isValid) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify({ error: validation.error }));
    return;
  }

  streamGitHubArchive(validation.params.owner, validation.params.repo, validation.params.ref, res);
}
