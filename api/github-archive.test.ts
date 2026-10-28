import { describe, it, expect, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import handler, {
  validateArchiveParams,
  isAllowedGitHubHost,
  extractParamsFromRequest,
} from './github-archive.ts';

describe('Vercel Serverless Function — /api/github-archive', () => {
  describe('Input Validation & Sanitization', () => {
    it('accepts valid GitHub owner, repo, and ref', () => {
      const res = validateArchiveParams('satyam-info', 'CommitShield', 'main');
      expect(res.isValid).toBe(true);
      if (res.isValid) {
        expect(res.params.owner).toBe('satyam-info');
        expect(res.params.repo).toBe('CommitShield');
        expect(res.params.ref).toBe('main');
      }
    });

    it('defaults ref to "main" if omitted or empty', () => {
      const res = validateArchiveParams('facebook', 'react', '');
      expect(res.isValid).toBe(true);
      if (res.isValid) {
        expect(res.params.ref).toBe('main');
      }
    });

    it('rejects missing owner or repo', () => {
      expect(validateArchiveParams(undefined, 'repo', 'main').isValid).toBe(false);
      expect(validateArchiveParams('owner', undefined, 'main').isValid).toBe(false);
      expect(validateArchiveParams('', '', '').isValid).toBe(false);
    });

    it('rejects malicious characters in owner (command injection / SSRF)', () => {
      expect(validateArchiveParams('user;rm -rf', 'repo', 'main').isValid).toBe(false);
      expect(validateArchiveParams('user/sub', 'repo', 'main').isValid).toBe(false);
      expect(validateArchiveParams('../user', 'repo', 'main').isValid).toBe(false);
    });

    it('rejects path traversal attempts in repository name', () => {
      expect(validateArchiveParams('owner', '..', 'main').isValid).toBe(false);
      expect(validateArchiveParams('owner', '.', 'main').isValid).toBe(false);
      expect(validateArchiveParams('owner', 'repo/nested', 'main').isValid).toBe(false);
    });

    it('rejects path traversal attempts in git ref', () => {
      expect(validateArchiveParams('owner', 'repo', '../../etc/passwd').isValid).toBe(false);
      expect(validateArchiveParams('owner', 'repo', '/leading-slash').isValid).toBe(false);
      expect(validateArchiveParams('owner', 'repo', 'trailing-slash/').isValid).toBe(false);
    });
  });

  describe('SSRF Protection & Host Allowlist', () => {
    it('allows official GitHub domains', () => {
      expect(isAllowedGitHubHost('codeload.github.com')).toBe(true);
      expect(isAllowedGitHubHost('github.com')).toBe(true);
      expect(isAllowedGitHubHost('raw.githubusercontent.com')).toBe(true);
      expect(isAllowedGitHubHost('render.githubusercontent.com')).toBe(true);
    });

    it('strictly blocks private IPs, localhost, and non-GitHub hosts', () => {
      expect(isAllowedGitHubHost('localhost')).toBe(false);
      expect(isAllowedGitHubHost('127.0.0.1')).toBe(false);
      expect(isAllowedGitHubHost('169.254.169.254')).toBe(false);
      expect(isAllowedGitHubHost('10.0.0.1')).toBe(false);
      expect(isAllowedGitHubHost('192.168.1.1')).toBe(false);
      expect(isAllowedGitHubHost('evil-github.com')).toBe(false);
      expect(isAllowedGitHubHost('github.com.evil.com')).toBe(false);
      expect(isAllowedGitHubHost('attacker.io')).toBe(false);
    });
  });

  describe('Request Parameter Extraction', () => {
    it('extracts parameters from query string (Vercel query mode)', () => {
      const req = {
        url: '/api/github-archive?owner=vercel&repo=next.js&ref=canary',
        query: { owner: 'vercel', repo: 'next.js', ref: 'canary' },
      } as unknown as IncomingMessage & { query?: Record<string, string | string[]> };

      const params = extractParamsFromRequest(req);
      expect(params.owner).toBe('vercel');
      expect(params.repo).toBe('next.js');
      expect(params.ref).toBe('canary');
    });

    it('extracts parameters from path slug (/api/github-archive/:owner/:repo/zip/:ref)', () => {
      const req = {
        url: '/api/github-archive/tailwindlabs/tailwindcss/zip/v3.4',
      } as unknown as IncomingMessage;

      const params = extractParamsFromRequest(req);
      expect(params.owner).toBe('tailwindlabs');
      expect(params.repo).toBe('tailwindcss');
      expect(params.ref).toBe('v3.4');
    });
  });

  describe('Serverless Handler HTTP Contract', () => {
    it('handles OPTIONS preflight with 204 and CORS headers', async () => {
      const req = { method: 'OPTIONS' } as IncomingMessage;
      let status = 0;
      const headers: Record<string, string> = {};
      const res = {
        writeHead: (s: number, h: Record<string, string>) => {
          status = s;
          Object.assign(headers, h);
        },
        end: vi.fn(),
      } as unknown as ServerResponse;

      await handler(req, res);
      expect(status).toBe(204);
      expect(headers['Access-Control-Allow-Origin']).toBe('*');
      expect(res.end).toHaveBeenCalled();
    });

    it('rejects unsupported HTTP methods with 405 Method Not Allowed', async () => {
      const req = { method: 'POST' } as IncomingMessage;
      let statusCode = 0;
      let body = '';
      const res = {
        set statusCode(code: number) {
          statusCode = code;
        },
        setHeader: vi.fn(),
        end: (data: string) => {
          body = data;
        },
      } as unknown as ServerResponse;

      await handler(req, res);
      expect(statusCode).toBe(405);
      expect(body).toContain('Method Not Allowed');
    });

    it('rejects invalid query parameters with 400 Bad Request', async () => {
      const req = {
        method: 'GET',
        url: '/api/github-archive?owner=bad$user&repo=valid-repo',
        query: { owner: 'bad$user', repo: 'valid-repo' },
      } as unknown as IncomingMessage & { query?: Record<string, string | string[]> };

      let statusCode = 0;
      let body = '';
      const res = {
        set statusCode(code: number) {
          statusCode = code;
        },
        setHeader: vi.fn(),
        end: (data: string) => {
          body = data;
        },
      } as unknown as ServerResponse;

      await handler(req, res);
      expect(statusCode).toBe(400);
      expect(body).toContain('Invalid GitHub owner');
    });
  });
});
